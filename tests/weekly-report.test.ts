import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadWeeklyReport } from "@/modules/core/reporting/weekly-report";

for (const industry of ["automotive", "salon", "pet_care", "hospitality"]) {
  test(`${industry} weekly default is a branch-scoped read with no credit operation`, async () => {
    const calls: { name: string; args: Record<string, unknown> }[] = [];
    const db = { rpc: async (name: string, args: Record<string, unknown>) => { calls.push({ name, args }); return { data: {}, error: null }; } } as unknown as SupabaseClient;
    const result = await loadWeeklyReport(db, { organizationId: "org", branchId: "branch", industry, timezone: "Asia/Manila" }, new Date("2026-10-15T16:30:00Z"));
    assert.deepEqual(result.range, { start: "2026-10-10", end: "2026-10-16" });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].name, industry === "hospitality" ? "get_hospitality_workspace" : industry === "automotive" ? "get_owner_report" : "get_appointment_report");
    assert.equal(calls[0].args[industry === "hospitality" ? "p_branch" : "p_branch_id"], "branch");
    assert.equal(calls[0].args[industry === "hospitality" ? "p_org" : "p_organization_id"], "org");
  });
}
test("weekly report failures do not trigger a paid fallback", async () => {
  let calls = 0;
  const db = { rpc: async () => { calls++; return { data: null, error: { code: "42501" } }; } } as unknown as SupabaseClient;
  await assert.rejects(loadWeeklyReport(db, { organizationId: "org", branchId: "branch", industry: "salon", timezone: "Asia/Manila" }));
  assert.equal(calls, 1);
});
