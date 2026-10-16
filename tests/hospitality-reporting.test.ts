import assert from "node:assert/strict";
import test from "node:test";
import { reportQuerySchema } from "@/lib/reporting";
import { resolveHospitalityReportScope } from "@/modules/hospitality/reporting";
const branchId = "81000000-0000-4000-8000-000000000001";
const membership = { branchId, timezone: "Asia/Manila", branches: [{ id: branchId }] };
const now = new Date("2026-01-31T16:30:00Z");
for (const mode of ["history", "payments", "report"] as const) {
  test(`Free ${mode} supports recent presets on the current branch`, () => {
    for (const [preset, start] of [["today", "2026-02-01"], ["7d", "2026-01-26"], ["30d", "2026-01-03"]]) {
      const scope = resolveHospitalityReportScope(reportQuerySchema.parse({ preset, branch: "all", start: "2000-01-01", end: "2001-01-01" }), membership, false, mode, now);
      assert.deepEqual(scope.range, { start, end: "2026-02-01" });
      assert.equal(scope.branch, branchId);
    }
    for (const preset of ["custom"]) {
      const scope = resolveHospitalityReportScope(reportQuerySchema.parse({ preset, start: "2000-01-01", end: "2001-01-01" }), membership, false, mode, now);
      assert.equal(scope.filters.preset, "30d");
      assert.deepEqual(scope.range, { start: "2026-01-03", end: "2026-02-01" });
    }
  });
  test(`Paid ${mode} preserves custom dates and permitted branch scope`, () => {
    const filters = reportQuerySchema.parse({ preset: "custom", start: "2025-01-01", end: "2025-03-01", branch: "all" });
    const scope = resolveHospitalityReportScope(filters, membership, true, mode, now);
    assert.deepEqual(scope.range, { start: filters.start, end: filters.end });
    assert.equal(scope.branch, mode === "report" ? "all" : branchId);
    assert.equal(resolveHospitalityReportScope({ ...filters, branch: "81000000-0000-4000-8000-000000000002" }, membership, true, mode, now).branch, branchId);
  });
}
test("Hospitality month preset includes the full local month", () => {
  const scope = resolveHospitalityReportScope(reportQuerySchema.parse({}), membership, true, "report", new Date("2026-01-31T00:00:00Z"));
  assert.deepEqual(scope.range, { start: "2026-01-01", end: "2026-01-31" });
});

for (const mode of ["payments", "history", "report"] as const) {
  test(`Free ${mode} defaults to the local month and allows recent custom dates`, () => {
    const midMonth = new Date("2026-10-15T16:30:00Z");
    const defaults = resolveHospitalityReportScope(reportQuerySchema.parse({}), membership, false, mode, midMonth);
    assert.deepEqual(defaults.range, { start: "2026-10-01", end: "2026-10-16" });
    const custom = resolveHospitalityReportScope(reportQuerySchema.parse({ preset: "custom", start: "2026-10-04", end: "2026-10-10" }), membership, false, mode, midMonth);
    assert.deepEqual(custom.range, { start: "2026-10-04", end: "2026-10-10" });
    assert.equal(custom.branch, branchId);
  });
}
