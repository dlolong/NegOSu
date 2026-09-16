"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { reportActionError } from "@/lib/errors/action-error";
import { planPurchaseSchema, safePaymongoUrl, type BillingOrder } from "@/lib/billing/paymongo";
import { applyPaymongoSession, ensurePaymongoCheckout, paymongoClient, paymongoConfiguration, reconcilePaymongoOrder } from "@/lib/billing/paymongo-server";

const billing = "/dashboard/settings/billing";
async function ownedOrder(id: string) {
  const { activeMembership } = await getDashboardContext();
  if (activeMembership.role !== "owner" || !z.uuid().safeParse(id).success) throw new Error("Order unavailable");
  const db = await createClient();
  const result = await db.from("billing_orders").select("*").eq("id", id).eq("organization_id", activeMembership.organizationId).single();
  if (result.error || !result.data) throw new Error("Order unavailable");
  return result.data as BillingOrder;
}
export async function purchasePlan(data: FormData) {
  const parsed = planPurchaseSchema.extend({ requestId: z.uuid(), accepted: z.literal("yes"), quotedAmount: z.coerce.number().int().positive() }).safeParse(Object.fromEntries(data));
  if (!parsed.success) redirect(`${billing}?error=Review+the+plan+and+accept+the+payment+terms.`);
  const { activeMembership } = await getDashboardContext();
  if (activeMembership.role !== "owner") redirect(`${billing}?error=Owner+access+required.`);
  const config = paymongoConfiguration();
  if (!config.ready) redirect(`${billing}?error=Online+payment+is+not+configured.+Please+contact+support.`);
  const db = await createClient();
  const { data: saved, error } = await db.rpc("begin_paymongo_order", { p_organization_id: activeMembership.organizationId, p_plan_id: parsed.data.planId, p_interval: parsed.data.interval, p_request_id: parsed.data.requestId, p_livemode: config.livemode });
  if (error || !saved) {
    reportActionError("billing.paymongo.begin", error, "Could not start checkout");
    redirect(`${billing}/history?error=Could+not+start+checkout.+Review+your+current+plan+or+resume+an+open+payment.`);
  }
  let order = saved as BillingOrder;
  if (order.amount_centavos !== parsed.data.quotedAmount) redirect(`${billing}/orders/${order.id}?error=The+price+has+changed.+Review+the+amount+below+before+resuming+checkout.`);
  try { order = await ensurePaymongoCheckout(order); }
  catch (error) { reportActionError("billing.paymongo.create", error, "Checkout unavailable"); redirect(`${billing}/orders/${order.id}?error=Checkout+could+not+be+opened.+Retry+this+payment+to+avoid+creating+a+duplicate.`); }
  if (!["creating", "pending"].includes(order.status)) redirect(`${billing}/orders/${order.id}`);
  redirect(safePaymongoUrl(order.checkout_url!));
}
export async function refreshPaymentStatus(id: string) {
  try {
    const order = await ownedOrder(id);
    await reconcilePaymongoOrder(order);
    revalidatePath(billing); revalidatePath(`${billing}/orders/${id}`);
    return { ok: true };
  } catch (error) { reportActionError("billing.paymongo.refresh", error, "Could not check payment"); return { ok: false }; }
}
export async function resumePayment(data: FormData) {
  const id = String(data.get("orderId") ?? "");
  let url: string | null = null;
  try {
    let order = await ownedOrder(id);
    if (["creating", "pending"].includes(order.status)) {
      order = await ensurePaymongoCheckout(order);
      await reconcilePaymongoOrder(order);
      order = await ownedOrder(id);
      if (order.status === "pending" && order.checkout_url) url = safePaymongoUrl(order.checkout_url);
    }
  } catch (error) { reportActionError("billing.paymongo.resume", error, "Could not resume payment"); redirect(`${billing}/history?error=Could+not+resume+payment.+Try+again+shortly.`); }
  redirect(url ?? `${billing}/orders/${id}`);
}
export async function cancelPayment(data: FormData) {
  const id = String(data.get("orderId") ?? "");
  try {
    let order = await ownedOrder(id);
    if (["creating", "pending"].includes(order.status)) {
      // Recover uncertain creation using the original idempotency key before cancelling.
      order = await ensurePaymongoCheckout(order);
      const provider = paymongoClient();
      if (provider.livemode !== order.livemode) throw new Error("Payment mode changed");
      const before = await provider.retrieve(order.checkout_session_id!);
      if (!await applyPaymongoSession(order, before)) {
        if (before.attributes.status !== "expired") await provider.expire(order.checkout_session_id!);
        const session = await provider.retrieve(order.checkout_session_id!);
        if (!await applyPaymongoSession(order, session)) {
          if (session.attributes.status !== "expired") throw new Error("Checkout is still active");
          // Cancelled orders are already excluded from reconciliation. Saving the
          // terminal status must not depend on its optional tracking timestamps.
          const { error } = await createAdminClient().from("billing_orders").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", id).in("status", ["creating", "pending"]);
          if (error) throw new Error("Cancellation could not be saved", { cause: error });
        }
      }
    }
  } catch (error) { reportActionError("billing.paymongo.cancel", error, "Could not cancel payment"); redirect(`${billing}/history?error=Could+not+confirm+cancellation.+Check+the+payment+status+before+trying+again.`); }
  revalidatePath(billing); redirect(`${billing}/orders/${id}`);
}
