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
  return <aside id={id} aria-label="Plan upgrade" className={`flex min-w-0 flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between print:hidden col-span-full ${compact ? "w-full" : "rounded-xl border border-brand-border bg-brand-tint p-3"}`}>
    <div className="flex min-w-0 items-start gap-2">
      {!compact ? <Sparkles aria-hidden="true" size={17} className="mt-0.5 shrink-0 text-brand-primary"/> : null}
      <div className="min-w-0 [overflow-wrap:anywhere]"><p className="font-medium text-admin-text">{upgrade.description}</p>
        {!isOwner ? <p className="mt-1 text-xs text-admin-text-secondary">Ask the business owner to upgrade this workspace.</p> : null}
      </div>
    </div>
    <Button id={`${id}-button`} asChild variant="secondary" size="sm" className="w-full shrink-0 sm:w-auto"><Link href={upgradeDestination(upgrade.plan.id, isOwner)}><ArrowUpRight aria-hidden="true" size={16}/>{isOwner ? "Upgrade plan" : "Compare plans"}</Link></Button>
  </aside>;
}
