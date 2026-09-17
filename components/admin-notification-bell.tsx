"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bell, CalendarCheck, CalendarDays, CheckCircle2, ChevronRight, MessageCircle, Package, RefreshCw, Wrench, X } from "lucide-react";
import type { AttentionKind, AttentionSnapshot } from "@/modules/platform/admin-attention";
import { Button } from "@/components/ui/button";

class NotificationReadError extends Error {}

const icons = { messages: MessageCircle, bookings: CalendarCheck, appointments: CalendarDays, stock: Package, jobs: Wrench } satisfies Record<AttentionKind, typeof Bell>;

export function AdminNotificationBell({ organizationId, branchId, branchName }: { organizationId: string; branchId: string; branchName: string }) {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const refresh = useRef<(() => void) | null>(null);
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<AttentionSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let disposed = false;
    let controller: AbortController | null = null;
    async function load() {
      if (controller || disposed) return;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 10_000);
      setLoading(true);
      try {
        const response = await fetch("/api/dashboard/notifications", { cache: "no-store", credentials: "same-origin", signal: controller.signal });
        if (!response.ok) throw new NotificationReadError(response.status === 401 ? "Please sign in again to view notifications." : "Notifications could not be refreshed.");
        const data = await response.json() as AttentionSnapshot;
        if (data.organizationId !== organizationId || data.branchId !== branchId) throw new NotificationReadError("Your workspace changed. Refresh this page to view its notifications.");
        if (!disposed) { setSnapshot(data); setError(""); }
      } catch (failure) { if (!disposed) { setSnapshot(null); setError(failure instanceof NotificationReadError ? failure.message : "Notifications could not be refreshed. Try again."); } }
      finally { clearTimeout(timeout); controller = null; if (!disposed) setLoading(false); }
    }
    refresh.current = () => { void load(); };
    void load();
    const refreshVisible = () => { if (!document.hidden) void load(); };
    const timer = setInterval(refreshVisible, 30_000);
    document.addEventListener("visibilitychange", refreshVisible);
    window.addEventListener("focus", refreshVisible);
    return () => { disposed = true; clearInterval(timer); controller?.abort(); refresh.current = null; document.removeEventListener("visibilitychange", refreshVisible); window.removeEventListener("focus", refreshVisible); };
  }, [organizationId, branchId, pathname]);

  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    element?.showModal();
    refresh.current?.();
    return () => element?.close();
  }, [open]);
  function close() { setOpen(false); dialog.current?.close(); trigger.current?.focus(); }
  const total = snapshot?.total ?? 0;
  const partial = Boolean(snapshot?.unavailable.length);
  const label = error ? "Notifications unavailable" : partial ? `Notifications: ${total} items, some updates unavailable` : loading && !snapshot ? "Loading notifications" : `Notifications: ${total} items need attention`;
  return <>
    <button ref={trigger} id="dashboard-notification-bell" type="button" title="Notifications" aria-label={label} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)} className="relative grid size-11 shrink-0 place-items-center rounded-full border border-admin-border bg-admin-surface text-admin-text hover:bg-admin-surface-muted focus-visible:ring-2 focus-visible:ring-brand-primary"><Bell size={20} aria-hidden="true"/>{total > 0 ? <span id="dashboard-notification-count" aria-hidden="true" className="absolute -right-1 -top-1 min-w-5 rounded-full bg-status-danger px-1 text-center text-[10px] font-medium leading-5 text-white">{total > 99 ? "99+" : total}</span> : error || partial ? <span id="dashboard-notification-warning" aria-hidden="true" className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-amber-500 text-[10px] font-medium text-slate-950">!</span> : null}</button>
    <dialog ref={dialog} id="dashboard-notification-dialog" aria-labelledby="dashboard-notification-title" onCancel={event => { event.preventDefault(); close(); }} className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-hidden rounded-ui-lg border border-admin-border bg-admin-surface p-0 text-admin-text shadow-ui-md backdrop:bg-slate-950/40">
      <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-admin-border p-4"><div className="min-w-0"><h2 id="dashboard-notification-title" className="font-medium">Needs attention</h2><p className="mt-1 text-sm text-admin-text-secondary [overflow-wrap:anywhere]">{branchName}</p></div><Button id="dashboard-notification-close" variant="ghost" size="icon" aria-label="Close notifications" onClick={close}><X size={20} aria-hidden="true"/></Button></header>
        <div id="dashboard-notification-content" className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4">
          {loading && !snapshot ? <p id="dashboard-notification-loading" role="status" className="text-sm text-admin-text-secondary">Checking for updates…</p> : null}
          {error ? <p id="dashboard-notification-error" role="alert" className="rounded-ui-md bg-status-warning-tint p-3 text-sm text-status-warning">{error}</p> : null}
          {partial ? <p id="dashboard-notification-partial" role="status" className="rounded-ui-md bg-status-warning-tint p-3 text-sm text-status-warning">Some updates are unavailable: {snapshot!.unavailable.join(", ")}. The count includes only available updates.</p> : null}
          {snapshot?.items.map(item => { const Icon = icons[item.id]; return <Link id={`dashboard-notification-${item.id}`} key={item.id} href={item.href} onClick={close} className="flex min-w-0 items-center gap-3 rounded-ui-md border border-admin-border p-3 hover:bg-brand-tint focus-visible:ring-2 focus-visible:ring-brand-primary"><Icon size={20} aria-hidden="true" className="shrink-0 text-brand-primary-strong"/><div className="min-w-0 flex-1 [overflow-wrap:anywhere]"><p className="text-sm font-medium">{item.title}</p><p className="mt-1 text-xs text-admin-text-secondary">{item.description}</p></div><span className="font-medium tabular-nums">{item.count}</span><ChevronRight size={16} aria-hidden="true" className="shrink-0"/></Link>; })}
          {snapshot && !total && !partial && !error ? <div id="dashboard-notification-empty" className="py-6 text-center"><CheckCircle2 size={28} aria-hidden="true" className="mx-auto text-status-success"/><p className="mt-3 font-medium">You’re all caught up</p><p className="mt-1 text-sm text-admin-text-secondary">No pending items for your role in this branch.</p></div> : null}
        </div>
        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-admin-border p-4"><p className="text-xs text-admin-text-secondary">Items clear when the work is resolved.</p><Button id="dashboard-notification-refresh" variant="secondary" size="icon" aria-label="Refresh notifications" title="Refresh notifications" disabled={loading} onClick={() => refresh.current?.()}><RefreshCw size={18} aria-hidden="true" className={loading ? "animate-spin" : ""}/></Button></footer>
      </div>
    </dialog>
  </>;
}
