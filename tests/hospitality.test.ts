import assert from "node:assert/strict";
import test from "node:test";
import { billStatus, canHospitality, cashChange, chargeCentavos, checkInInput, roomRatesInput, stayPackages, roomInput, type Bill } from "../modules/hospitality/contracts";
import { resolveIndustryConfig } from "../modules/platform/industry";
import { navigationForIndustry } from "../modules/platform/navigation";
import { visiblePlanFeatureLabels } from "../modules/platform/plan-catalog";
import { dashboardBackDestination } from "../lib/dashboard-back-navigation";
import { csvCell } from "../lib/reporting";

test("hospitality enables applicable Core capabilities without appointments or reservations", () => {
  const c = resolveIndustryConfig("hospitality");
  assert.equal(c.productName, "NegOSu Apartelle & Inn");
  assert.equal(c.terminology.customer, "Guest");
  for (const key of ["inventory", "payments", "reports"] as const) assert.equal(c.features[key], true);
  for (const key of ["appointments", "vehicles", "job_orders", "reservations", "booking_requests", "queue", "resources"] as const) assert.equal(c.features[key], false);
  assert.deepEqual(navigationForIndustry(c, "owner").slice(0, 7).map(n => n.label), ["Overview", "Rooms", "Guests", "Payments", "Inventory", "Reports", "Staff"]);
  const viewer = navigationForIndustry(c, "viewer");
  assert.equal(viewer.some(n => n.key === "payments" || n.key === "inventory"), false);
});
test("stay financial status distinguishes absent charges, confirmed zero, partial and settled", () => {
  const bill = { id: "bill", invoice_number: "BILL", customer_name_snapshot: "Guest", status: "paid", total_centavos: 0, paid_centavos: 0, balance_centavos: 0 } satisfies Bill;
  assert.equal(billStatus(null), "No charges recorded");
  assert.equal(billStatus(bill), "Zero charge");
  assert.equal(billStatus({ ...bill, total_centavos: 100, balance_centavos: 100 }), "Unpaid");
  assert.equal(billStatus({ ...bill, total_centavos: 100, paid_centavos: 50, balance_centavos: 50 }), "Partially paid");
  assert.equal(billStatus({ ...bill, total_centavos: 100, paid_centavos: 100 }), "Paid");
});
test("manual charges use exact centavos and reject invalid or excessive input", () => {
  assert.equal(chargeCentavos("123.45"), 12345);
  assert.equal(chargeCentavos("", true), null);
  assert.equal(chargeCentavos("0"), 0);
  for (const input of ["", "-1", "NaN", "1.001", "1e3", "100000000.01"]) assert.throws(() => chargeCentavos(input));
});
test("hospitality access follows existing roles with no financial access for operational viewers", () => {
  assert.equal(canHospitality("advisor", "operate"), true);
  assert.equal(canHospitality("advisor", "financeWrite"), false);
  assert.equal(canHospitality("cashier", "financeWrite"), true);
  assert.equal(canHospitality("cashier", "operate"), true);
  for (const role of ["viewer", "technician"]) assert.equal(canHospitality(role, "financeRead"), false);
});
test("server form contracts validate identifiers, capacity and bounded text", () => {
  assert.equal(roomInput.safeParse({ id: "", name: " 101 ", roomType: "", description: "", capacity: 0, active: true }).success, false);
  assert.equal(checkInInput.safeParse({ roomId: "fake", guestId: "fake", occupants: 1, notes: "", requestKey: "fake", amount: "" }).success, false);
});
test("hospitality plan copy advertises only implemented reporting and exports remain formula-safe", () => {
  assert.deepEqual(visiblePlanFeatureLabels("hospitality", { public_page: true, reminders: true, advanced_reports: true }), ["Detailed reports and CSV exports"]);
  assert.equal(csvCell("=HYPERLINK(A1)"), "'=HYPERLINK(A1)");
  assert.equal(csvCell("Guest, name"), '"Guest, name"');
});

test("stay and statement deep links have stable parent navigation", () => {
  assert.deepEqual(dashboardBackDestination("/dashboard/hospitality/stays/123", false, "hospitality"), { href: "/dashboard/hospitality/rooms", label: "Back to rooms" });
  assert.deepEqual(dashboardBackDestination("/dashboard/hospitality/stays/123/receipt", false, "hospitality"), { href: "/dashboard/hospitality/stays/123?tab=charges", label: "Back to stay" });
  assert.equal(dashboardBackDestination("/dashboard/customers/123", false, "hospitality")?.label, "Back to guests");
});


test("cashier uses configured stay periods and records net payment separately from change", () => {
  assert.deepEqual(stayPackages.map(p => p.durationMinutes), [180, 360, 720, 1440, 10080]);
  assert.equal(cashChange(80000, 100000), 20000);
  assert.equal(cashChange(80000, 80000), 0);
  assert.equal(canHospitality("cashier", "checkIn"), true);
  assert.equal(canHospitality("cashier", "rooms"), false);
  assert.equal(canHospitality("advisor", "checkIn"), false);
  const rate = { id: "b9600000-0000-4000-8000-000000000201", label: "3 hours", durationMinutes: 180, priceCentavos: 80000 };
  assert.equal(roomRatesInput.safeParse([rate]).success, true);
  assert.equal(roomRatesInput.safeParse([{ ...rate, priceCentavos: -1 }]).success, false);
  assert.equal(roomRatesInput.safeParse([rate, rate]).success, false);
  assert.equal(roomRatesInput.safeParse([{ ...rate, durationMinutes: 240 }]).success, false);
  assert.equal(checkInInput.safeParse({ roomId: rate.id, rateId: rate.id, ratesVersion: 1, guestId: "", guestName: "", occupants: 1, notes: "", requestKey: rate.id, tendered: "1000", method: "cash", reference: "" }).success, true);
});

test("housekeeping can release cleaned rooms without finance or rate editing access", () => {
  assert.equal(canHospitality("technician", "housekeeping"), true);
  assert.equal(canHospitality("technician", "rooms"), false);
  assert.equal(canHospitality("technician", "checkIn"), false);
  assert.equal(canHospitality("technician", "financeRead"), false);
  assert.equal(canHospitality("viewer", "housekeeping"), false);
});
