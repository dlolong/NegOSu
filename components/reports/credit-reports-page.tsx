import { reportCategories } from "@/modules/core/reporting/catalog-report";
import { CategoryTable } from "./category-table";
import { CreditReports } from "@/components/reports/credit-reports";
import { ErrorState, PageHeader } from "@/components/page-patterns";
import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { roleHasPermission } from "@/lib/rbac";
import { reportQuerySchema, resolveReportRange } from "@/lib/reporting";
export async function CreditReportPage() {
  const { activeMembership: member, user } = await getDashboardContext();
  if (!roleHasPermission(member.role, "reports.view")) return <ErrorState id="credit-report-access-error" description="You do not have reporting access."/>;
  const db = await createClient();
  const ent = await db.rpc("get_org_entitlements", { p_organization_id: member.organizationId });
  if (ent.error || !ent.data?.features) return <ErrorState id="credit-report-setup-error" description="Reports could not be loaded. Try again shortly."/>;
  const range = resolveReportRange(reportQuerySchema.parse({preset:"7d"}), member.timezone);
  const categories = reportCategories(member.industry);
  const categoryTables = Object.fromEntries(categories.map(category => [category, <CategoryTable key={category} db={db} member={member} category={category} start={range.start}/>]));
  return <main id="reports-page" className="mx-auto min-w-0 max-w-6xl"><PageHeader id="credit-report-header" title="Reports" description="Bookings, payments and purchases from the last 7 days."/><CreditReports key={`${member.organizationId}:${user.id}`} actorId={user.id} organizationId={member.organizationId} paid={ent.data.features?.advanced_reports === true} industry={member.industry} currency={member.currency} branches={member.branches} categoryTables={categoryTables} defaultBranch={member.branchId} range={range}/></main>;
}
