import { NextRequest, NextResponse } from "next/server";
import { requireIndustryFeature } from "@/lib/auth/industry-access";
import { csvCell, reportAccessSchema, reportQuerySchema, resolveReportRange } from "@/lib/reporting";
import { roleHasPermission } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { loadBusinessReport } from "@/modules/core/reporting/report-reader";
import { reportActionError } from "@/lib/errors/action-error";

export async function GET(request: NextRequest) {
  const { activeMembership } = await requireIndustryFeature("reports");
  if (!roleHasPermission(activeMembership.role, "reports.view")) return new NextResponse("Forbidden", { status: 403 });
  const parsed = reportQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return new NextResponse("Invalid report filters", { status: 400 });
  if (parsed.data.branch !== "all" && !activeMembership.branches.some(({ id }) => id === parsed.data.branch)) return new NextResponse("Forbidden", { status: 403 });
  const range = resolveReportRange(parsed.data, activeMembership.timezone), db = await createClient();
  const { data: access, error: accessError } = await db.rpc("get_org_entitlements", { p_organization_id: activeMembership.organizationId });
  const entitlement = reportAccessSchema.safeParse(access);
  if (accessError || !entitlement.success) return new NextResponse("Unable to check report access. Try again shortly.", { status: 503 });
  if (!entitlement.data.features.advanced_reports) return new NextResponse("CSV exports are available on paid plans", { status: 403 });
  if (activeMembership.industry === "hospitality") {
    const section = request.nextUrl.searchParams.get("section") ?? "stays";
    const financial = ["owner", "manager", "advisor", "cashier"].includes(activeMembership.role);
    if ((["collections", "outstanding"].includes(section) && !financial) || (["inventory", "movements"].includes(section) && !roleHasPermission(activeMembership.role, "inventory.manage"))) return new NextResponse("Forbidden", { status: 403 });
    if (!["stays", "rooms", "collections", "outstanding", "inventory", "movements"].includes(section)) return new NextResponse("Invalid report section", { status: 400 });
    try {
      const { exportHospitalityReport } = await import("@/modules/hospitality/report-export");
      return await exportHospitalityReport({ branch: parsed.data.branch === "all" ? null : parsed.data.branch, ...range, section });
    } catch (error) { reportActionError("hospitality.report.export", error, "Unable to export report."); return new NextResponse("Unable to export report", { status: 500 }); }
  }
  const appointmentBased = activeMembership.industry !== "automotive";
  try {
    const report = await loadBusinessReport(db, { organizationId: activeMembership.organizationId, branchId: parsed.data.branch === "all" ? null : parsed.data.branch, start: range.start, end: range.end, basis: appointmentBased ? "appointment" : "invoice", advanced: true });
    const completed = appointmentBased ? "Completed appointments" : "Completed jobs";
    const rows: Array<Array<string | number>> = [
      ["Business report", activeMembership.organizationName], ["Period", `${range.start} to ${range.end}`],
      ...(appointmentBased ? [["Basis", "Completed appointments by scheduled date; receipts by payment date; current balances of period appointments"]] : []),
      [], ["Metric", "Value (centavos/count)"], ["Gross sales", report.summary.grossSalesCentavos], ["Payments received", report.summary.paymentsReceivedCentavos], ["Outstanding", report.summary.outstandingCentavos], [completed, report.summary.jobsCompleted], ["Average ticket", report.summary.averageTicketCentavos],
      [], ["Day", "Gross sales centavos", "Payments received centavos", completed], ...report.daily.map(row => [row.day, row.grossSalesCentavos, row.paymentsReceivedCentavos, row.jobsCompleted]),
      [], ["Service", "Category", "Revenue centavos", "Quantity"], ...report.services.map(row => [row.service, row.category, row.revenueCentavos, row.quantity]),
    ];
    return new NextResponse(`\uFEFF${rows.map(row => row.map(csvCell).join(",")).join("\r\n")}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="negosu-${activeMembership.industry}-report-${range.start}-${range.end}.csv"`, "Cache-Control": "private, no-store" } });
  } catch (error) {
    reportActionError("reports.export", error, "Unable to export report.");
    return new NextResponse("Unable to export report", { status: 500 });
  }
}
