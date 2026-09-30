"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export type TabItem = {
  id: string;
  label: string;
  href: string;
  active?: boolean;
  count?: number;
  description?: string;
};

function pathMatches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function resolveActiveTabHref(pathname: string, items: readonly TabItem[]) {
  if (items.some((item) => item.active !== undefined)) {
    return items.find((item) => item.active)?.href;
  }
  return [...items]
    .filter((item) => pathMatches(pathname, item.href))
    .sort((first, second) => second.href.length - first.href.length)[0]?.href;
}

export function Tabs({ id, items, ariaLabel = "Sections", className, variant = "underline" }: { id: string; items: readonly TabItem[]; ariaLabel?: string; className?: string; variant?: "underline" | "cards" | "wrap" }) {
  const pathname = usePathname();
  const activeHref = resolveActiveTabHref(pathname, items);
  return <nav id={id} aria-label={ariaLabel} className={cn(variant === "underline" ? "overflow-x-auto overscroll-x-contain border-b border-admin-border" : "min-w-0", className)}>
    <div className={variant === "cards" ? "grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6" : variant === "wrap" ? "flex flex-wrap gap-2" : "flex min-w-max gap-1"}>
      {items.map((item) => {
        const active = item.href === activeHref;
        return <Link
        id={item.id}
        key={item.id}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "min-h-11 min-w-0 px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-inset",
          variant === "cards" ? "flex flex-col items-start justify-start gap-1 rounded-ui-md border p-3 [overflow-wrap:anywhere]" : "inline-flex items-center gap-2",
          variant === "wrap" ? "rounded-ui-md border" : variant === "underline" ? "border-b-2" : "",
          active ? `border-brand-primary text-brand-primary-strong ${variant !== "underline" ? "bg-brand-tint" : ""}` : `${variant === "underline" ? "border-transparent" : "border-admin-border bg-admin-surface"} text-admin-text-secondary hover:border-admin-border-strong hover:text-admin-text`,
        )}
      ><span>{item.label}</span>{typeof item.count === "number" ? <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{item.count}</span> : null}{variant === "cards" && item.description ? <span className="text-xs font-normal leading-relaxed text-admin-text-secondary">{item.description}</span> : null}</Link>;
      })}
    </div>
  </nav>;
}
