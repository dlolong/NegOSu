import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const planPurchaseSchema = z.object({ planId: z.enum(["starter", "business", "pro"]), interval: z.enum(["month", "year"]) });
export type PlanPurchase = z.infer<typeof planPurchaseSchema>;
export type PlanQuote = { planId: string; planName: string; interval: "month" | "year"; amountCentavos: number; currency: string; kind: "new" | "renewal" | "upgrade"; creditCentavos: number; estimatedAccessEnd: string };
export type BillingOrder = { id: string; organization_id: string; plan_id: string; plan_name: string; payment_description?: string | null; billing_interval: "month" | "year"; amount_centavos: number; currency: string; livemode: boolean; status: "creating" | "pending" | "paid" | "cancelled" | "expired" | "review"; kind: string; checkout_session_id: string | null; checkout_url: string | null; provider_payment_id: string | null; created_at: string; paid_at: string | null; access_ends_at: string | null };
export function checkoutRecoveryExpired(createdAt: string, now = Date.now()) {
  const created = Date.parse(createdAt);
  return !Number.isFinite(created) || now - created >= 23 * 60 * 60 * 1000;
}
export const sessionSchema = z.object({ id: z.string().regex(/^cs_[A-Za-z0-9]+$/), attributes: z.object({
  livemode: z.boolean(), reference_number: z.string().nullable(), checkout_url: z.url().optional(), status: z.string().optional(),
  payments: z.array(z.object({ id: z.string().regex(/^pay_[A-Za-z0-9]+$/), attributes: z.object({ status: z.string(), amount: z.number().int().positive(), currency: z.string(), paid_at: z.number().int().positive().nullable().optional() }) })).default([]),
}) });
export type CheckoutSession = z.infer<typeof sessionSchema>;
export function safePaymongoUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "checkout.paymongo.com" || url.username || url.password || url.port) throw new Error("Invalid checkout URL");
  return url.toString();
}
export function verifyPaymongoSignature(body: string, header: string | null, secret: string, livemode: boolean, now = Date.now()) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(",").map(value => value.trim().split("=")));
  const timestamp = Number(parts.t), signature = parts[livemode ? "li" : "te"];
  if (!/^\d+$/.test(parts.t ?? "") || !Number.isSafeInteger(timestamp) || Math.abs(now / 1000 - timestamp) > 300 || !/^[a-f0-9]{64}$/i.test(signature ?? "")) return false;
  const expected = createHmac("sha256", secret).update(`${parts.t}.${body}`).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
export function verifiedPayment(session: CheckoutSession, order: BillingOrder) {
  if (session.attributes.reference_number !== order.id || session.attributes.livemode !== order.livemode || (order.checkout_session_id && order.checkout_session_id !== session.id)) throw new Error("Checkout does not match order");
  const paid = session.attributes.payments.filter(payment => payment.attributes.status === "paid");
  if (!paid.length) return null;
  if (paid.length !== 1 || paid[0].attributes.amount !== order.amount_centavos || paid[0].attributes.currency !== order.currency || !paid[0].attributes.paid_at) throw new Error("Payment does not match order");
  return paid[0];
}
export class PaymongoClient {
  readonly livemode: boolean;
  constructor(private readonly key: string, private readonly methods: string[], private readonly transport: typeof fetch = fetch) {
    if (!/^sk_(test|live)_[A-Za-z0-9]+$/.test(key) || !methods.length || methods.some(method => !/^[a-z_]+$/.test(method))) throw new Error("PayMongo is not configured");
    this.livemode = key.startsWith("sk_live_");
  }
  private async request(path: string, body?: unknown, idempotencyKey?: string): Promise<unknown> {
    const response = await this.transport(`https://api.paymongo.com${path}`, {
      method: body ? "POST" : "GET", cache: "no-store", signal: AbortSignal.timeout(15_000),
      headers: { Authorization: `Basic ${Buffer.from(`${this.key}:`).toString("base64")}`, "Content-Type": "application/json", ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new Error("PayMongo request failed", { cause: { code: `PAYMONGO_${response.status}` } });
    const result = await response.json();
    return result.data;
  }
  async create(order: BillingOrder, appUrl: string) {
    const status = `${appUrl}/dashboard/settings/billing/orders/${order.id}`;
    const raw = await this.request("/v2/checkout_sessions", { data: { attributes: {
      line_items: [{ name: `NegOSu ${order.plan_name} — ${order.billing_interval === "year" ? "1 year" : "1 month"}`, amount: order.amount_centavos, currency: "PHP", quantity: 1 }],
      payment_method_types: this.methods, success_url: `${status}?return=success`, cancel_url: `${status}?return=cancelled`,
      reference_number: order.id,
      // Keep older/uncertain requests byte-compatible with their original retry payload.
      ...(order.payment_description ? {
        description: order.payment_description, show_description: true,
        metadata: { billing_order_id: order.id, organization_id: order.organization_id, plan_id: order.plan_id, billing_interval: order.billing_interval, purchase_type: order.kind },
      } : { metadata: { billing_order_id: order.id } }),
      send_email_receipt: true, pass_on_fees: false,
    } } }, `negosu-billing-${order.id}`);
    const session = z.object({ id: z.string().regex(/^cs_[A-Za-z0-9]+$/), attributes: z.object({ checkout_url: z.url(), livemode: z.boolean() }) }).parse(raw);
    if (session.attributes.livemode !== order.livemode) throw new Error("Payment mode changed");
    safePaymongoUrl(session.attributes.checkout_url);
    return session;
  }
  async retrieve(id: string) {
    if (!/^cs_[A-Za-z0-9]+$/.test(id)) throw new Error("Invalid checkout session");
    return sessionSchema.parse(await this.request(`/v1/checkout_sessions/${id}`));
  }
  async expire(id: string) {
    if (!/^cs_[A-Za-z0-9]+$/.test(id)) throw new Error("Invalid checkout session");
    return sessionSchema.parse(await this.request(`/v1/checkout_sessions/${id}/expire`, { data: { attributes: {} } }, `negosu-expire-${id}`));
  }
}
