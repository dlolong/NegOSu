"use client";

import { createContext, useContext, type ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { IndustryKey } from "@/modules/platform/industry";
import { selectUpgrade, upgradeDestination, type UpgradeCapability, type UpgradeState } from "@/modules/platform/plan-upgrades";

type Context = { state: UpgradeState | null; industry: IndustryKey; isOwner: boolean };
const UpgradeContext = createContext<Context | null>(null);
export function PlanUpgradeProvider({ children, ...value }: Context & { children: ReactNode }) {
  return <UpgradeContext.Provider value={value}>{children}</UpgradeContext.Provider>;
}

/** Inline variant is safe in server-rendered pages and portaled form dialogs. */
export function PlanUpgradeNotice({ id, capability, limitReached = false, compact = false }: { compact?: boolean; id: string; capability: UpgradeCapability; limitReached?: boolean }) {
  const context = useContext(UpgradeContext);
  if (!context) return null;
  const { state, industry, isOwner } = context;
  const upgrade = selectUpgrade(state, industry, capability, limitReached);
  if (!upgrade) return null;
  return <aside id={id} aria-label="Plan upgrade" className={`flex min-w-0 flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between print:hidden col-span-full ${compact ? "w-full sm:w-auto sm:flex-1 sm:basis-80" : "rounded-xl border border-brand-border bg-brand-tint p-3"}`}>
    <div className="flex min-w-0 items-start gap-2">
      {!compact ? <Sparkles aria-hidden="true" size={17} className="mt-0.5 shrink-0 text-brand-primary"/> : null}
      <div className="min-w-0 [overflow-wrap:anywhere]"><p className="font-medium leading-snug text-admin-text">{upgrade.description}</p>
        {!isOwner ? <p className="mt-1 text-xs text-admin-text-secondary">Ask the owner to upgrade.</p> : null}
      </div>
    </div>
    <Button id={`${id}-button`} asChild variant="primary" size="lg" className="w-full shrink-0 sm:w-auto sm:min-w-40"><Link href={upgradeDestination(upgrade.plan.id, isOwner)}><ArrowUpRight aria-hidden="true" size={20}/>{isOwner ? "Upgrade plan" : "Compare plans"}</Link></Button>
  </aside>;
}
