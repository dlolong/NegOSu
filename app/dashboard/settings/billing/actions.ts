"use server";
import { redirect } from "next/navigation";
import { getDashboardContext } from "@/lib/auth/context";
import { paymongoConfiguration } from "@/lib/billing/paymongo-server";
import { planPurchaseSchema } from "@/lib/billing/paymongo";
import { stripeBillingProvider } from "@/lib/billing/stripe";
import { clientEnv } from "@/lib/env/client";
import { reportActionError } from "@/lib/errors/action-error";
import { createClient } from "@/lib/supabase/server";

const billing = "/dashboard/settings/billing";
async function subscription(db: Awaited<ReturnType<typeof createClient>>, organizationId: string) {
  const { data, error } = await db.from("organization_subscriptions").select("provider,provider_customer_id,provider_subscription_id,status").eq("organization_id", organizationId).maybeSingle();
  if (error) {
    reportActionError("billing.subscription", error, "Billing unavailable");
    redirect(`${billing}?error=Current+subscription+could+not+be+verified.+Please+try+again.`);
  }
  return data;
}

export async function startCheckout(data: FormData) {
  const parsed = planPurchaseSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) redirect(`${billing}?error=Invalid+plan.`);
  const { activeMembership, user } = await getDashboardContext();
  if (activeMembership.role !== "owner") redirect(`${billing}?error=Owner+access+required.`);
  const db = await createClient();
  const current = await subscription(db, activeMembership.organizationId);
  const activeStripe = current?.provider === "stripe" && ["active", "trialing", "past_due"].includes(current.status);
  if (paymongoConfiguration().ready && !activeStripe) redirect(`${billing}/upgrade?planId=${parsed.data.planId}&interval=${parsed.data.interval}`);
  if (current?.provider === "paymongo") redirect(`${billing}?error=PayMongo+checkout+is+currently+unavailable.`);
  const { data: plan, error } = await db.from("plans").select("id,provider_monthly_price_id,provider_yearly_price_id,is_active,is_custom").eq("id", parsed.data.planId).single();
  const priceId = parsed.data.interval === "year" ? plan?.provider_yearly_price_id : plan?.provider_monthly_price_id;
  if (error || !plan?.is_active || plan.is_custom || !priceId) redirect(`${billing}?error=This+plan+is+not+configured+for+online+checkout.`);
  let url: string;
  try {
    url = await stripeBillingProvider.createCheckout({
      organizationId: activeMembership.organizationId, planId: plan.id, priceId, interval: parsed.data.interval,
      customerId: current?.provider_customer_id ?? undefined, email: user.email!,
      successUrl: `${clientEnv.NEXT_PUBLIC_APP_URL}${billing}?message=Checkout+completed.+Subscription+access+updates+after+Stripe+confirmation.`,
      cancelUrl: `${clientEnv.NEXT_PUBLIC_APP_URL}${billing}?error=Checkout+cancelled.`, trialDays: current ? undefined : 14,
    });
  } catch (error) {
    reportActionError("billing.stripe.checkout", error, "Checkout unavailable");
    redirect(`${billing}?error=Checkout+could+not+be+opened.+Please+try+again.`);
  }
  redirect(url);
}

export async function openBillingPortal() {
  const { activeMembership } = await getDashboardContext();
  if (activeMembership.role !== "owner") redirect(`${billing}?error=Owner+access+required.`);
  const current = await subscription(await createClient(), activeMembership.organizationId);
  if (current?.provider !== "stripe" || !current.provider_customer_id) redirect(`${billing}?error=No+provider+billing+account+exists.`);
  let url: string;
  try { url = await stripeBillingProvider.createPortal(current.provider_customer_id, `${clientEnv.NEXT_PUBLIC_APP_URL}${billing}`); }
  catch (error) {
    reportActionError("billing.stripe.portal", error, "Billing portal unavailable");
    redirect(`${billing}?error=Billing+portal+could+not+be+opened.+Please+try+again.`);
  }
  redirect(url);
}
