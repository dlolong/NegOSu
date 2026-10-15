import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ClientPurchases } from "@/components/reports/client-purchases";
import { ErrorState, PageHeader } from "@/components/page-patterns";
import { PlanUpgradeNotice } from "@/components/plan-upgrade";
import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { roleHasPermission } from "@/lib/rbac";
import { reportAccessSchema } from "@/lib/reporting";
import { reportActionError } from "@/lib/errors/action-error";
import { clientPurchaseQuerySchema, loadClientPurchaseReport } from "@/modules/core/reporting/client-purchase-report";

export async function ClientPurchaseReportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ activeMembership: membership }, raw, db] = await Promise.all([getDashboardContext(), searchParams, createClient()]);
  const header = <PageHeader id="client-purchases-header" title="Client purchases" description="Clients, staff, services / treatments, products, and totals for the selected period." action={<nav aria-label="Report views" className="flex flex-wrap gap-2"><Button asChild variant="secondary" size="sm"><Link id="client-purchases-overview" href="/dashboard/reports?view=overview">Overview</Link></Button><Button asChild variant="secondary" size="sm"><Link id="client-purchases-products" href="/dashboard/reports/products">Product sales &amp; handover</Link></Button></nav>}/>;
  const shell = (content: React.ReactNode) => <main id="client-purchases-page" className="mx-auto min-w-0 max-w-7xl space-y-4">{header}{content}</main>;
  if (!roleHasPermission(membership.role, "reports.view")) return shell(<ErrorState id="client-purchases-access-error" description="You do not have reporting access."/>);
  const access = await db.rpc("get_org_entitlements", { p_organization_id: membership.organizationId });
  const entitlement = reportAccessSchema.safeParse(access.data);
  if (access.error || !entitlement.success) return shell(<ErrorState id="client-purchases-plan-error" description="Could not check report access. Refresh to try again."/>);
  if (!entitlement.data.features.advanced_reports) return shell(<><p className="text-sm">Client purchase details and custom filters are included with advanced reports. Your summary reports remain available.</p><PlanUpgradeNotice id="client-purchases-plan-upgrade" capability="advanced_reports"/></>);
  const parsed = clientPurchaseQuerySchema.safeParse(Object.fromEntries(Object.entries(raw).filter(([, value]) => value !== "" && value !== undefined)));
  if (!parsed.success) return shell(<ErrorState id="client-purchases-filter-error" title="Check your filters" description="Choose valid dates in order (up to 732 days), a branch, purchase type, and search text up to 120 characters." action={<Link id="client-purchases-reset" href="/dashboard/reports/clients" className="underline">Reset filters</Link>}/>);
  let result: Awaited<ReturnType<typeof loadClientPurchaseReport>>;
  try {
    result = await loadClientPurchaseReport(db, membership, parsed.data);
  } catch (error) {
    reportActionError("reports.client-purchases", error, "Could not load client purchases.");
    return shell(<ErrorState id="client-purchases-load-error" description="Could not load client purchases. Check the selected branch and try again." action={<Link id="client-purchases-retry" href="/dashboard/reports/clients" className="underline">Reload report</Link>}/>);
  }
  return shell(<ClientPurchases filters={parsed.data} range={result.range} branches={membership.branches} currency={membership.currency} report={result.report}/>);
}
