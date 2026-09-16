import Link from "next/link";
import { randomUUID } from "node:crypto";
import { ArrowRight, ShieldCheck, X, RefreshCw } from "lucide-react";
import { notFound } from "next/navigation";
import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { planPurchaseSchema, type PlanQuote } from "@/lib/billing/paymongo";
import { paymongoConfiguration } from "@/lib/billing/paymongo-server";
import { formatMoney } from "@/lib/operations";
import { PageHeader } from "@/components/page-patterns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { purchasePlan } from "../paymongo-actions";

export default async function UpgradePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ activeMembership }, params, db] = await Promise.all([getDashboardContext(), searchParams, createClient()]);
  if (activeMembership.role !== "owner") notFound();
  const parsed = planPurchaseSchema.safeParse(params);
  if (!parsed.success) notFound();
  const config = paymongoConfiguration();
  const { data, error } = await db.rpc("quote_paymongo_plan", { p_organization_id: activeMembership.organizationId, p_plan_id: parsed.data.planId, p_interval: parsed.data.interval });
  const quote = !error && data ? data as PlanQuote : null;
  return <main id="billing-upgrade-page" className="mx-auto w-full min-w-0 max-w-3xl">
    <PageHeader id="billing-upgrade-header" eyebrow="Plans and billing" title="Review your plan" description={activeMembership.organizationName} action={<Button id="billing-upgrade-close" asChild variant="secondary"><Link href="/dashboard/settings/billing"><X size={16} aria-hidden="true"/>Close</Link></Button>}/>
    {!quote ? <Card id="billing-upgrade-error" role="alert" className="mt-5 p-5"><h2 className="font-semibold">This plan change is unavailable</h2><p className="mt-2 text-sm">Choose your current plan or a higher plan. If another provider manages your subscription, manage it before switching. If this continues, contact support.</p></Card> : <>
      <Card className="mt-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">{quote.planName}</h2><p className="mt-1 text-sm text-admin-text-secondary">{quote.kind === "renewal" ? "Renew your access" : quote.kind === "upgrade" ? "Upgrade your workspace" : "Activate your paid plan"}</p></div><div className="text-right"><p id="billing-upgrade-total" className="text-2xl font-semibold">{formatMoney(quote.amountCentavos)}</p><p className="text-sm text-admin-text-secondary">One-time payment · PHP</p></div></div>
        <form id="billing-upgrade-term-form" className="mt-5 flex flex-wrap items-end justify-end gap-3 border-y border-admin-border py-4">
          <input type="hidden" name="planId" value={quote.planId}/><label className="min-w-0 flex-1 text-sm font-medium" htmlFor="billing-upgrade-interval">Access period<select id="billing-upgrade-interval" className="mt-1 min-h-11 w-full rounded-ui-md border border-admin-border bg-admin-surface px-3" name="interval" defaultValue={quote.interval}><option value="month">1 month</option><option value="year">1 year</option></select></label><Button id="billing-upgrade-update" type="submit" variant="secondary"><RefreshCw size={16} aria-hidden="true"/>Update</Button>
        </form>
        <dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-4"><dt>Payment provider</dt><dd className="font-medium">PayMongo</dd></div><div className="flex justify-between gap-4"><dt>Automatic renewal</dt><dd>No</dd></div><div className="flex justify-between gap-4"><dt>Estimated access until</dt><dd id="billing-upgrade-access-end" className="text-right">{new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeZone: activeMembership.timezone }).format(new Date(quote.estimatedAccessEnd))}</dd></div></dl>
        {quote.creditCentavos > 0 ? <p id="billing-upgrade-credit" className="mt-4 rounded-ui-md bg-admin-surface-muted p-3 text-sm">{quote.kind === "renewal" ? "Your new period is added after your existing paid access." : `Your unused paid value (approximately ${formatMoney(quote.creditCentavos)}) is preserved as extra access time on ${quote.planName}.`} The final end date is calculated when payment is confirmed.</p> : null}
        {!config.livemode && config.ready ? <p id="billing-upgrade-test-mode" className="mt-4 rounded-ui-md bg-amber-50 p-3 text-sm text-amber-900">Test checkout — use PayMongo test payment details. No live payment will be collected.</p> : null}
        {config.ready ? <form id="billing-upgrade-confirm-form" action={purchasePlan} className="mt-5 space-y-4">
          <input type="hidden" name="planId" value={quote.planId}/><input type="hidden" name="interval" value={quote.interval}/><input type="hidden" name="quotedAmount" value={quote.amountCentavos}/><input type="hidden" name="requestId" value={randomUUID()}/>
          <label className="flex items-start gap-3 text-sm leading-relaxed"><input id="billing-upgrade-accept" type="checkbox" name="accepted" value="yes" required className="mt-1 size-4 shrink-0"/><span>I agree to pay {formatMoney(quote.amountCentavos)} for this plan. This is a one-time payment; I will renew manually. Access changes only after payment is verified.</span></label>
          <div className="flex flex-wrap justify-end gap-2 border-t border-admin-border pt-4"><Button id="billing-upgrade-cancel" asChild variant="secondary"><Link href="/dashboard/settings/billing"><X size={16} aria-hidden="true"/>Cancel</Link></Button><SubmitButton id="billing-upgrade-pay" pendingText="Opening checkout…"><ArrowRight size={16} aria-hidden="true"/>Continue to PayMongo</SubmitButton></div>
        </form> : <p id="billing-upgrade-unavailable" role="alert" className="mt-5 text-sm">Online payment is currently unavailable. Contact support before making a payment.</p>}
      </Card>
      <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-admin-text-secondary"><ShieldCheck size={17} className="shrink-0" aria-hidden="true"/>PayMongo securely collects your payment details. You can review the payment methods available for this checkout on the next page.</p>
    </>}
  </main>;
}
