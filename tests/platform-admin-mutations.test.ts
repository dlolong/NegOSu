import test from "node:test";
import assert from "node:assert/strict";
import { parseAdminMutation, priceCentavos, adminMutationError } from "../modules/platform/admin-mutations";
import { presentLivePlans, formatPlanPrice } from "../modules/platform/plan-catalog";
const id = "99100000-0000-4000-8000-000000000001";
const base = { action: "update_plan", target: "starter", requestId: id, expected: "0", reason: "Annual catalog update", name: "Starter Plus", monthly: "599.99", yearly: "5999.50" };

test("admin price input converts decimal pesos exactly and rejects invalid money", () => {
 assert.equal(priceCentavos("599.99"), 59999);
 assert.equal(priceCentavos("0.01"), 1);
 for (const value of ["-1", "1e3", "NaN", "1.001", "10000000.01", "", " 1"]) assert.equal(priceCentavos(value), null);
 const parsed = parseAdminMutation(base);
 assert.ok("input" in parsed);
 assert.deepEqual(parsed.values, { name: "Starter Plus", monthly: 59999, yearly: 599950 });
 assert.ok("error" in parseAdminMutation({ ...base, reason: "" }));
 assert.ok("error" in parseAdminMutation({ ...base, expected: "" }));
});
test("deletion requires the exact target UUID confirmation", () => {
 const input = { ...base, action: "delete_user", target: id };
 assert.ok("error" in parseAdminMutation(input));
 assert.ok("error" in parseAdminMutation({ ...input, confirmation: "DELETE someone-else" }));
 assert.ok("input" in parseAdminMutation({ ...input, confirmation: `DELETE ${id}` }));
 assert.ok("error" in parseAdminMutation({ ...input, target: "forged" }));
});
test("manual access validates status, plan, UTC expiry and stale-version token", () => {
 const input = { ...base, action: "update_subscription", target: id, expected: "2026-09-24T00:00:00+00:00", status: "active", planId: "starter", expiresAt: "2099-01-01T12:00" };
 const parsed = parseAdminMutation(input);
 assert.ok("input" in parsed);
 assert.equal(parsed.values?.expiresAt, "2099-01-01T12:00:00Z");
 for (const extra of [{ expiresAt: "2020-01-01T12:00" }, { expiresAt: "2099-02-31T12:00" }, { status: "hacked" }, { status: "free", planId: "starter" }, { status: "active", planId: "free" }, { expected: "" }]) assert.ok("error" in parseAdminMutation({ ...input, ...extra }));
});
test("admin errors do not leak raw database diagnostics", () => {
 assert.ok(!adminMutationError({ message: "private SQL diagnostics" }).includes("private"));
 assert.match(adminMutationError({ code: "23503" }), /referenced/);
 assert.match(adminMutationError({ code: "40001" }), /changed/);
});
test("public catalog uses edited names and prices while retaining feature descriptions", () => {
 const plans = presentLivePlans([{ id: "starter", name: "Starter Plus", monthly_price_centavos: 59999, yearly_price_centavos: 599950, is_custom: false }]);
 assert.equal(plans[0].name, "Starter Plus");
 assert.equal(plans[0].monthlyPriceCentavos, 59999);
 assert.equal(plans[0].yearlyPriceCentavos, 599950);
 assert.ok(plans[0].highlights.length > 0);
 assert.match(formatPlanPrice(59999), /599\.99/);
 assert.deepEqual(presentLivePlans([]), []);
});
