"use client";
import { createContext, useContext, type ReactNode } from "react";
const LookupScope = createContext<string | null>(null);
export const useLookupScope = () => useContext(LookupScope);
export function LookupScopeProvider({ scope, children }: { scope: string; children: ReactNode }) {
  return <LookupScope.Provider value={scope}>{children}</LookupScope.Provider>;
}
