/** Local-only transaction regression. Run after migrations and hospitality-seed.ts. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (process.env.NODE_ENV === "production" || !["localhost", "127.0.0.1", "::1"].includes(new URL(url).hostname)) throw new Error("A local test database is required");
  const f = JSON.parse(await readFile("/private/tmp/negosu-hospitality-fixture.json", "utf8"));
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  async function actor(role: string) {
    const db = createClient(url, key, { auth: { persistSession: false } });
    assert.equal((await db.auth.signInWithPassword({ email: `qa.hospitality.${role}@negosu.local.test`, password: "NegOSu-Local-QA-2026!" })).error, null);
    return db;
  }
  const owner = await actor("owner"), viewer = await actor("viewer"), other = await actor("other");
  const anon = createClient(url, key, { auth: { persistSession: false } });
  let checks = 0;
  const ok = (message: string) => console.log(`ok ${++checks} - ${message}`);
  async function call(db: SupabaseClient, name: string, args: Record<string, unknown>) {
    const result = await db.rpc(name, args); assert.equal(result.error, null, result.error?.message); return result.data;
  }
  const cashier = crypto.randomUUID(), housekeeper = crypto.randomUUID();
  assert.equal((await admin.from("organization_staff_profiles").insert([
    { id: cashier, organization_id: f.org, full_name: "Manual Arrival Cashier", is_active: true },
    { id: housekeeper, organization_id: f.org, full_name: "Manual Arrival Housekeeper", is_active: true },
  ])).error, null);
  const rate = { id: crypto.randomUUID(), label: "3 hours", durationMinutes: 180, priceCentavos: 80000 };
  async function room() {
    return call(owner, "save_hospitality_room_with_rates", { p_org: f.org, p_branch: f.branch, p_room: null, p_name: `Manual ${crypto.randomUUID().slice(0, 8)}`, p_type: "Test", p_description: "Local regression", p_capacity: 2, p_active: true, p_expected_version: 0, p_rates: [rate] });
  }
  const arrival = {
    p_org: f.org, p_branch: f.branch, p_room: await room(), p_rate: rate.id, p_rates_version: 1,
    p_tendered: 100000, p_method: "cash", p_reference: "", p_occupants: 1, p_guest_name: "", p_guest: null,
    p_notes: "Local dated arrival", p_request: crypto.randomUUID(), p_final: 80000, p_discount_type: "none",
    p_discount_card: "", p_deposit: 0, p_receipt: "", p_cashier: cashier, p_housekeeper: housekeeper,
    p_check_in_at: new Date(Date.now() - 2 * 3600000).toISOString(),
  };
  for (const [name, db] of [["anonymous", anon], ["viewer", viewer], ["other tenant", other]] as const) {
    assert.ok((await db.rpc("check_in_hospitality_at", arrival)).error); ok(`${name} cannot create a manual arrival`);
  }
  assert.equal((await owner.rpc("check_in_hospitality_at", { ...arrival, p_branch: f.annex })).error?.code, "42501"); ok("room from another branch rejected");
  for (const at of [null, "infinity", new Date(Date.now() + 86400000).toISOString()]) {
    assert.equal((await owner.rpc("check_in_hospitality_at", { ...arrival, p_check_in_at: at })).error?.code, "22007");
  }
  ok("missing, infinite and future arrival times rejected");
  assert.ok((await owner.rpc("check_in_hospitality_at", { ...arrival, p_cashier: crypto.randomUUID() })).error);
  const failed = await admin.from("hospitality_stays").select("id").eq("organization_id", f.org).eq("request_key", arrival.p_request);
  assert.equal(failed.error, null); assert.equal(failed.data?.length, 0); ok("invalid staff rolls back the complete arrival");
  const sid = await call(owner, "check_in_hospitality_at", arrival);
  const stay = await admin.from("hospitality_stays").select("*").eq("id", sid).single(); assert.equal(stay.error, null);
  assert.equal(new Date(stay.data.checked_in_at).toISOString(), arrival.p_check_in_at);
  assert.equal(new Date(stay.data.planned_checkout_at).getTime() - new Date(stay.data.checked_in_at).getTime(), 3 * 3600000);
  assert.ok(new Date(stay.data.check_in_recorded_at).getTime() > new Date(stay.data.checked_in_at).getTime()); ok("effective arrival shifts paid period while retaining recording time");
  assert.equal(await call(owner, "check_in_hospitality_at", arrival), sid); ok("exact retry returns original stay");
  const bills = await admin.from("hospitality_stay_bills").select("invoice_id").eq("stay_id", sid).single(); assert.equal(bills.error, null);
  const payments = await admin.from("payments").select("paid_at,amount_centavos,cash_change_centavos").eq("invoice_id", bills.data!.invoice_id); assert.equal(payments.error, null);
  assert.equal(payments.data!.length, 1); assert.equal(payments.data![0].amount_centavos, 80000); assert.equal(payments.data![0].cash_change_centavos, 20000);
  assert.ok(new Date(payments.data![0].paid_at).getTime() > new Date(arrival.p_check_in_at).getTime()); ok("one payment retains actual recording date and correct change");
  assert.equal((await owner.rpc("check_in_hospitality_at", { ...arrival, p_check_in_at: new Date(Date.now() - 3600000).toISOString() })).error?.code, "40001"); ok("changed-time retry rejected");
  assert.ok((await owner.rpc("check_in_hospitality_at", { ...arrival, p_tendered: 110000 })).error); ok("changed-payment retry rejected");
  assert.equal((await owner.rpc("check_in_hospitality_at", { ...arrival, p_request: crypto.randomUUID() })).error?.code, "23P01"); ok("occupied room overlap rejected");
  await call(owner, "check_out_hospitality_shift", { p_org: f.org, p_branch: f.branch, p_stay: sid, p_acknowledge_debt: false, p_confirm_refund: false, p_refund_method: "cash", p_refund_reference: "", p_cashier: cashier, p_housekeeper: housekeeper });
  assert.equal(await call(owner, "check_in_hospitality_at", arrival), sid); ok("retry after checkout preserves original stay");
  assert.equal((await owner.rpc("check_in_hospitality_at", { ...arrival, p_request: crypto.randomUUID(), p_check_in_at: new Date().toISOString() })).error?.code, "55000"); ok("cleaning still blocks arrivals");
  await call(owner, "mark_hospitality_room_ready", { p_org: f.org, p_branch: f.branch, p_room: arrival.p_room, p_cleaning_stay: sid });
  assert.equal((await owner.rpc("check_in_hospitality_at", { ...arrival, p_request: crypto.randomUUID() })).error?.code, "23P01"); ok("backdated overlap with completed stay rejected");
  const departed = await admin.from("hospitality_stays").select("checked_out_at").eq("id", sid).single(); assert.equal(departed.error, null);
  await call(owner, "check_in_hospitality_at", { ...arrival, p_request: crypto.randomUUID(), p_check_in_at: departed.data!.checked_out_at }); ok("arrival exactly at previous departure is allowed once clean");
  const concurrent = { ...arrival, p_room: await room() };
  const results = await Promise.all([owner.rpc("check_in_hospitality_at", { ...concurrent, p_request: crypto.randomUUID() }), owner.rpc("check_in_hospitality_at", { ...concurrent, p_request: crypto.randomUUID() })]);
  assert.equal(results.filter(r => !r.error).length, 1); assert.equal(results.filter(r => r.error?.code === "23P01").length, 1); ok("concurrent arrivals cannot double-book one room");
  // Back-enter a closed stay while the room has a different live occupant.
  const before = await admin.from("hospitality_rooms").select("cleaning_required,cleaning_stay_id,cleaned_at,cleaned_by").eq("id", concurrent.p_room).single(); assert.equal(before.error, null);
  const past = { ...concurrent, p_request: crypto.randomUUID(), p_check_in_at: new Date(Date.now() - 3 * 86400000).toISOString(), p_check_out_at: new Date(Date.now() - 3 * 86400000 + 3 * 3600000).toISOString(), p_checkout_cashier: housekeeper, p_checkout_housekeeper: cashier, p_confirm_refund: true, p_refund_method: "cash", p_refund_reference: "Recorded past return", p_deposit: 10000 };
  const pastSid = await call(owner, "record_hospitality_past_booking", past);
  const pastStay = await admin.from("hospitality_stays").select("checked_in_at,checked_out_at").eq("id", pastSid).single(); assert.equal(pastStay.error, null);
  assert.equal(new Date(pastStay.data!.checked_out_at).toISOString(), past.p_check_out_at);
  const after = await admin.from("hospitality_rooms").select("cleaning_required,cleaning_stay_id,cleaned_at,cleaned_by").eq("id", concurrent.p_room).single(); assert.equal(after.error, null);
  assert.deepEqual(after.data, before.data);
  const live = await admin.from("hospitality_stays").select("id").eq("room_id", concurrent.p_room).is("checked_out_at", null); assert.equal(live.error, null); assert.equal(live.data!.length, 1);
  ok("closed historical booking preserves current occupant and cleaning metadata");
  assert.equal(await call(owner, "record_hospitality_past_booking", past), pastSid); ok("closed historical retry is idempotent");
  const link = await admin.from("hospitality_stay_bills").select("invoice_id").eq("stay_id", pastSid).single(); assert.equal(link.error, null);
  const returned = await admin.from("invoice_deposits").select("refunded_at").eq("invoice_id", link.data!.invoice_id).single(); assert.equal(returned.error, null); assert.ok(returned.data!.refunded_at); ok("past deposit receipt and confirmed return commit together");
  for (const db of [viewer, other, anon]) assert.ok((await db.rpc("record_hospitality_past_booking", { ...past, p_request: crypto.randomUUID() })).error); ok("historical entry retains role and tenant boundaries");
  assert.equal((await owner.rpc("record_hospitality_past_booking", { ...past, p_request: crypto.randomUUID() })).error?.code, "23P01"); ok("closed historical intervals cannot overlap");
  assert.ok((await owner.rpc("record_hospitality_past_booking", { ...past, p_check_out_at: new Date(Date.now() - 2 * 86400000).toISOString() })).error); ok("changed checkout time on retry rejected");
  assert.equal((await owner.rpc("record_hospitality_past_booking", { ...past, p_request: crypto.randomUUID(), p_check_out_at: past.p_check_in_at })).error?.code, "22007"); ok("checkout must be after arrival");
  assert.equal((await owner.rpc("record_hospitality_past_booking", { ...past, p_request: crypto.randomUUID(), p_confirm_refund: false })).error?.code, "22023"); ok("completed stay cannot leave an unconfirmed deposit return");
  console.log(`${checks} manual-arrival integration checks passed`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
