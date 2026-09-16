"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { refreshPaymentStatus } from "@/app/dashboard/settings/billing/paymongo-actions";
export function BillingPaymentRefresh({ orderId, auto }: { orderId: string; auto: boolean }) {
  const router = useRouter();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  async function check() {
    if (busy.current) return;
    busy.current = true; setPending(true);
    try { const result = await refreshPaymentStatus(orderId); setError(!result.ok); if (result.ok) router.refresh(); }
    catch { setError(true); }
    finally { busy.current = false; setPending(false); }
  }
  useEffect(() => {
    if (!auto) return;
    let attempts = 0;
    const timer = setInterval(async () => {
      if (document.visibilityState !== "visible" || busy.current || attempts >= 12) return;
      attempts++; busy.current = true;
      try { const result = await refreshPaymentStatus(orderId); setError(!result.ok); if (result.ok) router.refresh(); }
      catch { setError(true); }
      finally { busy.current = false; }
    }, 5_000);
    return () => clearInterval(timer);
  }, [orderId, auto, router]);
  return <div><Button id="billing-payment-refresh" disabled={pending} onClick={check} variant="secondary"><RefreshCw size={16} aria-hidden="true" className={pending ? "animate-spin" : ""}/>{pending ? "Checking…" : "Check payment"}</Button>{error ? <p id="billing-payment-refresh-error" role="alert" className="mt-2 max-w-sm text-sm text-status-danger">Payment status could not be checked. Please try again; do not pay again if money was deducted.</p> : null}</div>;
}
