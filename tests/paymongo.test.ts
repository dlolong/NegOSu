import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import { PaymongoClient, checkoutRecoveryExpired, safePaymongoUrl, verifiedPayment, verifyPaymongoSignature, type BillingOrder, type CheckoutSession } from "@/lib/billing/paymongo";
const now = 1800000000000, secret = "test-webhook-secret";
const body = '{"data":{"type":"checkout_session.payment.paid"}}';
function sign(mode = "te", timestamp = now / 1000, content = body) { return `t=${timestamp},${mode}=${createHmac("sha256", secret).update(`${timestamp}.${content}`).digest("hex")}`; }
test("PayMongo signatures require the raw body, correct mode, and a recent timestamp", () => {
  assert.equal(verifyPaymongoSignature(body, sign(), secret, false, now), true);
  assert.equal(verifyPaymongoSignature(body, sign("li"), secret, true, now), true);
  for (const header of [null, "t=bad,te=x", sign("li"), sign("te", now / 1000 - 301)]) assert.equal(verifyPaymongoSignature(body, header, secret, false, now), false);
  assert.equal(verifyPaymongoSignature(body + " ", sign(), secret, false, now), false);
  assert.equal(verifyPaymongoSignature(body, sign(), "wrong", false, now), false);
});
test("hosted checkout redirects allow only PayMongo's HTTPS checkout host", () => {
  assert.equal(safePaymongoUrl("https://checkout.paymongo.com/cs_123"), "https://checkout.paymongo.com/cs_123");
  for (const url of ["http://checkout.paymongo.com/x", "https://checkout.paymongo.com.evil.test/x", "https://user@checkout.paymongo.com/x", "javascript:alert(1)"]) assert.throws(() => safePaymongoUrl(url));
});
const order = { id: "83000000-0000-4000-8000-000000000001", organization_id: "org", plan_name: "Starter", billing_interval: "month", amount_centavos: 49900, currency: "PHP", livemode: false, checkout_session_id: "cs_test" } as BillingOrder;
const session: CheckoutSession = { id: "cs_test", attributes: { reference_number: order.id, livemode: false, payments: [{ id: "pay_test", attributes: { amount: 49900, currency: "PHP", status: "paid", paid_at: now / 1000 } }] } };
test("activation verifies provider reference, session, payment amount/currency/mode and completed payment", () => {
  assert.equal(verifiedPayment(session, order)?.id, "pay_test");
  assert.equal(verifiedPayment({ ...session, attributes: { ...session.attributes, payments: [] } }, order), null);
  for (const patch of [{ id: "wrong" }, { amount_centavos: 1 }, { currency: "USD" }, { livemode: true }, { checkout_session_id: "cs_other" }]) assert.throws(() => verifiedPayment(session, { ...order, ...patch }));
  assert.throws(() => verifiedPayment({ ...session, attributes: { ...session.attributes, payments: [...session.attributes.payments, ...session.attributes.payments] } }, order));
});
test("checkout creation uses the v2 short response and a stable retry key; verification retrieves full v1 details", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const transport = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const response = String(url).includes("/v2/") ? { id: "cs_test", attributes: { livemode: false, checkout_url: "https://checkout.paymongo.com/cs_test" } } : session;
    return new Response(JSON.stringify({ data: response }), { status: 200 });
  }) as typeof fetch;
  const client = new PaymongoClient("sk_test_fake", ["gcash"], transport);
  await client.create(order, "https://app.test"); await client.create(order, "https://app.test"); await client.retrieve("cs_test");
  const headers = calls[0].init!.headers as Record<string, string>;
  assert.equal(headers["Idempotency-Key"], (calls[1].init!.headers as Record<string, string>)["Idempotency-Key"]);
  const payload = JSON.parse(calls[0].init!.body as string).data.attributes;
  assert.equal(payload.line_items[0].amount, 49900);
  assert.equal(payload.reference_number, order.id);
  assert.equal(payload.pass_on_fees, false);
  assert.equal(payload.description, undefined);
  assert.equal(payload.show_description, undefined);
  assert.deepEqual(payload.metadata, { billing_order_id: order.id });
  assert.match(payload.success_url, /\/orders\/8300/);
  assert.equal(calls[2].url, "https://api.paymongo.com/v1/checkout_sessions/cs_test");
});
test("new checkouts send the saved business/plan description and structured reconciliation metadata", async () => {
  const bodies: string[] = [];
  const client = new PaymongoClient("sk_test_fake", ["card"], (async (_url, init) => {
    bodies.push(init!.body as string);
    return Response.json({ data: { id: "cs_test", attributes: { checkout_url: "https://checkout.paymongo.com/cs_test", livemode: false } } });
  }) as typeof fetch);
  const purchase = { ...order, plan_id: "starter", kind: "renewal", payment_description: `TEST | NegOSu | Example Salon | Starter | Monthly | Renewal | Ref: ${order.id}` };
  await client.create(purchase, "https://app.test");
  await client.create(purchase, "https://app.test");
  assert.equal(bodies[0], bodies[1]);
  const attributes = JSON.parse(bodies[0]).data.attributes;
  assert.equal(attributes.description, purchase.payment_description);
  assert.equal(attributes.show_description, true);
  assert.deepEqual(attributes.metadata, { billing_order_id: order.id, organization_id: order.organization_id, plan_id: "starter", billing_interval: "month", purchase_type: "renewal" });
  assert.equal(attributes.reference_number, order.id);
  assert.equal(attributes.line_items[0].amount, order.amount_centavos);
});
test("provider failures expose a controlled error without raw payment details", async () => {
  const client = new PaymongoClient("sk_test_fake", ["card"], (async () => new Response("private provider message", { status: 422 })) as typeof fetch);
  await assert.rejects(client.retrieve("cs_test"), error => error instanceof Error && error.message === "PayMongo request failed" && !error.message.includes("private"));
});

test("uncertain checkout creation stops before the provider idempotency key expires", () => {
  assert.equal(checkoutRecoveryExpired(new Date(now - 22 * 3600000).toISOString(), now), false);
  assert.equal(checkoutRecoveryExpired(new Date(now - 23 * 3600000).toISOString(), now), true);
  assert.equal(checkoutRecoveryExpired(new Date(now - 25 * 3600000).toISOString(), now), true);
  assert.equal(checkoutRecoveryExpired("invalid", now), true);
});
