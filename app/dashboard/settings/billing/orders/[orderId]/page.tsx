import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2, Clock3, X, AlertCircle } from "lucide-react";
import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { checkoutRecoveryExpired, type BillingOrder } from "@/lib/billing/paymongo";
import { formatMoney } from "@/lib/operations";
import { PageHeader } from "@/components/page-patterns";
import { FormMessage } from "@/components/form-message";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { BillingPaymentRefresh } from "@/components/billing-payment-refresh";
import { resumePayment, cancelPayment } from "../../paymongo-actions";
export default async function OrderPage({ params, searchParams }: { params: Promise<{ orderId: string }>; searchParams: Promise<{ error?: string; return?: string }> }) {
  const [{ activeMembership }, { orderId }, query, db] = await Promise.all([getDashboardContext(), params, searchParams, createClient()]);
  if (activeMembership.role !== "owner" || !z.uuid().safeParse(orderId).success) notFound();
  const { data, error } = await db.from("billing_orders").select("*").eq("id", orderId).eq("organization_id", activeMembership.organizationId).maybeSingle();
  if (error) return <main id="billing-order-error" role="alert">Payment details could not be loaded. <Link href="/dashboard/settings/billing/history">Return to payment history</Link>.</main>;
  if (!data) notFound();
  const order = data as BillingOrder;
  const open = ["creating", "pending"].includes(order.status), paid = order.status === "paid", review = order.status === "review";
  const recoveryRequired = open && !order.checkout_session_id && checkoutRecoveryExpired(order.created_at);
  const Icon = paid ? CheckCircle2 : review ? AlertCircle : open ? Clock3 : X;
  const title = recoveryRequired ? "Checkout needs review" : paid ? "Payment confirmed" : review ? "Payment received — review needed" : open ? "Awaiting payment confirmation" : order.status === "cancelled" ? "Payment cancelled" : "Checkout expired";
  return <main id="billing-order-page" className="mx-auto w-full min-w-0 max-w-3xl"><PageHeader id="billing-order-header" eyebrow="Plans and billing" title="Payment details" description={activeMembership.organizationName} action={<Button id="billing-order-close" asChild variant="secondary"><Link href="/dashboard/settings/billing"><X size={16} aria-hidden="true"/>Close</Link></Button>}/><FormMessage error={query.error}/>
    <Card className="mt-5 p-5 sm:p-6"><div className="flex items-start gap-3"><Icon size={25} aria-hidden="true" className={`mt-1 shrink-0 ${paid ? "text-status-success" : review ? "text-status-danger" : "text-brand-primary"}`}/><div><h2 id="billing-order-status" className="text-lg font-medium">{title}</h2><p className="mt-1 text-sm text-admin-text-secondary">{recoveryRequired ? "This interrupted checkout needs support to confirm its status. Contact support with the reference below before starting another payment." : paid ? `This payment activated ${order.plan_name}. Your purchased access end date is shown below.` : review ? "Your payment is recorded. Contact support with the reference below so we can finish the plan change. Do not pay again." : open ? "Your plan will update after PayMongo confirms payment. If you already paid, check the status instead of paying again." : "Your existing plan has not been changed by this checkout."}</p></div></div>
      {open && query.return === "cancelled" ? <p id="billing-return-cancelled" className="mt-4 rounded-ui-md bg-admin-surface-muted p-3 text-sm">You left checkout. You can resume or cancel this payment request below.</p> : null}
      <dl className="mt-5 grid gap-4 border-y border-admin-border py-5 text-sm sm:grid-cols-2">{[["Plan", order.plan_name], ["Amount", formatMoney(order.amount_centavos)], ["Access period", order.billing_interval === "year" ? "1 year" : "1 month"], ["Payment mode", order.livemode ? "Live payment" : "Test payment"], ["Reference", order.id], ...(order.access_ends_at ? [["Access until", new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeZone: activeMembership.timezone }).format(new Date(order.access_ends_at))]] : [])].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-admin-text-secondary">{label}</dt><dd className="mt-1 font-medium [overflow-wrap:anywhere]">{value}</dd></div>)}</dl>
      <div className="mt-5 flex flex-wrap items-start justify-end gap-2">
        {open && !recoveryRequired ? <><BillingPaymentRefresh orderId={order.id} auto={Boolean(order.checkout_session_id)}/><form action={cancelPayment}><input type="hidden" name="orderId" value={order.id}/><SubmitButton id="billing-payment-cancel" pendingText="Cancelling…" variant="secondary"><X size={16} aria-hidden="true"/>Cancel payment</SubmitButton></form><form action={resumePayment}><input type="hidden" name="orderId" value={order.id}/><SubmitButton id="billing-payment-resume" pendingText="Opening…"><ArrowRight size={16} aria-hidden="true"/>Resume checkout</SubmitButton></form></> : <Button id="billing-payment-done" asChild><Link href={paid ? "/dashboard" : "/dashboard/settings/billing"}><ArrowRight size={16} aria-hidden="true"/>{paid ? "Go to dashboard" : "View plans"}</Link></Button>}
      </div>
    </Card><p className="mt-4 text-sm text-admin-text-secondary">Your plan does not renew automatically. You can renew from Plans and billing before access ends.</p>
  </main>;
}
