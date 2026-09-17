/** Local-only shift attribution and shared plan-upgrade integration. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (process.env.NODE_ENV === "production" || !["localhost", "127.0.0.1", "::1"].includes(new URL(url).hostname)) throw new Error("Local database required");
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
async function main() {
 const f = JSON.parse(await readFile("/private/tmp/negosu-hospitality-fixture.json", "utf8"));
 const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
 let passed = 0;
 const ok = (message: string) => console.log(`ok ${++passed} - ${message}`);
 async function actor(role: string) { const db = createClient(url, key, { auth: { persistSession: false } }); assert.equal((await db.auth.signInWithPassword({ email: `qa.hospitality.${role}@negosu.local.test`, password: "NegOSu-Local-QA-2026!" })).error, null); return db; }
 async function call(db: SupabaseClient, name: string, args: Record<string, unknown>) { const r = await db.rpc(name, args); assert.equal(r.error, null, r.error?.message); return r.data; }
 const owner = await actor("owner"), cashier = await actor("cashier"), other = await actor("other"), front = await actor("frontdesk"), viewer = await actor("viewer"), housekeeper = await actor("housekeeper");
 const profiles = Array.from({ length: 5 }, (_, i) => ({ id: crypto.randomUUID(), organization_id: f.org, full_name: `Shift staff ${i}`, job_function: i % 2 ? "Housekeeper" : "Cashier", is_active: i !== 4 }));
 assert.equal((await admin.from("organization_staff_profiles").insert(profiles)).error, null);
 assert.equal((await admin.from("staff_profile_branch_assignments").insert({ staff_profile_id: profiles[3].id, organization_id: f.org, branch_id: f.annex })).error, null);
 const otherProfile = crypto.randomUUID();
 assert.equal((await admin.from("organization_staff_profiles").insert({ id: otherProfile, organization_id: f.otherOrg, full_name: "Other tenant staff", is_active: true })).error, null);
 const rate = { id: crypto.randomUUID(), label: "3 hours", durationMinutes: 180, priceCentavos: 80000, extensionHourlyCentavos: 15000 };
 const room = await call(owner, "save_hospitality_room_with_rates", { p_org: f.org, p_branch: f.branch, p_room: null, p_name: `Shift ${crypto.randomUUID().slice(0,8)}`, p_type: "Test", p_description: "Local synthetic", p_capacity: 2, p_active: true, p_rates: [rate], p_expected_version: 0 });
 const arrival = { p_org: f.org, p_branch: f.branch, p_room: room, p_rate: rate.id, p_rates_version: 1, p_tendered: 100000, p_method: "cash", p_reference: "", p_occupants: 1, p_guest_name: "", p_guest: null, p_notes: "", p_request: crypto.randomUUID(), p_final: 80000, p_discount_type: "none", p_discount_card: "", p_deposit: 20000, p_receipt: "", p_cashier: profiles[0].id, p_housekeeper: profiles[1].id };
 for (const [label, id] of [["missing", null], ["other tenant", otherProfile], ["wrong branch", profiles[3].id], ["inactive", profiles[4].id], ["unknown", crypto.randomUUID()]] as const) {
  for (const field of ["p_cashier", "p_housekeeper"]) assert.equal((await cashier.rpc("check_in_hospitality_shift", { ...arrival, [field]: id })).error?.code, "22023", label);
  ok(`${label} shift staff rejected for both selections`);
 }
 assert.equal((await owner.from("hospitality_stays").select("id").eq("room_id", room)).data!.length, 0); ok("invalid staff rolls back paid arrival and occupancy");
 for (const db of [other, viewer, front, housekeeper]) assert.ok((await db.rpc("check_in_hospitality_shift", arrival)).error); ok("selected cashier identity cannot grant payment permissions");
 const race = await Promise.all([cashier.rpc("check_in_hospitality_shift", arrival), owner.rpc("check_in_hospitality_shift", arrival)]);
 assert.equal(race[0].error, null); assert.equal(race[1].error, null); assert.equal(race[0].data, race[1].data); const sid = race[0].data;
 let events = (await owner.from("hospitality_stay_staff_events").select("*").eq("stay_id", sid)).data!;
 assert.equal(events.length, 1); assert.equal(events[0].cashier_name, "Shift staff 0"); assert.equal(events[0].housekeeper_name, "Shift staff 1"); assert.ok([f.owner,f.cashier].includes(events[0].recorded_by)); ok("duplicate arrival saves one shift with independent profiles and actual recorder");
 assert.equal((await cashier.rpc("check_in_hospitality_shift", { ...arrival, p_cashier: profiles[2].id })).error?.code, "40001"); ok("arrival retry cannot overwrite selected shift");
 assert.equal((await admin.from("organization_staff_profiles").update({ full_name: "Renamed former cashier", is_active: false }).eq("id", profiles[0].id)).error, null);
 assert.equal(await call(cashier, "check_in_hospitality_shift", arrival), sid); ok("exact arrival retry survives staff rename/deactivation");
 const link = (await owner.from("hospitality_stay_bills").select("invoice_id").eq("stay_id", sid).single()).data!;
 const checkout = { p_org: f.org, p_branch: f.branch, p_stay: sid, p_acknowledge_debt: false, p_confirm_refund: true, p_refund_method: "cash", p_refund_reference: "", p_cashier: profiles[2].id, p_housekeeper: profiles[1].id };
 assert.equal((await cashier.rpc("check_out_hospitality_shift", { ...checkout, p_housekeeper: profiles[3].id })).error?.code, "22023");
 assert.equal((await owner.from("invoice_deposits").select("refunded_at").eq("invoice_id", link.invoice_id).single()).data!.refunded_at, null);
 assert.equal((await owner.from("hospitality_stays").select("checked_out_at").eq("id", sid).single()).data!.checked_out_at, null); ok("invalid checkout staff rolls back refund, departure and cleaning");
 assert.ok((await front.rpc("check_out_hospitality_shift", checkout)).error); ok("selecting a cashier does not let front desk refund a deposit");
 const out = await Promise.all([cashier.rpc("check_out_hospitality_shift", checkout), owner.rpc("check_out_hospitality_shift", checkout)]); assert.equal(out[0].error, null); assert.equal(out[1].error, null);
 events = (await owner.from("hospitality_stay_staff_events").select("*").eq("stay_id", sid).order("recorded_at")).data!;
 assert.equal(events.length, 2); assert.equal(events[0].cashier_name, "Shift staff 0"); assert.equal(events[1].cashier_name, "Shift staff 2"); ok("independent checkout shift preserves original arrival names");
 assert.equal((await cashier.rpc("check_out_hospitality_shift", { ...checkout, p_housekeeper: profiles[2].id })).error?.code, "40001"); ok("changed checkout staff retry rejected");
 assert.equal((await housekeeper.from("hospitality_stay_staff_events").select("cashier_name,housekeeper_name").eq("stay_id", sid)).data!.length, 2); ok("housekeeping can read shift attribution without financial data");
 assert.equal((await other.from("hospitality_stay_staff_events").select("*").eq("stay_id", sid)).data!.length, 0); ok("other tenant cannot read shift history");
 assert.ok((await cashier.from("hospitality_stay_staff_events").update({ cashier_name: "Forged" }).eq("stay_id", sid)).error); assert.ok((await cashier.rpc("record_hospitality_shift_staff", { p_org: f.org, p_branch: f.branch, p_stay: sid, p_phase: "check_in", p_cashier: profiles[2].id, p_housekeeper: profiles[1].id })).error); ok("direct attribution writes and internal helper calls denied");
 const annexRoom = await call(owner, "save_hospitality_room_with_rates", { p_org: f.org, p_branch: f.annex, p_room: null, p_name: `Shift annex ${crypto.randomUUID().slice(0,8)}`, p_type: "Test", p_description: "Local synthetic", p_capacity: 2, p_active: true, p_rates: [rate], p_expected_version: 0 });
 const annexStay = await call(owner, "check_in_hospitality_shift", { ...arrival, p_branch: f.annex, p_room: annexRoom, p_request: crypto.randomUUID(), p_cashier: profiles[2].id, p_housekeeper: profiles[3].id });
 assert.equal((await cashier.from("hospitality_stay_staff_events").select("*").eq("stay_id", annexStay)).data!.length, 0);
 assert.ok((await cashier.rpc("check_out_hospitality_shift", { ...checkout, p_stay: annexStay, p_branch: f.annex })).error); ok("shift history and mutation respect the caller's branch restriction");
 const month = await call(other, "quote_paymongo_plan", { p_organization_id: f.otherOrg, p_plan_id: "starter", p_interval: "month" });
 const year = await call(other, "quote_paymongo_plan", { p_organization_id: f.otherOrg, p_plan_id: "starter", p_interval: "year" });
 assert.ok(month.amountCentavos>0); assert.ok(year.amountCentavos>month.amountCentavos); ok("Apartelle owner receives monthly and yearly upgrade quotes");
 for (const db of [cashier, viewer, housekeeper]) assert.ok((await db.rpc("quote_paymongo_plan", { p_organization_id: f.org, p_plan_id: "starter", p_interval: "month" })).error); ok("plan upgrade quote remains owner-only");
 const orderArgs = { p_organization_id: f.otherOrg, p_plan_id: "starter", p_interval: "month", p_request_id: crypto.randomUUID(), p_livemode: false };
 const order = await call(other, "begin_paymongo_order", orderArgs); assert.equal((await call(other, "begin_paymongo_order", orderArgs)).id, order.id);
 assert.equal((await call(other, "get_org_entitlements", { p_organization_id: f.otherOrg })).planId, "free"); ok("Apartelle checkout order is idempotent and does not grant access before verified payment");
 assert.equal((await cashier.from("billing_orders").select("id").eq("id", order.id)).data!.length, 0); ok("staff cannot read owner billing order");
 assert.equal((await admin.from("billing_orders").update({ status: "cancelled" }).eq("id", order.id)).error, null); // Local synthetic order, no provider session or payment.
 console.log(`${passed} Hospitality shift and upgrade checks passed.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
