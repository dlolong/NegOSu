import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientPurchaseQuerySchema, clientPurchaseReportSchema, loadClientPurchaseReport } from "../modules/core/reporting/client-purchase-report";
import { resolveReportsView } from "../modules/core/reporting/report-view";

const branch = "81000000-0000-4000-8000-000000000001";
const membership = { organizationId: "81000000-0000-4000-8000-000000000002", timezone: "Asia/Manila", branches: [{ id: branch }] };
const empty = { count: 0, summary: { records: 0, total: 0, paid: 0, balance: 0 }, rows: [] };
test("client purchase filters validate dates, page, branch and bounded searches", () => {
  assert.equal(clientPurchaseQuerySchema.parse({}).preset, "month");
  assert.equal(clientPurchaseQuerySchema.parse({ q: "  Ann  ", page: "2" }).q, "Ann");
  for (const filters of [{ preset: "custom" }, { preset: "custom", start: "2026-01-03", end: "2026-01-02" }, { preset: "custom", start: "2020-01-01", end: "2026-01-01" }, { start: "2026-02-30" }, { page: "1.5" }, { page: "0" }, { kind: "parts" }, { branch: "foreign" }, { q: "x".repeat(121) }, { item: "x".repeat(121) }, { q: ["ambiguous", "query"] }]) {
    assert.equal(clientPurchaseQuerySchema.safeParse(filters).success, false, JSON.stringify(filters));
  }
});
test("reader sends scoped filters to the server and accepts an empty report", async () => {
  const calls: unknown[] = [];
  const db = { rpc: async (...args: unknown[]) => { calls.push(args); return { data: empty, error: null }; } } as unknown as SupabaseClient;
  const filters = clientPurchaseQuerySchema.parse({ preset: "custom", start: "2026-01-01", end: "2026-01-31", branch, kind: "product", q: "Ann", item: "Oil", page: "2" });
  assert.deepEqual((await loadClientPurchaseReport(db, membership, filters)).report, empty);
  assert.deepEqual(calls, [["get_client_purchase_report", { p_organization_id: membership.organizationId, p_start_date: "2026-01-01", p_end_date: "2026-01-31", p_branch_id: branch, p_client_search: "Ann", p_item_search: "Oil", p_kind: "product", p_page: 2 }]]);
  calls.length = 0;
  await loadClientPurchaseReport(db, membership, { ...filters, branch: "all" });
  assert.equal((calls[0] as [string, { p_branch_id: unknown }])[1].p_branch_id, null);
});
test("unavailable branches fail before a report is requested", async () => {
  const db = { rpc: () => { assert.fail("must not call database"); } } as unknown as SupabaseClient;
  await assert.rejects(loadClientPurchaseReport(db, membership, clientPurchaseQuerySchema.parse({ branch: "81000000-0000-4000-8000-000000000099" })), /Branch access required/);
});
test("permission errors and malformed data are presented safely", async () => {
  for (const response of [{ data: null, error: { code: "42501", message: "private database detail" } }, { data: { ...empty, summary: { ...empty.summary, total: -10 } }, error: null }]) {
    const db = { rpc: async () => response } as unknown as SupabaseClient;
    await assert.rejects(loadClientPurchaseReport(db, membership, clientPurchaseQuerySchema.parse({})), { message: "Unable to load client purchases. Please try again." });
  }
});
test("report accepts fractional product quantities and unlinked bills without inventing a customer ID", () => {
  const row = { key: "unlinked:bill", clientId: null, name: "Walk-in", lastActivity: "2026-01-01", records: 1, branches: ["Main"], total: 1500, paid: 500, balance: 1000, staff: [], items: [{ kind: "product", name: "Oil", quantity: 1.5, unit: "litre", included: false }] };
  assert.equal(clientPurchaseReportSchema.safeParse({ ...empty, rows: [row] }).success, true);
  assert.equal(clientPurchaseReportSchema.safeParse({ ...empty, rows: [{ ...row, total: Number.MAX_SAFE_INTEGER + 1 }] }).success, false);
});
test("Reports defaults to client purchases while keeping explicit analytics sections usable", () => {
  assert.equal(resolveReportsView({}), "clients");
  assert.equal(resolveReportsView({ preset: "today", q: "Ann" }), "clients");
  assert.equal(resolveReportsView({ view: "overview" }), "overview");
  for (const section of ["overview", "revenue", "team", "branches", "stays", "collections"]) assert.equal(resolveReportsView({ section }), "overview");
  assert.equal(resolveReportsView({ view: "clients", section: "overview" }), "clients");
});
test("staff attribution requires saved staff identities and distinguishes missing attribution", () => {
  const row = { key: "client", clientId: null, name: "Ann", lastActivity: "2026-10-15", records: 1, branches: ["Main"], total: 100, paid: 0, balance: 100, items: [], staff: [{ id: branch, name: "Jamie" }] };
  assert.deepEqual(clientPurchaseReportSchema.parse({ ...empty, rows: [row] }).rows[0].staff, row.staff);
  assert.deepEqual(clientPurchaseReportSchema.parse({ ...empty, rows: [{ ...row, staff: [] }] }).rows[0].staff, []);
  assert.equal(clientPurchaseReportSchema.safeParse({ ...empty, rows: [{ ...row, staff: undefined }] }).success, false);
  assert.equal(clientPurchaseReportSchema.safeParse({ ...empty, rows: [{ ...row, staff: [{ name: "Guessed name" }] }] }).success, false);
});
