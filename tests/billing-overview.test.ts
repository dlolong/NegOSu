import assert from "node:assert/strict";
import test from "node:test";
import { loadBillingOverview } from "../lib/billing/overview";

const starter = { id: "starter", name: "Starter", monthly_price_centavos: 49900, yearly_price_centavos: 499000, limits: { staff: 5, branches: 1 }, features: {} };
const config = { id: "starter", is_custom: false, provider_monthly_price_id: "price_month", provider_yearly_price_id: "price_year" };
const effective = { planId: "free", planName: "Free", graceEndsAt: null };
type Result = { data: unknown; error: { code: string } | null };
function client(overrides: Partial<Record<"catalog" | "subscription" | "configuration" | "entitlements", Result>> = {}) {
  const responses = { catalog: { data: [starter], error: null }, subscription: { data: null, error: null }, configuration: { data: [config], error: null }, entitlements: { data: effective, error: null }, ...overrides };
  const filters: unknown[] = [];
  const db = {
    from(table: string) { return { select(columns: string) {
      const result = table === "organization_subscriptions" ? responses.subscription : columns.includes("is_custom") ? responses.configuration : responses.catalog;
      const query = { eq(key: string, value: string | boolean) { filters.push([table, key, value]); return query; }, order() { return Promise.resolve(result); }, maybeSingle() { return Promise.resolve(result); }, then: Promise.resolve(result).then.bind(Promise.resolve(result)) };
      return query;
    } }; },
    rpc(name: string, args: unknown) { filters.push([name, args]); return Promise.resolve(responses.entitlements); },
  };
  return { db: db as unknown as Parameters<typeof loadBillingOverview>[0], filters };
}

test("missing billing migration preserves catalog/subscription reads and disables payments", async () => {
  const { db, filters } = client({ configuration: { data: null, error: { code: "42703" } }, entitlements: { data: null, error: { code: "PGRST202" } } });
  const result = await loadBillingOverview(db, "org-a");
  assert.equal(result.plans.length, 1);
  assert.equal(result.catalogUnavailable, false);
  assert.equal(result.subscriptionUnavailable, false);
  assert.equal(result.paymentSetupAvailable, false);
  assert.equal(result.effective, null);
  assert.equal(result.plans[0].provider_monthly_price_id, null);
  assert.ok(filters.some(item => JSON.stringify(item) === JSON.stringify(["organization_subscriptions", "organization_id", "org-a"])));
  assert.ok(filters.some(item => JSON.stringify(item) === JSON.stringify(["get_org_entitlements", { p_organization_id: "org-a" }])));
});
test("configured matching plans retain their provider intervals", async () => {
  const result = await loadBillingOverview(client().db, "org-a");
  assert.equal(result.paymentSetupAvailable, true);
  assert.equal(result.plans[0].provider_monthly_price_id, "price_month");
  assert.equal(result.plans[0].provider_yearly_price_id, "price_year");
});
test("catalog drift disables only the affected plan without hiding subscription data", async () => {
  const result = await loadBillingOverview(client({ catalog: { data: [{ ...starter, monthly_price_centavos: 12300 }], error: null } }).db, "org-a");
  assert.equal(result.catalogUnavailable, false);
  assert.equal(result.plans[0].monthly_price_centavos, 12300);
  assert.equal(result.plans[0].matchesCatalog, false);
  assert.equal(result.plans[0].provider_monthly_price_id, null);
  assert.deepEqual(result.effective, effective);
});
test("subscription failure cannot become a free account or allow payment actions", async () => {
  const result = await loadBillingOverview(client({ subscription: { data: null, error: { code: "42501" } } }).db, "org-a");
  assert.equal(result.subscriptionUnavailable, true);
  assert.equal(result.paymentSetupAvailable, false);
  assert.equal(result.plans.length, 1);
});
test("catalog failure is isolated from current subscription and entitlements", async () => {
  const result = await loadBillingOverview(client({ catalog: { data: null, error: { code: "42501" } } }).db, "org-a");
  assert.equal(result.catalogUnavailable, true);
  assert.deepEqual(result.plans, []);
  assert.deepEqual(result.effective, effective);
});
test("an empty catalog is not treated as a failed request", async () => {
  const result = await loadBillingOverview(client({ catalog: { data: [], error: null } }).db, "org-a");
  assert.equal(result.catalogUnavailable, false);
  assert.deepEqual(result.plans, []);
});
for (const error of [{ code: "42501" }, { code: "PGRST202" }, null]) test(`unavailable entitlements never fabricate access (${error?.code ?? "null payload"})`, async () => {
  const result = await loadBillingOverview(client({ entitlements: { data: null, error } }).db, "org-a");
  assert.equal(result.effective, null);
  assert.equal(result.paymentSetupAvailable, false);
  assert.equal(result.plans[0].provider_yearly_price_id, null);
});
