import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadAdminAttention } from "../modules/platform/admin-attention";

const membership = { organizationId: "org-a", branchId: "branch-a", branchName: "Main", role: "owner" as const, industry: "automotive" as const };
function database(options: { failed?: string; rejected?: string; empty?: boolean } = {}) {
 const calls: { table: string; method: string; args: unknown[] }[] = [];
 const db = { from(table: string) {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "gt", "lt", "lte", "in", "order", "limit"]) query[method] = (...args: unknown[]) => { calls.push({ table, method, args }); return query; };
  query.then = (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => options.rejected === table
   ? Promise.reject(new Error("Private database diagnostic")).then(resolve, reject)
   : Promise.resolve({ count: options.empty ? 0 : 2, data: [{ id: `${table}-record` }], error: options.failed === table ? { message: "private" } : null }).then(resolve, reject);
  return query;
 } } as unknown as SupabaseClient;
 return { db, calls };
}

test("attention reads use server membership scope and return direct task links", async () => {
 const { db, calls } = database(); const snapshot = await loadAdminAttention(db, membership, new Date("2026-09-16T04:00:00Z"));
 assert.equal(snapshot.total, 14); assert.equal(snapshot.items.length, 7);
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
 const cashier = database(); await loadAdminAttention(cashier.db, { ...membership, role: "cashier" }); assert.ok(cashier.calls.length > 0); assert.ok(cashier.calls.every(call => call.table === "public_product_orders"));
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
  assert.equal(snapshot.total, 12); assert.deepEqual(snapshot.unavailable, ["Messages need a reply"]); assert.equal(JSON.stringify(snapshot).includes("private"), false);
 }
 const { db } = database({ empty: true }); const snapshot = await loadAdminAttention(db, membership);
 assert.equal(snapshot.total, 0); assert.deepEqual(snapshot.items, []); assert.deepEqual(snapshot.unavailable, []);
});

test("public orders alert only for pending orders in the active branch", async () => {
 const { db, calls } = database();
 const snapshot = await loadAdminAttention(db, membership);
 assert.equal(snapshot.items.find(item => item.id === "orders")?.href, "/dashboard/products/orders");
 assert.ok(calls.some(call => call.table === "public_product_orders" && call.method === "eq" && call.args[0] === "status" && call.args[1] === "requested"));
 const unavailable = await loadAdminAttention(database({ failed: "public_product_orders" }).db, membership);
 assert.ok(unavailable.unavailable.includes("Public product orders"));
 const advisor = database(); await loadAdminAttention(advisor.db, { ...membership, role: "advisor" });
 assert.ok(advisor.calls.every(call => call.table !== "public_product_orders"));
});

test("missing order schema logs a safe diagnostic without exposing database details", async (t) => {
 const logs: unknown[][] = [];
 t.mock.method(console, "error", (...args: unknown[]) => { logs.push(args); });
 const { db, calls } = database({ failed: "public_product_orders" });
 const snapshot = await loadAdminAttention(db, membership);
 assert.ok(snapshot.unavailable.includes("Public product orders"));
 const projection = calls.find(call => call.table === "public_product_orders" && call.method === "select");
 assert.deepEqual(projection?.args, ["id", { count: "exact" }]);
 assert.ok(calls.some(call => call.table === "public_product_orders" && call.method === "limit" && call.args[0] === 1));
 assert.ok(JSON.stringify(logs).includes("dashboard.notifications.orders"));
 assert.ok(!JSON.stringify(logs).includes("private"));
 assert.ok(!JSON.stringify(snapshot).includes("private"));
});


test("reminders notify 24 hours ahead, retain overdue work, and exclude resolved reminders", async () => {
 const { db, calls } = database();
 const snapshot = await loadAdminAttention(db, membership, new Date("2026-10-06T04:00:00Z"));
 assert.equal(snapshot.items.find(item => item.id === "reminders")?.href, "/dashboard/customers/reminders?status=attention");
 const reminderCalls = calls.filter(call => call.table === "client_reminders");
 assert.ok(reminderCalls.some(call => call.method === "lte" && call.args[0] === "due_at" && call.args[1] === "2026-10-07T04:00:00.000Z"));
 assert.ok(reminderCalls.some(call => call.method === "eq" && call.args[0] === "status" && call.args[1] === "pending"));
 assert.ok(!reminderCalls.some(call => ["gt", "gte"].includes(call.method)));
 for (const role of ["owner", "manager", "advisor"] as const) {
  const result = await loadAdminAttention(database().db, { ...membership, role });
  assert.ok(result.items.some(item => item.id === "reminders"));
 }
 const failed = await loadAdminAttention(database({ failed: "client_reminders" }).db, membership);
 assert.ok(failed.unavailable.includes("Reminders due soon"));
 assert.ok(!failed.items.some(item => item.id === "reminders"));
});


test("reminder count includes the exact 24-hour boundary but excludes later, resolved, and foreign records", async () => {
 const now = new Date("2026-10-06T04:00:00Z");
 const pending = { organization_id: "org-a", branch_id: "branch-a", status: "pending" };
 const rows = [
  { ...pending, due_at: "2026-10-05T04:00:00.000Z" },
  { ...pending, due_at: "2026-10-07T04:00:00.000Z" },
  { ...pending, due_at: "2026-10-07T04:00:00.001Z" },
  { ...pending, status: "contacted", due_at: now.toISOString() },
  { ...pending, status: "cancelled", due_at: now.toISOString() },
  { ...pending, organization_id: "org-b", due_at: now.toISOString() },
  { ...pending, branch_id: "branch-b", due_at: now.toISOString() },
 ];
 const fallback = database({ empty: true }).db;
 const db = { from(table: string) {
  if (table !== "client_reminders") return fallback.from(table);
  let matches = [...rows];
  const query = {
   select() { return query; },
   eq(key: keyof typeof pending, value: string) { matches = matches.filter(row => row[key] === value); return query; },
   lte(key: "due_at", value: string) { matches = matches.filter(row => row[key] <= value); return query; },
   then(resolve: (value: unknown) => unknown) { return Promise.resolve({ count: matches.length, error: null }).then(resolve); },
  };
  return query;
 } } as unknown as SupabaseClient;
 const snapshot = await loadAdminAttention(db, membership, now);
 assert.equal(snapshot.items.find(item => item.id === "reminders")?.count, 2);
});
