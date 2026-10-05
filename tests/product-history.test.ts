import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadProductHistory, productHistoryTab } from "../modules/core/commerce/product-history";
function database() {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const query: Record<string, unknown> = {};
  for (const method of ["from", "select", "ilike", "gte", "lt", "eq", "is", "or", "in", "order", "range"]) query[method] = (...args: unknown[]) => { calls.push({ method, args }); return query; };
  return { db: query as unknown as SupabaseClient, calls };
}
const scope = { organizationId: "tenant", branchId: "branch" };
test("usage and replenishment history remain scoped to the selected product and branch", () => {
  for (const tab of ["usage", "stock"] as const) {
    const { db, calls } = database(); loadProductHistory(db, scope, "product", tab, 2);
    for (const [column,value] of [["organization_id", "tenant"], ["branch_id", "branch"], ["inventory_item_id", "product"]]) assert.ok(calls.some(c => c.method === "eq" && c.args[0] === column && c.args[1] === value));
    assert.deepEqual(calls.find(c => c.method === "in")?.args, ["movement_type", tab === "stock" ? ["purchase"] : ["usage", "consume", "waste", "return"]]);
    assert.deepEqual(calls.find(c => c.method === "range")?.args, [20, 40]);
  }
});
test("purchase history uses protected checkouts and excludes draft or removed products", () => {
  const { db, calls } = database(); loadProductHistory(db, scope, "product", "purchases", 1);
  for (const [column,value] of [["checkouts.organization_id", "tenant"], ["checkouts.branch_id", "branch"], ["inventory_item_id", "product"]]) assert.ok(calls.some(c => c.method === "eq" && c.args[0] === column && c.args[1] === value));
  assert.deepEqual(calls.find(c => c.method === "is")?.args, ["removed_at", null]);
  assert.deepEqual(calls.find(c => c.method === "or")?.args, ["invoice_id.not.is.null,and(included_key.not.is.null,handed_over.gt.0)"]);
  assert.match(String(calls.find(c => c.method === "select")?.args[0]), /checkouts!inner/);
});
test("history tab accepts only supported views", () => {
  assert.equal(productHistoryTab("purchases"), "purchases");
  assert.equal(productHistoryTab("stock"), "stock");
  assert.equal(productHistoryTab("all"), "usage");
  assert.equal(productHistoryTab(), "usage");
});
test("product purchase filters search customers before paginating", () => {
  const { db, calls } = database(); loadProductHistory(db, scope, "product", "purchases", 2, {q:"Ana",from:"2026-10-01",to:"2026-10-05"});
  assert.deepEqual(calls.find(c=>c.method==="ilike")?.args,["checkouts.customer_name","%Ana%"]);
  assert.deepEqual(calls.find(c=>c.method==="lt")?.args,["created_at","2026-10-06T00:00:00.000Z"]);
  assert.ok(calls.findIndex(c=>c.method==="ilike") < calls.findIndex(c=>c.method==="range"));
});
