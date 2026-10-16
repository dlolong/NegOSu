import type { SupabaseClient } from "@supabase/supabase-js";
import { reportQuerySchema, resolveReportRange } from "@/lib/reporting";
import { loadBusinessReport } from "./report-reader";
import type { HospitalityWorkspace } from "@/modules/hospitality/contracts";

/** Read-only weekly defaults: no snapshot generation or credit mutation. */
export async function loadWeeklyReport(db: SupabaseClient, member: { organizationId: string; branchId: string; timezone: string; industry: string }, now = new Date()) {
  const range = resolveReportRange(reportQuerySchema.parse({ preset: "7d" }), member.timezone, now);
  if (member.industry === "hospitality") {
    const { data, error } = await db.rpc("get_hospitality_workspace", { p_org: member.organizationId, p_branch: member.branchId, p_start: range.start, p_end: range.end, p_section: "stays", p_page: 1, p_mode: "report" });
    if (error || !data) throw new Error("Weekly summary unavailable", { cause: error });
    return { kind: "hospitality" as const, range, report: data as HospitalityWorkspace };
  }
  const report = await loadBusinessReport(db, { organizationId: member.organizationId, branchId: member.branchId, start: range.start, end: range.end, basis: member.industry === "automotive" ? "invoice" : "appointment", advanced: false });
  return { kind: "business" as const, range, report };
}
