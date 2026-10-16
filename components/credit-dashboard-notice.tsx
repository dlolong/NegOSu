"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useUpgradeDialog } from "@/components/plan-upgrade";
import { Button } from "@/components/ui/button";
import { creditStatusMessage, creditRefreshMessage, type CreditNotice } from "@/modules/platform/credits";

export function CreditDashboardNotice({ organizationId }: { organizationId: string }) {
  const openUpgrade = useUpgradeDialog();
  const pathname = usePathname();
  const [notice, setNotice] = useState<CreditNotice | null>(null);
  useEffect(() => {
    if (pathname !== "/dashboard") return;
    const controller = new AbortController();
    async function refresh() {
      try {
        const response = await fetch("/api/dashboard/notifications", { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (response.ok && data.organizationId === organizationId) setNotice(data.creditNotices?.find((item: CreditNotice) => !item.readAt) ?? null);
      } catch { /* Optional billing notice must not obstruct operations. */ }
    }
    void refresh();
    const timer = setInterval(refresh, 30000);
    window.addEventListener("negosu-usage-changed", refresh);
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener("negosu-usage-changed", refresh); };
  }, [pathname, organizationId]);
  async function dismiss() {
    if (!notice) return;
    const response = await fetch("/api/dashboard/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: notice.id }) }).catch(() => null);
    if (response?.ok) setNotice(null);
  }
  if (pathname !== "/dashboard" || !notice) return null;
  return <aside id={`credit-${notice.kind.toLowerCase()}-notice`} className="mx-auto mb-3 flex max-w-6xl flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-white p-3 text-sm">
    <div className="min-w-0 flex-1"><p>{creditStatusMessage(notice.kind)}</p><p className="text-xs text-admin-text-secondary">{creditRefreshMessage(notice.nextRefresh)} Core features remain available.</p></div>
    <Link id="dashboard-credit-view-usage" className="inline-flex min-h-11 items-center underline" href="/dashboard/settings/billing#account-credit-usage">View usage</Link>
    <Button id="dashboard-credit-compare-plans" variant="secondary" onClick={() => openUpgrade?.("usage_credits")}>Compare plans</Button>
    <Button id="dashboard-credit-dismiss" variant="ghost" onClick={() => void dismiss()}>Dismiss</Button>
  </aside>;
}
