import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadAdminAttention } from "../modules/platform/admin-attention";

const membership = { organizationId: "org-a", branchId: "branch-a", branchName: "Main", role: "owner" as const, industry: "automotive" as const };
function database(options: { failed?: string; rejected?: string; empty?: boolean } = {}) {
 const calls: { table: string; method: string; args: unknown[] }[] = [];
 const db = { from(table: string) {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "gt", "lt", "in", "order", "limit"]) query[method] = (...args: unknown[]) => { calls.push({ table, method, args }); return query; };
  query.then = (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => options.rejected === table
   ? Promise.reject(new Error("Private database diagnostic")).then(resolve, reject)
   : Promise.resolve({ count: options.empty ? 0 : 2, data: [{ id: `${table}-record` }], error: options.failed === table ? { message: "private" } : null }).then(resolve, reject);
  return query;
 } } as unknown as SupabaseClient;
 return { db, calls };
}

test("attention reads use server membership scope and return direct task links", async () => {
 const { db, calls } = database(); const snapshot = await loadAdminAttention(db, membership, new Date("2026-09-16T04:00:00Z"));
 assert.equal(snapshot.total, 10); assert.equal(snapshot.items.length, 5);
 for (const table of new Set(calls.map(call => call.table))) {
  assert.ok(calls.some(call => call.table === table && call.method === "eq" && call.args[0] === "organization_id" && call.args[1] === "org-a"));
  assert.ok(calls.some(call => call.table === table && call.method === "eq" && call.args[0] === "branch_id" && call.args[1] === "branch-a"));
 }
 assert.equal(snapshot.items.find(item => item.id === "appointments")?.href, "/dashboard/appointments/appointments-record");
 assert.equal(snapshot.items.find(item => item.id === "jobs")?.href, "/dashboard/jobs/job_orders-record");
 assert.ok(calls.some(call => call.table === "customer_conversations" && call.method === "gt" && call.args[0] === "expires_at"));
 assert.ok(calls.some(call => call.table === "customer_conversations" && call.method === "eq" && call.args[0] === "needs_reply" && call.args[1] === true));
});
test("roles cannot query or receive categories they cannot manage", async () => {
 const viewer = database(); assert.equal((await loadAdminAttention(viewer.db, { ...membership, role: "viewer" })).total, 0); assert.equal(viewer.calls.length, 0);
 const cashier = database(); await loadAdminAttention(cashier.db, { ...membership, role: "cashier" }); assert.equal(cashier.calls.length, 0);
 const advisor = database(); const snapshot = await loadAdminAttention(advisor.db, { ...membership, role: "advisor" });
 assert.equal(snapshot.items.some(item => item.id === "stock"), false); assert.equal(advisor.calls.some(call => call.table === "inventory_stock"), false);
});
test("all industries share common alerts and Pet Care gets its own detail route", async () => {
 for (const industry of ["salon", "pet_care"] as const) {
  const { db, calls } = database(); const snapshot = await loadAdminAttention(db, { ...membership, industry });
  assert.equal(snapshot.items.some(item => item.id === "jobs"), false); assert.equal(calls.some(call => call.table === "job_orders"), false);
  assert.equal(snapshot.items.find(item => item.id === "appointments")?.href, industry === "pet_care" ? "/dashboard/pet-care/appointments/appointments-record" : "/dashboard/appointments/appointments-record");
 }
});
test("one unavailable source preserves other alerts without claiming all clear", async () => {
 for (const mode of ["failed", "rejected"] as const) {
  const { db } = database({ [mode]: "customer_conversations" }); const snapshot = await loadAdminAttention(db, membership);
  assert.equal(snapshot.total, 8); assert.deepEqual(snapshot.unavailable, ["Messages need a reply"]); assert.equal(JSON.stringify(snapshot).includes("private"), false);
 }
 const { db } = database({ empty: true }); const snapshot = await loadAdminAttention(db, membership);
 assert.equal(snapshot.total, 0); assert.deepEqual(snapshot.items, []); assert.deepEqual(snapshot.unavailable, []);
});
