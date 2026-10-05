"use client";

import Link from "next/link";
import { createContext, useContext, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { dashboardBackDestination } from "@/lib/dashboard-back-navigation";
import { Button } from "@/components/ui/button";

import { PageBack, PageBackProvider } from "@/components/page-back";

const NavigationContext = createContext<{ salon: boolean; industry?: string } | null>(null);
export function DashboardNavigationProvider({ salon, industry, children }: { salon: boolean; industry?: string; children: ReactNode }) {
  return <NavigationContext.Provider value={{ salon, industry }}><PageBackProvider>{children}</PageBackProvider></NavigationContext.Provider>;
}
export function DashboardBackLink() {
  const context = useContext(NavigationContext), pathname = usePathname();
  const destination = context ? dashboardBackDestination(pathname, context.salon, context.industry) : null;
  return destination ? <PageBack decorate={false}><nav id="dashboard-page-back-navigation" aria-label="Parent page">
    <Button id="dashboard-page-back-button" asChild variant="ghost" size="icon"><Link href={destination.href} aria-label={destination.label} title={destination.label}><ArrowLeft aria-hidden="true" size={20}/></Link></Button>
  </nav></PageBack> : null;
}
