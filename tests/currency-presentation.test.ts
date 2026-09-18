import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ServiceCatalogList, type CatalogService } from "../components/service-catalog";
import { parsePublicAppointmentSelfService } from "../modules/core/scheduling/appointment-self-service";
import { formatMoney } from "../lib/operations";

test("catalog respects record currency before the workspace fallback without changing amounts", () => {
  const service: CatalogService = { id: "currency-service", name: "Test service", currency: "USD", base_price_centavos: 125050, duration_minutes: 30, short_description: null, is_active: true, is_add_on: false, service_categories: null };
  const html = renderToStaticMarkup(createElement(ServiceCatalogList, { services: [service], salon: true, currency: "EUR" }));
  assert.ok(html.includes(formatMoney(125050, "USD")));
  assert.ok(!html.includes(formatMoney(125050, "PHP")));
  const legacy = renderToStaticMarkup(createElement(ServiceCatalogList, { services: [{ ...service, currency: undefined }], salon: false, currency: "EUR" }));
  assert.ok(legacy.includes(formatMoney(125050, "EUR")));
});

test("public appointment parsing preserves authoritative currency and legacy payload compatibility", () => {
  const appointment = { state: "active", businessName: "QA", currency: "USD", branchName: "Main", branchTimezone: "Asia/Manila", appointmentStatus: "confirmed", startsAt: "2026-09-18T02:00:00Z", endsAt: null, treatments: [], assignedStaff: [], paymentStatus: "partial", totalCentavos: 50000, paidCentavos: 10000 };
  const parsed = parsePublicAppointmentSelfService(appointment);
  assert.equal(parsed.state, "active");
  if (parsed.state === "active") assert.equal(parsed.currency, "USD");
  assert.doesNotThrow(() => parsePublicAppointmentSelfService({ ...appointment, currency: undefined }));
});


test("collections keep historical payment denominations separate", async () => {
  const { collectionsByCurrency } = await import("../modules/core/payments/payment-workspace");
  const common = { invoice_id:null, appointment_id:"visit", method:"cash", status:"paid", reference:null, paid_at:"2026-09-17T00:00:00Z" };
  const groups = collectionsByCurrency([
    { ...common, id:"usd", currency:"USD", amount_centavos:15000 },
    { ...common, id:"php", currency:"PHP", amount_centavos:25000 },
    { ...common, id:"void", currency:"USD", amount_centavos:90000, status:"voided" },
  ], "Asia/Manila", "PHP", new Date("2026-09-17T02:00:00Z"));
  assert.deepEqual(groups.map(({currency,collected,count,byMethod})=>({currency,collected,count,byMethod})), [
    {currency:"USD",collected:15000,count:1,byMethod:[["cash",15000]]},
    {currency:"PHP",collected:25000,count:1,byMethod:[["cash",25000]]},
  ]);
});


test("command center preserves fractional currency amounts", async () => {
  const { CommandCenter } = await import("../components/command-center/command-center");
  const html = renderToStaticMarkup(createElement(CommandCenter, {
    snapshot: { scope:{mode:"branch",organizationId:"qa",branchIds:["main"],selectedBranchId:"main",label:"Main",currency:"USD"}, metrics:[{key:"revenue_today",label:"Collected today",value:12505,valueKind:"currency"}], actions:[],operations:[],staff:[],branchPerformance:[] },
    firstName:"QA", branches:[{id:"main",name:"Main"}], todayTitle:"Today", todayDescription:"Visits", todayVerticalId:"qa-visits", staffDescription:"Staff", quickActions:[],
  }));
  assert.ok(html.includes(formatMoney(12505,"USD")));
});
