"use client";

import Link from "next/link";
import type { ComponentProps, HTMLAttributes, MouseEvent } from "react";
import { Card, type CardProps } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// The named link remains the native keyboard/context-menu entry point. Row clicks
// delegate only non-interactive space; forms and secondary links keep their actions.
const interactive = 'a,button,input,select,textarea,label,summary,details,form,[role="button"],[role="link"],[contenteditable="true"],[data-record-ignore]';
function openRecord(event: MouseEvent<HTMLElement>) {
  if (event.defaultPrevented || event.altKey || (event.button !== 0 && event.button !== 1)) return;
  const target = event.target;
  if (!(target instanceof Element) || target.closest(interactive) || target.closest("[data-record-item]") !== event.currentTarget) return;
  if (window.getSelection()?.toString()) return;
  const link = event.currentTarget.querySelector<HTMLAnchorElement>('a[data-record-link]');
  if (!link || link.getAttribute("aria-disabled") === "true") return;
  event.preventDefault();
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) window.open(link.href, "_blank", "noopener,noreferrer");
  else link.click();
}
const interaction = "has-[[data-record-link]]:cursor-pointer has-[[data-record-link]]:hover:bg-brand-tint/30 has-[[data-record-link]]:focus-within:ring-2 has-[[data-record-link]]:focus-within:ring-inset has-[[data-record-link]]:focus-within:ring-brand-primary transition-colors";
export function RecordLink({ className, ...props }: ComponentProps<typeof Link>) {
  return <Link data-record-link className={cn("rounded-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary [overflow-wrap:anywhere]", className)} {...props}/>;
}
export function RecordRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr {...props} data-record-item className={cn(interaction, className)} onClick={openRecord} onAuxClick={openRecord}/>;
}
export function RecordItem({ as: Tag = "article", className, ...props }: HTMLAttributes<HTMLElement> & { as?: "article" | "li" | "div" }) {
  return <Tag {...props} data-record-item className={cn(interaction, "min-w-0", className)} onClick={openRecord} onAuxClick={openRecord}/>;
}
export function RecordCard({ className, ...props }: CardProps) {
  return <Card {...props} data-record-item className={cn(interaction, "min-w-0", className)} onClick={openRecord} onAuxClick={openRecord}/>;
}
