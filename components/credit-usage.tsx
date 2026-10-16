"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecordTable } from "@/components/record-table";
import { creditUsageSchema, type CreditUsage } from "@/modules/platform/credits";

export function CreditUsageSection({ organizationId, initial }: { organizationId: string; initial: CreditUsage | null }) {
  const [usage, setUsage] = useState(initial), [page, setPage] = useState(1), [error, setError] = useState(initial ? "" : "Usage is temporarily unavailable."), [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null), controller = useRef<AbortController | null>(null);
  const load = useCallback(async (nextPage = page) => {
    controller.current?.abort(); const current = new AbortController(); controller.current = current; setBusy(true);
    try {
      const response = await fetch(`/api/dashboard/credits?page=${nextPage}`, { cache: "no-store", signal: current.signal }); const data = await response.json();
      const parsed = creditUsageSchema.safeParse(data);
      if (!response.ok || !parsed.success || data.organizationId !== organizationId) throw new Error("Usage could not be refreshed.");
      setUsage(parsed.data); setPage(nextPage); setError("");
    } catch { if (!current.signal.aborted) setError("Usage could not be refreshed. Try again shortly."); }
    finally { if (!current.signal.aborted) setBusy(false); }
  }, [organizationId, page]);
  useEffect(() => {
    const refresh = () => { if (!document.hidden) void load(); };
    const timer = setInterval(refresh, 30000); window.addEventListener("focus", refresh); window.addEventListener("negosu-usage-changed", refresh);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener("negosu-usage-changed", refresh); controller.current?.abort(); };
  }, [load]);
  function close() { dialog.current?.close(); document.getElementById("account-credit-history-button")?.focus(); }
  return <section id="account-credit-usage" className="my-4 min-w-0 rounded-xl border border-admin-border bg-admin-surface p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-medium">Usage credits</h2><p className="text-xs text-admin-text-secondary">Shared by your business. Everyday operations do not use credits.</p></div><Button id="account-credit-refresh" variant="secondary" disabled={busy} onClick={() => void load()}>Refresh usage</Button></div>
    {error ? <p id="account-credit-error" role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
    {usage ? <><p id="account-credit-remaining" className="mt-3 text-2xl">{usage.remaining.toLocaleString()} <span className="text-sm text-admin-text-secondary">remaining</span></p><p className="text-sm">{usage.oneTimeRemaining} of 100 one-time credits remaining</p>
      <progress id="account-credit-progress" aria-label="One-time credits remaining" max={100} value={usage.oneTimeRemaining} className="mt-2 h-2 w-full accent-brand-primary"/>
      {usage.nextRefresh ? <div className="mt-2 text-sm"><p>{usage.monthlyRemaining} / {usage.monthlyAllowance} included period credits remaining</p><p>Next refresh (UTC): {new Intl.DateTimeFormat("en-PH", { timeZone: "UTC", dateStyle: "medium" }).format(new Date(usage.nextRefresh))}</p></div> : <p className="mt-2 text-xs text-admin-text-secondary">One-time credits do not renew.</p>}
      {usage.reserved > 0 ? <p className="mt-2 text-xs">{usage.reserved} credits reserved for pending operations.</p> : null}

    </> : null}
    <div className="mt-3 flex flex-wrap gap-2"><Button id="account-credit-history-button" variant="secondary" onClick={() => { dialog.current?.showModal(); void load(1); }}>View usage history</Button></div>
    <dialog ref={dialog} id="credit-usage-dialog" aria-labelledby="credit-usage-title" onCancel={event => { event.preventDefault(); close(); }} className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-xl border border-admin-border bg-white p-4 backdrop:bg-slate-950/40">
      <header className="flex items-center justify-between gap-3"><h2 id="credit-usage-title" className="font-medium">Usage history</h2><Button id="credit-usage-close" variant="ghost" size="icon" aria-label="Close usage history" onClick={close}><X size={20}/></Button></header>
      {busy ? <p role="status" className="my-2 text-sm">Loading usage…</p> : null}
      {error ? <p role="alert" className="my-2 text-sm text-red-700">{error}</p> : null}
      <RecordTable id="credit-usage-table" caption="Credit usage" columns={[{ key: "date", label: "Date (UTC)" }, { key: "activity", label: "Activity" }, { key: "amount", label: "Credits" }, { key: "status", label: "Status" }]} rows={(usage?.history ?? []).map(row => ({ id: `credit-history-${row.id}`, cells: { date: new Intl.DateTimeFormat("en-PH", { timeZone: "UTC", dateStyle: "medium" }).format(new Date(row.createdAt)), activity: row.activity, amount: row.amount > 0 ? `+${row.amount}` : row.amount, status: row.status.toLowerCase() } }))} empty="No credit activity yet."/>
      <footer className="mt-3 flex items-center justify-between gap-3"><Button id="credit-usage-previous" disabled={busy || page === 1} variant="secondary" onClick={() => void load(page - 1)}>Previous</Button><span className="text-xs">Page {page}</span><Button id="credit-usage-next" disabled={busy || page * 25 >= (usage?.count ?? 0)} variant="secondary" onClick={() => void load(page + 1)}>Next</Button></footer>
    </dialog>
  </section>;
}
