import assert from "node:assert/strict";import test from "node:test";import{csvCell,reportQuerySchema,resolveReportRange}from"@/lib/reporting";
import { reportAccessSchema, resolveReportScope } from "@/lib/reporting";
import { loadBusinessReport } from "@/modules/core/reporting/report-reader";
import type { SupabaseClient } from "@supabase/supabase-js";
test("month preset uses branch-local month",()=>assert.deepEqual(resolveReportRange(reportQuerySchema.parse({preset:"month"}),"Asia/Manila",new Date("2026-01-31T16:30:00Z")),{start:"2026-02-01",end:"2026-02-01"}));
test("rolling seven-day range includes today",()=>assert.deepEqual(resolveReportRange(reportQuerySchema.parse({preset:"7d"}),"UTC",new Date("2026-02-10T12:00:00Z")),{start:"2026-02-04",end:"2026-02-10"}));
test("custom range is preserved",()=>assert.deepEqual(resolveReportRange(reportQuerySchema.parse({preset:"custom",start:"2026-01-02",end:"2026-01-09"}),"UTC"),{start:"2026-01-02",end:"2026-01-09"}));
test("CSV cells prevent formula-like content from breaking columns",()=>assert.equal(csvCell('Wash, "premium"'),'"Wash, ""premium"""'));

const branchId = "81000000-0000-4000-8000-000000000001";
const membership = { branchId, timezone: "Asia/Manila", branches: [{ id: branchId }] };
test("Free scope ignores old dates and all-branch filters using the local calendar", () => {
  const scope = resolveReportScope(reportQuerySchema.parse({ preset: "custom", start: "2020-01-01", end: "2020-02-01", branch: "all" }), membership, false, new Date("2026-01-31T16:30:00Z"));
  assert.equal(scope.branch, branchId);
  assert.equal(scope.filters.preset, "30d");
  assert.deepEqual(scope.range, { start: "2026-01-03", end: "2026-02-01" });
});
test("paid reports retain custom dates but never select an unauthorized branch", () => {
  const filters = reportQuerySchema.parse({ preset: "custom", start: "2026-01-01", end: "2026-03-01", branch: "81000000-0000-4000-8000-000000000002" });
  const scope = resolveReportScope(filters, membership, true);
  assert.equal(scope.branch, branchId);
  assert.deepEqual(scope.range, { start: filters.start, end: filters.end });
  assert.equal(resolveReportScope({ ...filters, branch: "all" }, membership, true).branch, "all");
});
test("missing or malformed entitlements are not treated as a plan", () => {
  for (const value of [null, {}, { features: {} }, { features: { advanced_reports: "true" } }]) assert.equal(reportAccessSchema.safeParse(value).success, false);
  assert.equal(reportAccessSchema.safeParse({ features: { advanced_reports: false } }).success, true);
});
test("Free invoice reports never request paid revenue breakdowns", async () => {
  const calls: string[] = [];
  const db = { rpc: async (name: string) => { calls.push(name); return { data: { services: [], categories: [] }, error: null }; } } as unknown as SupabaseClient;
  const input = { organizationId: "org", branchId, start: "2026-01-01", end: "2026-01-30", basis: "invoice" as const, advanced: false };
  await loadBusinessReport(db, input);
  assert.deepEqual(calls, ["get_owner_report"]);
  calls.length = 0;
  await loadBusinessReport(db, { ...input, advanced: true });
  assert.deepEqual(calls, ["get_owner_report", "get_invoice_revenue_breakdown"]);
  calls.length = 0;
  await loadBusinessReport(db, { ...input, basis: "appointment" });
  assert.deepEqual(calls, ["get_appointment_report"]);
});
