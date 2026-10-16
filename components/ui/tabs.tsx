"use client";

import Link from "next/link";
import {LinkPending} from "@/components/ui/link-pending";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export type TabItem = {
  id: string;
  label: string;
  href: string;
  active?: boolean;
  count?: number;
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

const tabBarClass = "min-w-0 overflow-x-auto overscroll-x-contain border-b border-admin-border";
function tabClass(active: boolean) {
  return cn("relative inline-flex min-h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-inset",
    active ? "border-brand-primary bg-brand-tint/40 text-brand-primary-strong" : "border-transparent text-admin-text-secondary hover:border-admin-border-strong hover:bg-admin-surface-muted hover:text-admin-text");
}
function TabCount({count}:{count?:number}) {
  return typeof count === "number" ? <span className="rounded-md bg-admin-surface-muted px-1.5 py-0.5 text-xs tabular-nums text-admin-text-secondary">{count}</span> : null;
}

/** Route tabs keep native link navigation and announce the current page. */
export function Tabs({ id, items, ariaLabel = "Sections", className }: { id: string; items: readonly TabItem[]; ariaLabel?: string; className?: string }) {
  const pathname = usePathname();
  const activeHref = resolveActiveTabHref(pathname, items);
  return <nav id={id} aria-label={ariaLabel} className={cn(tabBarClass, className)}>
    <div className="flex min-w-max gap-1 text-sm font-medium">{items.map(item => <Link id={item.id} key={item.id} href={item.href} aria-current={item.href === activeHref ? "page" : undefined} className={tabClass(item.href === activeHref)}><span>{item.label}</span><TabCount count={item.count}/><LinkPending/></Link>)}</div>
  </nav>;
}

/** In-page view selectors share the route-tab appearance without navigation. */
export function ViewTabs<T extends string>({id,items,value,onChange,ariaLabel="Views",className}:{id:string;items:readonly {id:string;value:T;label:string;count?:number}[];value:T;onChange:(value:T)=>void;ariaLabel?:string;className?:string}) {
  return <nav id={id} aria-label={ariaLabel} className={cn(tabBarClass,className)}><div className="flex min-w-max gap-1 text-sm font-medium">{items.map(item=><button type="button" id={item.id} key={item.id} aria-pressed={value===item.value} className={tabClass(value===item.value)} onClick={()=>onChange(item.value)}><span>{item.label}</span><TabCount count={item.count}/></button>)}</div></nav>;
}
