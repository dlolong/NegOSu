import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { serverEnv } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { reportActionError } from "@/lib/errors/action-error";
import { verifyPaymongoSignature, type BillingOrder } from "@/lib/billing/paymongo";
import { applyPaymongoSession, paymongoClient, paymongoConfiguration } from "@/lib/billing/paymongo-server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const config = paymongoConfiguration();
  if (!config.ready) return new NextResponse("Webhook unavailable", { status: 503 });
  if (Number(request.headers.get("content-length")) > 1_000_000) return new NextResponse("Payload too large", { status: 413 });
  const body = await request.text();
  if (Buffer.byteLength(body) > 1_000_000) return new NextResponse("Payload too large", { status: 413 });
  if (!verifyPaymongoSignature(body, request.headers.get("paymongo-signature"), serverEnv.PAYMONGO_WEBHOOK_SECRET!, config.livemode)) return new NextResponse("Invalid signature", { status: 400 });
  let raw;
  try { raw = JSON.parse(body); } catch { return new NextResponse("Invalid payload", { status: 400 }); }
  // PayMongo's event envelopes differ between webhook API generations.
  const event = raw?.data?.attributes ?? raw?.data;
  if (event?.type !== "checkout_session.payment.paid") return NextResponse.json({ received: true });
  const sessionId = event?.data?.id;
  if (event.livemode !== config.livemode || typeof sessionId !== "string" || !/^cs_[A-Za-z0-9]+$/.test(sessionId)) return new NextResponse("Invalid event", { status: 400 });
  try {
    // Independently verify the provider resource; redirects and payload metadata cannot grant access.
    const session = await paymongoClient().retrieve(sessionId);
    if (!z.uuid().safeParse(session.attributes.reference_number).success) return NextResponse.json({ received: true });
    const { data, error } = await createAdminClient().from("billing_orders").select("*").eq("id", session.attributes.reference_number!).maybeSingle();
    if (error) throw error;
    if (data) await applyPaymongoSession(data as BillingOrder, session, typeof raw.data.id === "string" ? raw.data.id : `event:${createHash("sha256").update(body).digest("hex")}`);
    return NextResponse.json({ received: true });
  } catch (error) {
    reportActionError("billing.paymongo.webhook", error, "Payment confirmation failed");
    return new NextResponse("Payment confirmation could not be processed", { status: 500 });
  }
}
