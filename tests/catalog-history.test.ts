import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { catalogHistoryTab, loadCatalogHistory } from "../modules/core/commerce/catalog-history";
function capture() {
  const calls: { method: string; args: unknown[] }[] = [];
  const db: Record<string, unknown> = {};
  for (const method of ["from", "select", "ilike", "gte", "lt", "eq", "neq", "in", "order", "range"]) db[method] = (...args: unknown[]) => { calls.push({ method, args }); return db; };
  return { db: db as unknown as SupabaseClient, calls };
}
const scope = { organizationId: "tenant", branchId: "branch", industry: "salon" };
test("catalog histories isolate tenant, branch, and selected service or promo", () => {
  for (const kind of ["service", "promo"] as const) for (const tab of ["usage", "purchases"] as const) {
    const { db, calls } = capture(); loadCatalogHistory(db, scope, kind, "item", tab, 2);
    for (const [field, value] of [["organization_id", "tenant"], ["branch_id", "branch"]]) assert.ok(calls.some(c => c.method === "eq" && c.args[0] === field && c.args[1] === value));
    const relation = kind === "promo" ? "appointment_promo_snapshots" : "appointment_services";
    const key = kind === "promo" ? "promo_id" : "service_id";
    assert.ok(calls.some(c => c.method === "eq" && c.args[0] === `${tab === "purchases" ? "appointments." : ""}${relation}.${key}` && c.args[1] === "item"));
    assert.deepEqual(calls.find(c => c.method === "range")?.args, [20, 40]);
    // Select parent visits/payments so multiple component services never multiply history records.
    assert.deepEqual(calls.find(c => c.method === "from")?.args, [tab === "usage" ? "appointments" : "payments"]);
  }
});
test("purchase history excludes pending payments and retains refunds and voids", () => {
  const { db, calls } = capture(); loadCatalogHistory(db, scope, "promo", "item", "purchases", 1);
  assert.deepEqual(calls.find(c => c.method === "in")?.args, ["status", ["paid", "refunded", "voided"]]);
});
test("automotive purchases use billed service lines and exclude drafts", () => {
  const { db, calls } = capture(); loadCatalogHistory(db, { ...scope, industry: "automotive" }, "service", "item", "purchases", 1);
  assert.deepEqual(calls.find(c => c.method === "from")?.args, ["invoice_items"]);
  assert.deepEqual(calls.find(c => c.method === "neq")?.args, ["invoices.status", "draft"]);
  for (const [field, value] of [["invoices.organization_id", "tenant"], ["invoices.branch_id", "branch"], ["service_id", "item"]]) assert.ok(calls.some(c => c.method === "eq" && c.args[0] === field && c.args[1] === value));
});
test("unsupported history tabs safely use appointment history", () => {
  assert.equal(catalogHistoryTab("purchases"), "purchases");
  assert.equal(catalogHistoryTab("invalid"), "usage");
  assert.equal(catalogHistoryTab(), "usage");
});
test("automotive promo purchases scope the invoice and its originating job and appointment", () => {
  const { db, calls } = capture(); loadCatalogHistory(db, { ...scope, industry: "automotive" }, "promo", "offer", "purchases", 1);
  assert.deepEqual(calls.find(c => c.method === "from")?.args, ["invoices"]);
  for (const prefix of ["", "job_orders.", "job_orders.appointments."]) for (const [field, value] of [["organization_id", "tenant"], ["branch_id", "branch"]]) assert.ok(calls.some(c => c.method === "eq" && c.args[0] === `${prefix}${field}` && c.args[1] === value));
  assert.ok(calls.some(c => c.method === "eq" && c.args[0] === "job_orders.appointments.appointment_promo_snapshots.promo_id" && c.args[1] === "offer"));
  assert.deepEqual(calls.find(c => c.method === "neq")?.args, ["status", "draft"]);
});
test("customer and date searches constrain the database query before pagination", () => {
  const { db, calls } = capture();
  loadCatalogHistory(db, scope, "promo", "offer", "purchases", 2, {q:"Ana%",from:"2026-10-01",to:"2026-10-05"});
  assert.deepEqual(calls.find(c=>c.method==="ilike")?.args,["appointments.customers.full_name","%Ana\\%%"]);
  assert.deepEqual(calls.find(c=>c.method==="gte")?.args,["paid_at","2026-10-01T00:00:00Z"]);
  assert.deepEqual(calls.find(c=>c.method==="lt")?.args,["paid_at","2026-10-06T00:00:00.000Z"]);
  assert.ok(String(calls.find(c=>c.method==="select")?.args[0]).includes("customers!inner"));
  assert.ok(calls.findIndex(c=>c.method==="ilike") < calls.findIndex(c=>c.method==="range"));
});
