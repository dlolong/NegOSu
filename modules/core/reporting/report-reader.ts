import type { SupabaseClient } from "@supabase/supabase-js";
import type { OwnerReport } from "@/lib/reporting";

export async function loadBusinessReport(db: SupabaseClient, input: { organizationId: string; branchId: string | null; start: string; end: string; basis: "invoice" | "appointment" }): Promise<OwnerReport> {
  const args = { p_organization_id: input.organizationId, p_branch_id: input.branchId, p_start_date: input.start, p_end_date: input.end };
  const { data, error } = await db.rpc(input.basis === "invoice" ? "get_owner_report" : "get_appointment_report", args);
  if (error || !data) throw new Error("Unable to load report.", { cause: error });
  const report = data as OwnerReport;
  if (input.basis === "invoice") {
    const revenue = await db.rpc("get_invoice_revenue_breakdown", args);
    if (revenue.error || !revenue.data) throw new Error("Unable to load revenue breakdown.", { cause: revenue.error });
    report.services = revenue.data.services;
    report.categories = revenue.data.categories;
  }
  return report;
}
