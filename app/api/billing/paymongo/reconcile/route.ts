import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { reportActionError } from "@/lib/errors/action-error";
import { paymongoConfiguration, reconcilePaymongoOrder } from "@/lib/billing/paymongo-server";
import type { BillingOrder } from "@/lib/billing/paymongo";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const expected = Buffer.from(`Bearer ${serverEnv.BILLING_RECONCILIATION_SECRET ?? ""}`);
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  if (!serverEnv.BILLING_RECONCILIATION_SECRET || expected.length !== actual.length || !timingSafeEqual(expected, actual)) return new NextResponse("Unauthorized", { status: 401 });
  const config = paymongoConfiguration();
  if (!config.ready) return new NextResponse("Billing unavailable", { status: 503 });
  const db = createAdminClient();
  const { data, error } = await db.from("billing_orders").select("*").eq("livemode", config.livemode).in("status", ["creating", "pending", "paid", "review"]).is("checkout_closed_at", null).not("checkout_session_id", "is", null).order("last_checked_at", { ascending: true, nullsFirst: true }).limit(20);
  if (error) {
    reportActionError("billing.paymongo.reconcile.load", error, "Reconciliation unavailable");
    return new NextResponse("Reconciliation unavailable", { status: 500 });
  }
  let synced = 0, failed = 0;
  // Small concurrent batches keep provider requests and route duration bounded.
  for (let offset = 0; offset < (data ?? []).length; offset += 5) {
    await Promise.all((data ?? []).slice(offset, offset + 5).map(async row => {
      try { await reconcilePaymongoOrder(row as BillingOrder); synced++; }
      catch (error) { failed++; reportActionError("billing.paymongo.reconcile.order", error, "Payment check failed"); }
      const saved = await db.from("billing_orders").update({ last_checked_at: new Date().toISOString() }).eq("id", row.id);
      if (saved.error) reportActionError("billing.paymongo.reconcile.touch", saved.error, "Payment check timestamp failed");
    }));
  }
  return NextResponse.json({ synced, failed }, { status: failed ? 207 : 200 });
}
