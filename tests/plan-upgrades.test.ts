import assert from "node:assert/strict";
import test from "node:test";
import { loadPlanUpgrades } from "../lib/billing/upgrades";
import { resolveUpgradeState, selectUpgrade, upgradeDestination } from "../modules/platform/plan-upgrades";

const plans = ["free", "starter", "business", "pro", "multi_branch"].map((id, index) => ({
  id, name: id, is_active: true, sort_order: index * 10,
  limits: { staff: [2, 5, 15, 50, -1][index], branches: [1, 1, 2, 5, -1][index], monthly_jobs: [30, 250, 1000, 5000, -1][index] },
  features: { advanced_reports: index > 0, public_page: index > 1, reminders: index > 1 },
}));
function entitlements(index: number) { return { planId: plans[index].id, planName: plans[index].name, limits: plans[index].limits, features: plans[index].features }; }
function state(index = 0) { return resolveUpgradeState(entitlements(index), plans); }

for (const index of [0, 1, 2, 3]) test(`plan ${plans[index].id} sees only strictly higher plans`, () => {
  assert.deepEqual(state(index)?.higherPlans.map(p => p.id), plans.slice(index + 1).map(p => p.id));
  assert.equal(selectUpgrade(state(index), "hospitality", "staff", true)?.plan.id, plans[index + 1].id);
});
test("highest plan and unknown plans have no upgrade prompt", () => {
  assert.equal(state(4), null);
  assert.equal(resolveUpgradeState({ ...entitlements(0), planId: "unknown" }, plans), null);
  assert.equal(selectUpgrade(null, "automotive", "staff", true), null);
});
test("inactive, equal-rank and lower plans are never recommended", () => {
  const catalog = plans.map(p => p.id === "starter" ? { ...p, is_active: false } : p);
  catalog.push({ ...plans[0], id: "same-rank" });
  assert.equal(resolveUpgradeState(entitlements(0), catalog)?.higherPlans[0].id, "business");
  assert.equal(resolveUpgradeState(entitlements(0), [plans[0], { ...plans[1], is_active: false }]), null);
});
test("sorting comes from live catalog rather than price or marketing rank", () => {
  const catalog = [...plans].reverse().map(p => p.id === "starter" ? { ...p, sort_order: 25 } : p);
  assert.equal(resolveUpgradeState(entitlements(0), catalog)?.higherPlans[0].id, "business");
});
for (const industry of ["automotive", "salon", "pet_care", "hospitality"] as const) test(`${industry} has relevant report and login-capacity upgrades`, () => {
  assert.equal(selectUpgrade(state(), industry, "advanced_reports")?.plan.id, "starter");
  assert.equal(selectUpgrade(state(), industry, "staff", true)?.plan.id, "starter");
  assert.equal(selectUpgrade(state(), industry, "branches", true)?.plan.id, "business");
  assert.match(selectUpgrade(state(), industry, "staff", true)!.description, /staff logins/);
});
test("feature prompt skips plans that do not enable the feature and disappears when entitled", () => {
  assert.equal(selectUpgrade(state(), "salon", "public_page")?.plan.id, "business");
  assert.equal(selectUpgrade(state(2), "salon", "public_page"), null);
  assert.equal(selectUpgrade(state(1), "automotive", "advanced_reports"), null);
});
test("unsupported vertical capabilities are never advertised", () => {
  for (const feature of ["public_page", "reminders", "monthly_jobs"] as const) assert.equal(selectUpgrade(state(), "hospitality", feature), null);
  for (const industry of ["salon", "pet_care"] as const) assert.equal(selectUpgrade(state(), industry, "monthly_jobs", true), null);
});
test("unlimited and missing limits never fabricate quota restrictions", () => {
  assert.equal(selectUpgrade(resolveUpgradeState({ ...entitlements(0), limits: { staff: -1 } }, plans), "automotive", "staff", true), null);
  assert.equal(selectUpgrade(resolveUpgradeState({ ...entitlements(0), limits: {} }, plans), "automotive", "staff", true), null);
  assert.equal(selectUpgrade(state(3), "automotive", "staff", true)?.plan.id, "multi_branch");
});
test("missing flags never assume a paid feature is blocked", () => {
  assert.equal(selectUpgrade(resolveUpgradeState({ ...entitlements(0), features: {} }, plans), "salon", "public_page"), null);
});
for (const value of [null, {}, { ...entitlements(0), limits: { staff: "2" } }]) test(`invalid effective entitlements omit upgrades: ${JSON.stringify(value)}`, () => {
  assert.equal(resolveUpgradeState(value, plans), null);
});
test("malformed catalogs fail safely", () => {
  assert.equal(resolveUpgradeState(entitlements(0), null), null);
  assert.equal(resolveUpgradeState(entitlements(0), [{ ...plans[0], sort_order: "0" }]), null);
});
test("owner links use protected billing; staff use public comparison", () => {
  assert.equal(upgradeDestination("business", true), "/dashboard/settings/billing#billing-plan-business");
  assert.equal(upgradeDestination("business", false), "/plans");
});

function client({ entitlementError = false, catalogError = false, rejects = false, data = entitlements(0) as unknown } = {}) {
  const calls: unknown[] = [];
  const db = {
    rpc(name: string, args: unknown) { calls.push([name, args]); return rejects ? Promise.reject(new Error("offline")) : Promise.resolve({ data, error: entitlementError ? { code: "42501" } : null }); },
    from(table: string) { calls.push(table); return { select(columns: string) { calls.push(columns); return { eq(key: string, value: boolean) { calls.push([key, value]); return { order() { return Promise.resolve({ data: plans, error: catalogError ? { code: "PGRST202" } : null }); } }; } }; } }; },
  };
  return { db: db as unknown as Parameters<typeof loadPlanUpgrades>[0], calls };
}
test("loader scopes entitlements to the selected organization and reads public plan fields only", async () => {
  const { db, calls } = client();
  assert.equal((await loadPlanUpgrades(db, "org-selected"))?.current.planId, "free");
  assert.deepEqual(calls[0], ["get_org_entitlements", { p_organization_id: "org-selected" }]);
  assert.deepEqual(calls[3], ["is_active", true]);
  assert.ok(!JSON.stringify(calls).includes("provider"));
});
for (const options of [{ entitlementError: true }, { catalogError: true }, { rejects: true }, { data: null }]) test(`loader failure never becomes Free or blocks operations: ${JSON.stringify(options)}`, async () => {
  assert.equal(await loadPlanUpgrades(client(options).db, "org-selected"), null);
});
test("concurrent organizations do not share effective plan data", async () => {
  const [first, second] = await Promise.all([loadPlanUpgrades(client().db, "org-a"), loadPlanUpgrades(client({ data: entitlements(2) }).db, "org-b")]);
  assert.equal(first?.current.planId, "free");
  assert.equal(second?.current.planId, "business");
});

test("capacity prompts stay hidden until the limit is reached", () => {
  for (const capability of ["staff", "branches", "monthly_jobs"] as const) {
    assert.equal(selectUpgrade(state(), "automotive", capability), null);
    assert.notEqual(selectUpgrade(state(), "automotive", capability, true), null);
  }
});

import { planErrorMessage, planErrorCapability } from "../lib/billing/plan-errors";
import { normalizeActionError } from "../lib/errors/action-error";
test("only exact known plan errors receive safe contextual upgrade guidance", () => {
  for (const [message, capability] of [["Branch limit reached", "branches"], ["Staff limit reached", "staff"], ["Monthly job limit reached", "monthly_jobs"], ["Public page requires an eligible plan", "public_page"], ["Reminders require an eligible plan", "reminders"]]) {
    const safe = planErrorMessage({ message });
    assert.ok(safe);
    assert.equal(planErrorCapability(safe), capability);
    assert.equal(normalizeActionError({ message }, "Fallback"), safe);
  }
  for (const message of ["permission denied", "Staff limit reached: private SQL details", "Unknown plan error", "toString", "constructor"]) {
    assert.equal(planErrorMessage({ message }), undefined);
    assert.equal(planErrorCapability(message), undefined);
    assert.equal(normalizeActionError({ message }, "Fallback"), "Fallback");
  }
});
