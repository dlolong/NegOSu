"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { IndustryKey } from "@/modules/platform/industry";
import { selectUpgrade, upgradeDestination, type UpgradeCapability, type UpgradeState } from "@/modules/platform/plan-upgrades";

type Context = { state: UpgradeState | null; industry: IndustryKey; isOwner: boolean };
type Notice = { capability: UpgradeCapability; description: string; href: string; isOwner: boolean };
const UpgradeContext = createContext<{ register: (capability: UpgradeCapability, limitReached: boolean) => void; notices: Notice[] } | null>(null);
export function PlanUpgradeProvider({ children, state, industry, isOwner }: Context & { children: ReactNode }) {
  const [requests, setRequests] = useState<Partial<Record<UpgradeCapability, boolean>>>({});
  const register = useCallback((capability: UpgradeCapability, limitReached: boolean) => {
    setRequests(current => current[capability] === limitReached || current[capability] === true ? current : { ...current, [capability]: limitReached });
  }, []);
  const notices = useMemo(() => Object.entries(requests).flatMap(([key, reached]) => {
    const capability = key as UpgradeCapability;
    const upgrade = selectUpgrade(state, industry, capability, reached);
    return upgrade ? [{ capability, description: upgrade.description, href: upgradeDestination(upgrade.plan.id, isOwner), isOwner }] : [];
  }), [requests, state, industry, isOwner]);
  const value = useMemo(() => ({ register, notices }), [register, notices]);
  return <UpgradeContext.Provider value={value}>{children}</UpgradeContext.Provider>;
}

export function usePlanNotifications() { return useContext(UpgradeContext)?.notices ?? []; }

/** Register once per capability in this workspace session; never render an inline upsell. */
export function PlanUpgradeNotice({ capability, limitReached = false }: { compact?: boolean; id: string; capability: UpgradeCapability; limitReached?: boolean }) {
  const register = useContext(UpgradeContext)?.register;
  useEffect(() => { register?.(capability, limitReached); }, [register, capability, limitReached]);
  return null;
}
