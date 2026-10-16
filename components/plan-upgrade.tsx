"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { IndustryKey } from "@/modules/platform/industry";
import { selectUpgrade, upgradeDestination, type UpgradeCapability, type UpgradeState } from "@/modules/platform/plan-upgrades";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { creditUsageSchema, planCreditLabel, type CreditUsage } from "@/modules/platform/credits";

type Context = { state: UpgradeState | null; industry: IndustryKey; isOwner: boolean };
type Notice = { capability: UpgradeCapability; description: string; href: string; isOwner: boolean };
const UpgradeContext = createContext<{ register: (capability: UpgradeCapability, limitReached: boolean) => void; notices: Notice[]; open: (capability: UpgradeCapability) => void } | null>(null);
export function PlanUpgradeProvider({ children, state, industry, isOwner }: Context & { children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [capability, setCapability] = useState<UpgradeCapability>("advanced_reports");
  const [usage, setUsage] = useState<CreditUsage | null>(null);
  const open = useCallback((value: UpgradeCapability) => {
    setCapability(value); dialog.current?.showModal();
    if (isOwner) void fetch("/api/dashboard/credits", {cache:"no-store"}).then(response=>response.json()).then(data=>{const parsed=creditUsageSchema.safeParse(data);if(parsed.success)setUsage(parsed.data);}).catch(()=>{});
  }, [isOwner]);
  const upgrade = selectUpgrade(state, industry, capability);
  const [requests, setRequests] = useState<Partial<Record<UpgradeCapability, boolean>>>({});
  const register = useCallback((capability: UpgradeCapability, limitReached: boolean) => {
    setRequests(current => current[capability] === limitReached || current[capability] === true ? current : { ...current, [capability]: limitReached });
  }, []);
  const notices = useMemo(() => Object.entries(requests).flatMap(([key, reached]) => {
    const capability = key as UpgradeCapability;
    const upgrade = selectUpgrade(state, industry, capability, reached);
    return upgrade ? [{ capability, description: upgrade.description, href: upgradeDestination(upgrade.plan.id, isOwner), isOwner }] : [];
  }), [requests, state, industry, isOwner]);
  const value = useMemo(() => ({ register, notices, open }), [register, notices, open]);
  return <UpgradeContext.Provider value={value}>{children}<dialog ref={dialog} id="upgrade-dialog" aria-labelledby="upgrade-dialog-title" className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-admin-border bg-white p-5 backdrop:bg-slate-950/40">
    <h2 id="upgrade-dialog-title" className="text-lg">{capability === "usage_credits" ? "Usage credits" : capability === "advanced_reports" ? "Advanced reporting" : "Plan access"}</h2>
    <p className="mt-2 text-sm">{upgrade?.description ?? "Compare plans for access to this feature."}</p>
    {state ? <p className="mt-3 text-sm">Current plan: {state.current.planName}{state.current.monthlyCredits ? ` · ${state.current.monthlyCredits} monthly credits` : state.current.oneTimeCredits ? ` · ${state.current.oneTimeCredits} one-time starter credits` : ""}</p> : null}
    {isOwner && usage ? <p className="text-sm">{usage.remaining} usage credits remaining{usage.monthlyAllowance ? ` · ${usage.monthlyAllowance} included this period` : ""}</p> : null}
    {upgrade ? <p className="mt-2 text-sm">Recommended: {upgrade.plan.name} · {planCreditLabel(upgrade.plan)}</p> : null}
    {!isOwner ? <p className="mt-2 text-sm">Ask the business owner to manage the subscription.</p> : null}
    <div className="mt-4 flex flex-wrap gap-2"><Button asChild><Link id="upgrade-compare-plans" href={upgrade ? upgradeDestination(upgrade.plan.id,isOwner) : isOwner ? "/dashboard/settings/billing#billing-plan-catalog" : "/plans"} onClick={()=>dialog.current?.close()}>Compare plans</Link></Button><Button id="upgrade-close" variant="secondary" onClick={()=>dialog.current?.close()}>Close</Button></div>
  </dialog></UpgradeContext.Provider>;
}

export function usePlanNotifications() { return useContext(UpgradeContext)?.notices ?? []; }

/** Register once per capability in this workspace session; never render an inline upsell. */
export function PlanUpgradeNotice({ capability, limitReached = false }: { compact?: boolean; id: string; capability: UpgradeCapability; limitReached?: boolean }) {
  const register = useContext(UpgradeContext)?.register;
  useEffect(() => { register?.(capability, limitReached); }, [register, capability, limitReached]);
  return null;
}

export function useUpgradeDialog() { return useContext(UpgradeContext)?.open; }
