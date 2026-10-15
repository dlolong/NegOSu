import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadProductReport, productReportPage } from "../modules/core/checkout/product-report";

test("product report pagination always sends a bounded integer to the RPC", () => {
  for (const [value, expected] of [[undefined, 1], ["", 1], ["invalid", 1], ["Infinity", 1], ["-3", 1], ["2.5", 2], ["3", 3], ["10001", 10000], [["1", "2"], 1]] as const) {
    assert.equal(productReportPage(value), expected);
  }
});
test("product report reads the selected branch and preserves fractional quantities", async () => {
  const data = { sales: 1500, paid: 500, balance: 1000, rows: [{ inventory_item_id: "81000000-0000-4000-8000-000000000001", name: "Oil", unit: "litre", sold: 1.5, sales: 1500, included: 0, handed_over: 1, returned: 0 }] };
  const calls: unknown[] = [];
  const db = { rpc: async (...args: unknown[]) => { calls.push(args); return { data, error: null }; } } as unknown as SupabaseClient;
  assert.deepEqual(await loadProductReport(db, "active-branch", 2), data);
  assert.deepEqual(calls, [["get_checkout_product_report", { p_branch: "active-branch", p_page: 2 }]]);
});
test("missing product RPC retains diagnostic code without exposing database messages", async () => {
  const error = { code: "PGRST202", message: "private database diagnostic" };
  const db = { rpc: async () => ({ data: null, error }) } as unknown as SupabaseClient;
  await assert.rejects(loadProductReport(db, "branch", 1), (failure: Error) => {
    assert.equal(failure.message, "Unable to load product sales. Please try again.");
    assert.equal(failure.cause, error);
    return true;
  });
});
test("empty reports render normally while invalid data and permission failures fail closed", async () => {
  const empty = { sales: 0, paid: 0, balance: 0, rows: [] };
  const db = { rpc: async () => ({ data: empty, error: null }) } as unknown as SupabaseClient;
  assert.deepEqual(await loadProductReport(db, "branch", 1), empty);
  for (const response of [{ data: null, error: { code: "42501" } }, { data: { ...empty, rows: null }, error: null }, { data: { ...empty, sales: -1 }, error: null }]) {
    const invalid = { rpc: async () => response } as unknown as SupabaseClient;
    await assert.rejects(loadProductReport(invalid, "branch", 1), /Unable to load product sales/);
  }
});
