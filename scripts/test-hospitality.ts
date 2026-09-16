/** Real local PostgREST/RLS/transaction races, using guarded synthetic fixtures. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (process.env.NODE_ENV === "production" || !["localhost", "127.0.0.1", "::1"].includes(new URL(url).hostname)) throw new Error("Local database required");
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
async function main() {
const f = JSON.parse(await readFile("/private/tmp/negosu-hospitality-fixture.json", "utf8"));
const id = (n: number) => `b9600000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
let passed = 0;
function ok(label: string) { console.log(`ok ${++passed} - ${label}`); }
async function actor(label: string) { const db = createClient(url, key, { auth: { persistSession: false } }); const result = await db.auth.signInWithPassword({ email: `qa.hospitality.${label}@negosu.local.test`, password: "NegOSu-Local-QA-2026!" }); assert.equal(result.error, null); return db; }
async function call(db: SupabaseClient, name: string, args: Record<string, unknown>) { const r = await db.rpc(name, args); assert.equal(r.error, null, r.error?.message); return r.data; }
const owner = await actor("owner"), owner2 = await actor("owner"), other = await actor("other"), viewer = await actor("viewer"), front = await actor("frontdesk"), cashier = await actor("cashier"), housekeeper = await actor("housekeeper");
for (const uid of [f.viewer, f.frontDesk, f.cashier, f.housekeeper]) { const membership = await admin.from("organization_memberships").select("id").eq("organization_id", f.org).eq("user_id", uid).single(); assert.equal(membership.error, null); const r = await admin.from("membership_branch_assignments").upsert({ membership_id: membership.data!.id, organization_id: f.org, branch_id: f.branch }); assert.equal(r.error, null); }
async function finishCleaning(sid: string, branch = f.branch) {
  const stay = (await owner.from("hospitality_stays").select("room_id").eq("id", sid).single()).data!;
  await call(owner, "mark_hospitality_room_ready", { p_org: f.org, p_branch: branch, p_room: stay.room_id, p_cleaning_stay: sid });
}
const roomArgs = { p_org: f.org, p_branch: f.branch, p_room: null, p_name: `Race ${crypto.randomUUID().slice(0, 8)}`, p_type: "Test", p_description: "Synthetic local test", p_capacity: 2, p_active: true };
const rates = [180,360,720,1440,10080].map((durationMinutes, i) => ({ id: crypto.randomUUID(), label: ["3 hours","6 hours","12 hours","Daily","Weekly"][i], durationMinutes, priceCentavos: 80000 + i * 10000 }));
const withRates = { ...roomArgs, p_rates: rates, p_expected_version: 0 };
const room = await call(owner, "save_hospitality_room_with_rates", withRates); ok("admin configures five fixed room periods");
assert.ok((await cashier.rpc("save_hospitality_room_with_rates", withRates)).error); ok("cashier cannot set room rates");
assert.ok((await owner.rpc("save_hospitality_room_with_rates", { ...withRates, p_rates: [rates[0], { ...rates[0], id: crypto.randomUUID() }] })).error); ok("duplicate duration rejected by database");
assert.ok((await owner.rpc("save_hospitality_room_with_rates", { ...withRates, p_rates: [{ ...rates[0], priceCentavos: -1 }] })).error); ok("negative rate rejected by database");
assert.ok((await owner.rpc("save_hospitality_room_with_rates", { ...withRates, p_name: roomArgs.p_name.toUpperCase() })).error); ok("duplicate room names rejected case-insensitively");
const checkIn = { p_org: f.org, p_branch: f.branch, p_room: room, p_rate: rates[0].id, p_rates_version: 1, p_tendered: 100000, p_method: "cash", p_reference: "", p_occupants: 2, p_guest_name: "", p_guest: null, p_notes: "race", p_request: crypto.randomUUID() };
assert.ok((await owner.rpc("check_in_hospitality", { p_org: f.org, p_branch: f.branch, p_room: room, p_guest: id(10), p_occupants: 1, p_notes: "", p_charge_centavos: 1, p_request: crypto.randomUUID() })).error); ok("retired arbitrary-rate arrival cannot be called");
for (const [label, db, change] of [
  ["cross-tenant guest", owner, { p_guest: id(19) }], ["cross-tenant actor", other, {}],
  ["front desk without collection role", front, {}], ["cashier wrong branch", cashier, { p_branch: f.annex, p_room: id(40) }],
  ["over capacity", cashier, { p_occupants: 3 }], ["underpayment", cashier, { p_tendered: 79999 }],
  ["noncash change", cashier, { p_method: "card" }], ["unknown rate", cashier, { p_rate: crypto.randomUUID() }],
  ["stale rate", cashier, { p_rates_version: 0 }],
] as [string, SupabaseClient, Record<string, unknown>][]) {
  assert.ok((await db.rpc("check_in_hospitality_paid", { ...checkIn, ...change })).error, label); ok(`${label} arrival rejected`);
}
assert.equal((await owner.from("hospitality_stays").select("id").eq("room_id", room)).data!.length, 0); ok("failed arrivals leave no occupancy");
const race = await Promise.all([cashier.rpc("check_in_hospitality_paid", checkIn), owner2.rpc("check_in_hospitality_paid", { ...checkIn, p_request: crypto.randomUUID() })]);
assert.equal(race.filter(r => !r.error).length, 1); const winner = race.find(r => !r.error)!.data as string; ok("actual concurrent check-in: exactly one succeeds");
const saved = (await owner.from("hospitality_stays").select("*").eq("id", winner).single()).data!;
assert.equal(saved.guest_id, null); assert.equal(saved.guest_name_snapshot, "Walk-in"); assert.equal(new Date(saved.planned_checkout_at).getTime() - new Date(saved.checked_in_at).getTime(), 180 * 60000); ok("unnamed arrival has exact three-hour period without fake guest");
const retry = { ...checkIn, p_request: saved.request_key };
assert.equal(await call(cashier, "check_in_hospitality_paid", retry), winner); ok("arrival retry returns original stay");
assert.ok((await cashier.rpc("check_in_hospitality_paid", { ...retry, p_tendered: 90000 })).error); ok("changed payment replay rejected");
assert.ok((await owner.rpc("save_hospitality_room", { ...roomArgs, p_room: room, p_active: false })).error); ok("occupied room cannot be deactivated");
assert.ok((await owner.rpc("save_hospitality_room", { ...roomArgs, p_room: room, p_capacity: 1 })).error); ok("occupied room capacity cannot be reduced below occupants");
const assoc = await owner.from("hospitality_stay_bills").select("invoice_id,rate_snapshot").eq("stay_id", winner).single(); assert.equal(assoc.error, null); const invoice = assoc.data!.invoice_id;
const firstPayment = (await owner.from("payments").select("*").eq("invoice_id", invoice).single()).data!;
assert.equal(firstPayment.amount_centavos, 80000); assert.equal(firstPayment.cash_tendered_centavos, 100000); assert.equal(firstPayment.cash_change_centavos, 20000); ok("cash revenue excludes returned change");
const settled = (await owner.from("invoices").select("status,balance_centavos,job_order_id").eq("id", invoice).single()).data!;
assert.equal(settled.status, "paid"); assert.equal(settled.balance_centavos, 0); assert.equal(settled.job_order_id, null); ok("check-in atomically settles neutral Core invoice");
await call(owner, "save_hospitality_room_with_rates", { ...withRates, p_room: room, p_expected_version: 1, p_rates: rates.map(r => ({ ...r, priceCentavos: r.priceCentavos + 10000 })) });
assert.equal((await owner.from("hospitality_stay_bills").select("rate_snapshot").eq("stay_id", winner).single()).data!.rate_snapshot.priceCentavos, 80000); ok("room price edits preserve historical charge snapshot");
assert.equal(await call(cashier, "check_in_hospitality_paid", retry), winner); ok("retry remains safe after room rate edit");
assert.ok((await owner.rpc("save_hospitality_room_with_rates", { ...withRates, p_room: room, p_expected_version: 1 })).error); ok("stale room edits cannot overwrite newer rates");
assert.equal((await admin.from("hospitality_stays").update({ checked_in_at: new Date(Date.now()-5*3600000).toISOString(), planned_checkout_at: new Date(Date.now()-2*3600000).toISOString() }).eq("id", winner)).error, null);
assert.equal((await cashier.from("hospitality_room_availability").select("occupancy_status").eq("id", room).single()).data!.occupancy_status, "occupied"); ok("expired paid period never automatically vacates room");
// Extra charges and existing debt remain supported by the shared ledger.
await call(owner, "add_hospitality_charge", { p_org: f.org, p_branch: f.branch, p_stay: winner, p_description: "Additional service", p_quantity: 1, p_unit_centavos: 10000, p_request: crypto.randomUUID() });
const payment = { p_invoice_id: invoice, p_amount_centavos: 7000, p_method: "cash", p_request_key: crypto.randomUUID(), p_paid_date: today };
assert.ok((await owner.rpc("record_invoice_collection", { ...payment, p_amount_centavos: -1 })).error); ok("negative payments rejected");
assert.ok((await owner.rpc("record_invoice_collection", { ...payment, p_currency: "USD" })).error); ok("incorrect currency rejected");
assert.ok((await other.rpc("record_invoice_collection", payment)).error); ok("cross-tenant invoice payment rejected");
const paymentsRace = await Promise.all([owner.rpc("record_invoice_collection", payment), owner2.rpc("record_invoice_collection", { ...payment, p_request_key: crypto.randomUUID() })]);
assert.equal(paymentsRace.filter(r => !r.error).length, 1); ok("actual concurrent payments cannot overpay");
const duplicatePayment = { ...payment, p_amount_centavos: 3000, p_request_key: crypto.randomUUID() };
const duplicateRace = await Promise.all([owner.rpc("record_invoice_collection", duplicatePayment), owner2.rpc("record_invoice_collection", duplicatePayment)]); assert.equal(duplicateRace[0].error, null); assert.equal(duplicateRace[1].error, null); assert.equal(duplicateRace[0].data, duplicateRace[1].data); ok("concurrent duplicate payment creates one ledger record");
await call(owner, "reverse_payment", { p_payment_id: duplicateRace[0].data, p_action: "refund", p_note: "Synthetic test refund" }); ok("existing refund restores balance");
const checkout = { p_org: f.org, p_branch: f.branch, p_stay: winner, p_acknowledge_debt: false };
assert.ok((await cashier.rpc("check_out_hospitality", checkout)).error); ok("unpaid checkout requires acknowledgment");
await call(cashier, "check_out_hospitality", { ...checkout, p_acknowledge_debt: true });
const firstOut = await owner.from("hospitality_stays").select("checked_out_at").eq("id", winner).single();
await call(cashier, "check_out_hospitality", checkout);
const nextOut = await owner.from("hospitality_stays").select("checked_out_at").eq("id", winner).single(); assert.equal(firstOut.data!.checked_out_at, nextOut.data!.checked_out_at); ok("cashier checkout retry preserves original timestamp");
assert.equal((await cashier.from("hospitality_room_availability").select("occupancy_status").eq("id", room).single()).data!.occupancy_status, "cleaning"); ok("checkout sends room to cleaning");
const readyArgs = { p_org: f.org, p_branch: f.branch, p_room: room, p_cleaning_stay: winner };
assert.equal((await cashier.rpc("check_in_hospitality_paid", { ...checkIn, p_rates_version: 2, p_request: crypto.randomUUID() })).error?.code, "55000"); ok("paid arrival blocked during cleaning at database boundary");
for (const actor of [viewer, other]) assert.ok((await actor.rpc("mark_hospitality_room_ready", readyArgs)).error); ok("viewer and other tenant cannot complete cleaning");
assert.ok((await housekeeper.rpc("mark_hospitality_room_ready", { ...readyArgs, p_branch: f.annex })).error); ok("housekeeper cannot complete cleaning across branches");
assert.ok((await housekeeper.from("hospitality_rooms").update({ cleaning_required: false }).eq("id", room)).error); ok("direct cleaning status writes denied");
const cleaningReport = await call(owner, "export_hospitality_workspace", { p_org: f.org, p_branch: f.branch, p_start: today, p_end: today, p_section: "rooms" });
assert.equal(cleaningReport.rows.find((r: { id: string }) => r.id === room).status, "Cleaning");
assert.equal(cleaningReport.cleaning, cleaningReport.rows.filter((r: { status: string }) => r.status === "Cleaning").length);
assert.equal(cleaningReport.vacant, cleaningReport.rows.filter((r: { status: string }) => r.status === "Vacant").length); ok("reports and export separate cleaning from available rooms");
const readyRace = await Promise.all([housekeeper.rpc("mark_hospitality_room_ready", readyArgs), cashier.rpc("mark_hospitality_room_ready", readyArgs)]);
assert.equal(readyRace[0].error, null); assert.equal(readyRace[1].error, null); ok("duplicate concurrent ready actions are safe");
const cleaned = (await owner.from("hospitality_rooms").select("cleaned_at,cleaned_by").eq("id", room).single()).data!;
assert.ok(cleaned.cleaned_at); assert.ok(cleaned.cleaned_by);
await call(housekeeper, "mark_hospitality_room_ready", readyArgs);
assert.equal((await owner.from("hospitality_rooms").select("cleaned_at").eq("id", room).single()).data!.cleaned_at, cleaned.cleaned_at); ok("ready retry preserves completion actor/time");
await call(cashier, "check_out_hospitality", checkout);
assert.equal((await cashier.from("hospitality_room_availability").select("occupancy_status").eq("id", room).single()).data!.occupancy_status, "vacant"); ok("housekeeping releases room and late checkout retry does not dirty it again");
assert.equal((await owner.from("invoices").select("balance_centavos").eq("id", invoice).single()).data!.balance_centavos, 3000); ok("checkout preserves additional debt");
assert.equal(await call(cashier, "check_in_hospitality_paid", retry), winner); ok("late arrival retry does not reopen a checked-out stay");
assert.ok((await cashier.rpc("check_in_hospitality_paid", { ...checkIn, p_request: crypto.randomUUID() })).error); ok("stale configured price rejected after checkout");
const nextArrival = { ...checkIn, p_rates_version: 2, p_tendered: 90000, p_method: "card", p_reference: "Local test", p_request: crypto.randomUUID() };
const duplicateArrival = await Promise.all([cashier.rpc("check_in_hospitality_paid", nextArrival), owner2.rpc("check_in_hospitality_paid", nextArrival)]);
assert.equal(duplicateArrival[0].error, null); assert.equal(duplicateArrival[1].error, null); assert.equal(duplicateArrival[0].data, duplicateArrival[1].data); ok("concurrent identical arrivals create one stay and payment");
const secondInvoice = (await owner.from("hospitality_stay_bills").select("invoice_id").eq("stay_id", duplicateArrival[0].data).single()).data!.invoice_id;
const secondPayment = (await owner.from("payments").select("cash_change_centavos,amount_centavos").eq("invoice_id", secondInvoice).single()).data!;
assert.equal(secondPayment.cash_change_centavos, null); assert.equal(secondPayment.amount_centavos, 90000); ok("noncash arrival collects exact current fixed price");
assert.ok((await housekeeper.rpc("mark_hospitality_room_ready", readyArgs)).error); ok("cannot mark an occupied room ready");
await call(cashier, "check_out_hospitality", { ...checkout, p_stay: duplicateArrival[0].data });
assert.equal((await housekeeper.rpc("mark_hospitality_room_ready", readyArgs)).error?.code, "40001"); ok("stale ready request cannot release a later cleaning cycle");
await finishCleaning(duplicateArrival[0].data);
for (const rate of rates.slice(1)) {
  const sid = await call(cashier, "check_in_hospitality_paid", { ...nextArrival, p_rate: rate.id, p_tendered: rate.priceCentavos + 10000, p_guest_name: "Optional guest", p_request: crypto.randomUUID() });
  const stay = (await cashier.from("hospitality_stays").select("guest_id,guest_name_snapshot,checked_in_at,planned_checkout_at").eq("id", sid).single()).data!;
  assert.equal(stay.guest_id, null); assert.equal(stay.guest_name_snapshot, "Optional guest");
  assert.equal(new Date(stay.planned_checkout_at).getTime() - new Date(stay.checked_in_at).getTime(), rate.durationMinutes * 60000);
  await call(cashier, "check_out_hospitality", { ...checkout, p_stay: sid });
  await finishCleaning(sid);
  ok(`${rate.label} uses exact duration and optional name without customer profile`);
}
assert.ok((await cashier.from("hospitality_rooms").update({ rates: [] }).eq("id", room)).error); ok("direct rate mutation denied to cashier");
assert.equal((await viewer.from("payments").select("cash_tendered_centavos,cash_change_centavos").eq("invoice_id", invoice)).data!.length, 0); ok("cash tender and change hidden from operational reader");
assert.ok((await admin.from("payments").update({ cash_change_centavos: 999 }).eq("id", firstPayment.id)).error); ok("database cash invariant rejects inconsistent change");
const oldSnapshot = saved.room_name_snapshot;
await call(owner, "save_hospitality_room", { ...roomArgs, p_room: room, p_name: roomArgs.p_name + " renamed" });
assert.equal((await owner.from("hospitality_stays").select("room_name_snapshot").eq("id", winner).single()).data!.room_name_snapshot, oldSnapshot); ok("room rename preserves historical snapshot");
const reportArgs = { p_org: f.org, p_branch: f.branch, p_start: today, p_end: today, p_section: "outstanding", p_mode: "report" };
const report = await call(owner, "get_hospitality_workspace", reportArgs); assert.ok(report.rows.some((r: { id: string }) => r.id === winner)); ok("outstanding report includes checked-out debt");
const allBills = await owner.from("hospitality_stay_bills").select("invoices(balance_centavos)").eq("branch_id", f.branch); assert.equal(allBills.error, null);
const sum = (allBills.data ?? []).reduce((n, r) => n + Number((Array.isArray(r.invoices) ? r.invoices[0] : r.invoices)?.balance_centavos ?? 0), 0); assert.equal(report.finance.outstanding, sum); ok("report total equals authoritative invoices without duplicate joins");
const viewerReport = await call(viewer, "get_hospitality_workspace", { ...reportArgs, p_section: "stays" }); assert.equal(viewerReport.finance, undefined); assert.equal(viewerReport.lowStock, undefined); ok("operational report omits unauthorized money and inventory payloads");
assert.ok((await viewer.rpc("get_hospitality_workspace", reportArgs)).error); ok("direct financial report RPC denied to viewer");
assert.ok((await viewer.rpc("get_owner_report", { p_organization_id: f.org, p_branch_id: f.branch, p_start_date: today, p_end_date: today })).error); ok("legacy financial report RPC cannot bypass hospitality finance policy");
assert.ok((await viewer.rpc("get_hospitality_workspace", { ...reportArgs, p_section: "rooms", p_branch: f.annex })).error); ok("report branch restriction authoritative");
assert.ok((await other.rpc("get_hospitality_workspace", reportArgs)).error); ok("report tenant restriction authoritative");
assert.equal((await viewer.from("invoices").select("id").eq("organization_id", f.org)).data!.length, 0); assert.equal((await viewer.from("hospitality_stay_bills").select("*")).data!.length, 0); ok("RLS blocks financial ledger and debt acknowledgment reads");
assert.equal((await other.from("hospitality_rooms").select("id").eq("organization_id", f.org)).data!.length, 0); assert.equal((await other.from("hospitality_stays").select("id").eq("organization_id", f.org)).data!.length, 0); ok("RLS blocks cross-tenant rooms and stays");
assert.ok((await viewer.from("hospitality_rooms").insert({ organization_id: f.org, branch_id: f.branch, name: "unauthorized", capacity: 2 })).error); ok("direct occupancy table writes revoked");
assert.ok((await admin.from("hospitality_stays").insert({ organization_id: f.org, branch_id: f.branch, room_id: room, guest_id: id(19), room_name_snapshot: "x", guest_name_snapshot: "x", occupants: 1, request_key: crypto.randomUUID() })).error); ok("composite foreign key rejects cross-tenant guest even for trusted writer");
assert.ok((await other.rpc("record_inventory_movement", { p_item_id: id(80), p_type: "purchase", p_quantity: 1 })).error); ok("cross-tenant stock adjustment rejected");
const beforeStock = (await owner.from("inventory_stock").select("quantity_on_hand").eq("id", id(80)).single()).data!.quantity_on_hand;
await call(owner, "record_inventory_movement", { p_item_id: id(80), p_type: "purchase", p_quantity: 1, p_idempotency_key: crypto.randomUUID() });
const afterStock = (await owner.from("inventory_stock").select("quantity_on_hand").eq("id", id(80)).single()).data!.quantity_on_hand; assert.equal(Number(afterStock), Number(beforeStock) + 1); ok("shared inventory ledger adjustment changes physical stock");
const staff = await call(owner, "save_staff_profile", { p_staff_id: null, p_organization_id: f.org, p_full_name: "QA Contact-free worker", p_email: "", p_mobile: "", p_job_function: "Housekeeper", p_specializations: [], p_is_active: true, p_branch_ids: [f.branch] });
const staffRow = await admin.from("organization_staff_profiles").select("email,mobile,membership_id").eq("id", staff).single(); assert.equal(staffRow.error, null); assert.equal(staffRow.data!.email, null); assert.equal(staffRow.data!.mobile, null); assert.equal(staffRow.data!.membership_id, null); ok("shared staff creation needs no contacts or login");
const freeReport = await other.rpc("get_hospitality_workspace", { ...reportArgs, p_org: f.otherOrg, p_branch: f.otherBranch, p_section: "rooms" }); assert.equal(freeReport.error, null); assert.ok((await other.rpc("get_hospitality_workspace", { ...reportArgs, p_org: f.otherOrg, p_branch: null, p_section: "rooms" })).error); ok("Free report scope enforced in database");
const anon = createClient(url, key); assert.ok((await anon.rpc("get_hospitality_workspace", reportArgs)).error); assert.ok((await anon.from("hospitality_stays").select("id")).error); ok("anonymous occupancy and reports denied");
assert.ok((await viewer.rpc("create_hospitality_pilot", { p_name: "Uninvited", p_branch_name: "Main", p_request: crypto.randomUUID() })).error); ok("retired pilot provisioning is not callable");
// Full aggregation beyond the visible detail page, with repeated occupancy of one room.
const totalBefore = (await call(owner, "get_hospitality_workspace", reportArgs)).finance.outstanding;
for (let n = 0; n < 51; n++) {
  const sid = await call(owner, "check_in_hospitality_paid", { ...nextArrival, p_request: crypto.randomUUID() });
  await call(owner, "add_hospitality_charge", { p_org: f.org, p_branch: f.branch, p_stay: sid, p_description: "Extra", p_quantity: 1, p_unit_centavos: 1, p_request: crypto.randomUUID() });
  await call(owner, "check_out_hospitality", { ...checkout, p_stay: sid, p_acknowledge_debt: true });
  await finishCleaning(sid);
}
const paged = await call(owner, "get_hospitality_workspace", reportArgs);
assert.equal(paged.rows.length, 50); assert.ok(paged.rowCount > 50); assert.equal(paged.finance.outstanding, totalBefore + 51); ok("report totals cover records beyond the visible 50-row page");
const stockAfterStays = (await owner.from("inventory_stock").select("quantity_on_hand").eq("id", id(80)).single()).data!.quantity_on_hand; assert.equal(stockAfterStays, afterStock); ok("check-in, charges and checkout never consume inventory automatically");
const successfulPayment = paymentsRace.find(r => !r.error)!.data;
const setTime = await admin.from("payments").update({ paid_at: `${today}T00:30:00+08:00` }).eq("id", successfulPayment); assert.equal(setTime.error, null);
const localCollections = await call(owner, "export_hospitality_workspace", { p_org: f.org, p_branch: f.branch, p_start: today, p_end: today, p_section: "collections" }); assert.ok(localCollections.rows.some((r: { payment_id: string }) => r.payment_id === successfulPayment)); ok("collections include local midnight payments on their branch date");
const noFinanceHistory = await call(owner, "get_hospitality_workspace", { ...reportArgs, p_mode: "history", p_section: "stays" }); assert.equal(noFinanceHistory.finance, undefined); ok("operational history mode never becomes a financial reporting bypass");
assert.ok((await admin.from("payments").insert({ organization_id: f.otherOrg, branch_id: f.otherBranch, invoice_id: invoice, amount_centavos: 1, method: "cash", status: "paid" })).error); ok("manual invoice payment tenant integrity survives privileged inserts");
const annex = (await owner.from("hospitality_rooms").select("rates,rates_version").eq("id", id(40)).single()).data!;
const annexStay = await call(owner, "check_in_hospitality_paid", { ...checkIn, p_branch: f.annex, p_room: id(40), p_rate: annex.rates[0].id, p_rates_version: annex.rates_version, p_tendered: annex.rates[0].priceCentavos, p_request: crypto.randomUUID() });
const annexBill = (await owner.from("hospitality_stay_bills").select("invoice_id").eq("stay_id", annexStay).single()).data!.invoice_id;
const hiddenLines = await front.from("invoice_items").select("id").eq("invoice_id", annexBill); assert.equal(hiddenLines.error, null); assert.equal(hiddenLines.data!.length, 0); ok("Core invoice line RLS respects assigned finance branches");
await call(owner, "check_out_hospitality", { ...checkout, p_branch: f.annex, p_stay: annexStay, p_acknowledge_debt: true });
await finishCleaning(annexStay, f.annex);
const exported = await call(owner, "export_hospitality_workspace", { p_org: f.org, p_branch: f.branch, p_start: today, p_end: today, p_section: "outstanding" });
assert.equal(exported.rows.length, exported.rowCount); assert.ok(exported.rows.length > 50); ok("snapshot export includes every authorized row beyond the first page");
assert.ok((await viewer.rpc("export_hospitality_workspace", { p_org: f.org, p_branch: f.branch, p_start: today, p_end: today, p_section: "collections" })).error); ok("direct export RPC enforces financial permission");
assert.ok((await other.rpc("export_hospitality_workspace", { p_org: f.otherOrg, p_branch: f.otherBranch, p_start: today, p_end: today, p_section: "rooms" })).error); ok("direct export RPC enforces paid-plan entitlement");
console.log(`${passed} local Hospitality integration checks passed.`);

}
main().catch(error => { console.error(error); process.exitCode = 1; });
