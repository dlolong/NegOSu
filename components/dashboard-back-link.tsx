"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { dashboardBackDestination } from "@/lib/dashboard-back-navigation";
import { Button } from "@/components/ui/button";

export function DashboardBackLink({ salon, industry }: { salon: boolean; industry?: string }) {
  const destination = dashboardBackDestination(usePathname(), salon, industry);
  return destination ? <nav id="dashboard-page-back-navigation" aria-label="Parent page" className="mx-auto mb-4 min-w-0 max-w-7xl print:hidden">
    <Button id="dashboard-page-back-button" asChild variant="ghost" size="sm"><Link href={destination.href}><ArrowLeft aria-hidden="true" size={16} className="shrink-0"/>{destination.label}</Link></Button>
  </nav> : null;
}
