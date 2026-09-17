import { paymongoConfiguration } from "@/lib/billing/paymongo-server";
import { BillingOverviewContent } from "@/components/billing-overview";
import { PageHeader } from "@/components/page-patterns";
import { Card } from "@/components/ui/card";
import { getDashboardContext } from "@/lib/auth/context";
import { loadBillingOverview } from "@/lib/billing/overview";
import { createClient } from "@/lib/supabase/server";

export default async function Page({ searchParams }: { searchParams: Promise<{ message?: string; error?: string }> }) {
  const [params, { activeMembership }, supabase] = await Promise.all([searchParams, getDashboardContext(), createClient()]);

  if (activeMembership.role !== "owner") {
    return <main id="billing-page" className="mx-auto w-full max-w-6xl"><PageHeader id="billing-page-header" eyebrow="Subscription" title="Plans and billing" description="Review subscription access for this business."/><Card id="billing-owner-only-state" className="mt-5 p-6"><h2 className="font-medium text-admin-text">Owner access required</h2><p className="mt-1 text-sm text-admin-text-secondary">Only organization owners can change plans, payment details, or cancellation settings.</p></Card></main>;
  }

  const overview = await loadBillingOverview(supabase, activeMembership.organizationId);
  const orders = await supabase.from("billing_orders").select("id").eq("organization_id", activeMembership.organizationId).limit(0);
  const config = paymongoConfiguration();
  const paymongo = { ready: config.ready && !orders.error && !!overview.effective && !overview.subscriptionUnavailable, livemode: config.livemode };
  return <BillingOverviewContent overview={overview} paymongo={paymongo} organizationName={activeMembership.organizationName} industry={activeMembership.industry} params={params}/>;
}
