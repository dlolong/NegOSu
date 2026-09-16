import "server-only";
import { reportActionError } from "@/lib/errors/action-error";
import { createHash } from "node:crypto";
import { serverEnv } from "@/lib/env/server";
import { clientEnv } from "@/lib/env/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { PaymongoClient, verifiedPayment, checkoutRecoveryExpired, type BillingOrder, type CheckoutSession } from "./paymongo";

export function paymongoConfiguration() {
  const key = serverEnv.PAYMONGO_SECRET_KEY, secret = serverEnv.PAYMONGO_WEBHOOK_SECRET;
  const methods = (serverEnv.PAYMONGO_PAYMENT_METHOD_TYPES ?? "gcash,qrph,card").split(",").map(value => value.trim()).filter(Boolean);
  const ready = Boolean(key && secret && serverEnv.SUPABASE_SERVICE_ROLE_KEY && methods.length && methods.every(method => /^[a-z_]+$/.test(method)) && /^sk_(test|live)_[A-Za-z0-9]+$/.test(key));
  return { ready, livemode: key?.startsWith("sk_live_") ?? false, methods };
}
export function paymongoClient() {
  const config = paymongoConfiguration();
  if (!config.ready) throw new Error("PayMongo is not configured");
  return new PaymongoClient(serverEnv.PAYMONGO_SECRET_KEY!, config.methods);
}
export async function ensurePaymongoCheckout(order: BillingOrder) {
  if (!["creating", "pending"].includes(order.status)) return order;
  if (order.checkout_session_id && order.checkout_url) return order;
  // Provider retry keys expire after 24 hours. Never recreate an uncertain older checkout.
  if (checkoutRecoveryExpired(order.created_at)) throw new Error("Checkout recovery needs support");
  const client = paymongoClient();
  if (client.livemode !== order.livemode) throw new Error("Payment mode changed");
  const session = await client.create(order, clientEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, ""));
  const { error } = await createAdminClient().rpc("attach_paymongo_checkout", { p_order_id: order.id, p_session_id: session.id, p_checkout_url: session.attributes.checkout_url });
  if (error) throw new Error("Could not save checkout", { cause: error });
  return { ...order, checkout_session_id: session.id, checkout_url: session.attributes.checkout_url!, status: "pending" as const };
}
export async function applyPaymongoSession(order: BillingOrder, session: CheckoutSession, eventId?: string) {
  const paid = verifiedPayment(session, order);
  if (!paid) return false;
  const { error } = await createAdminClient().rpc("finish_paymongo_order", {
    p_order_id: order.id, p_session_id: session.id, p_payment_id: paid.id, p_amount: paid.attributes.amount,
    p_currency: paid.attributes.currency, p_livemode: session.attributes.livemode, p_paid_at: new Date(paid.attributes.paid_at! * 1000).toISOString(),
    p_event_id: eventId ?? `reconcile:${session.id}:${paid.id}`, p_payload_hash: createHash("sha256").update(JSON.stringify({ session: session.id, payment: paid.id, amount: paid.attributes.amount })).digest("hex"),
  });
  if (error) throw new Error("Could not activate purchased access", { cause: error });
  // Close the hosted page after payment. Failed closure is retried by reconciliation.
  try {
    const closed = session.attributes.status === "expired" ? session : await paymongoClient().expire(session.id);
    if (closed.attributes.status !== "expired") throw new Error("Paid checkout remains open");
    const { error: closeError } = await createAdminClient().from("billing_orders").update({ checkout_closed_at: new Date().toISOString() }).eq("id", order.id);
    if (closeError) throw closeError;
  } catch (error) { reportActionError("billing.paymongo.close_paid", error, "Paid checkout could not be closed"); }
  return true;
}
export async function reconcilePaymongoOrder(order: BillingOrder) {
  if (!order.checkout_session_id) return;
  const client = paymongoClient();
  if (client.livemode !== order.livemode) throw new Error("Payment mode changed");
  const session = await client.retrieve(order.checkout_session_id);
  if (await applyPaymongoSession(order, session)) return;
  if (session.attributes.status === "expired") {
    const { error } = await createAdminClient().from("billing_orders").update({ status: "expired", updated_at: new Date().toISOString() }).eq("id", order.id).in("status", ["creating", "pending"]);
    if (error) throw new Error("Could not update payment status", { cause: error });
  }
}
