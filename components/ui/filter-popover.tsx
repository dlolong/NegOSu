"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FilterPopover({ id, title = "Filters", children }: { id: string; title?: string; children: ReactNode }) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const panelId = `${id}-popover`;

  useLayoutEffect(() => {
    const panel = panelRef.current, trigger = triggerRef.current;
    if (!open || !panel || !trigger) return;
    const viewport = window.visualViewport;
    const position = () => {
      const margin = 16, gap = 8;
      const left = viewport?.offsetLeft ?? 0, top = viewport?.offsetTop ?? 0;
      const width = viewport?.width ?? window.innerWidth, height = viewport?.height ?? window.innerHeight;
      panel.style.maxHeight = `${Math.max(0, height - margin * 2)}px`;
      panel.style.width = `${Math.min(384, Math.max(0, width - margin * 2))}px`;
      const anchor = trigger.getBoundingClientRect(), bounds = panel.getBoundingClientRect();
      const below = anchor.bottom + gap;
      const preferredTop = below + bounds.height <= top + height - margin ? below : anchor.top - gap - bounds.height;
      panel.style.left = `${Math.max(left + margin, Math.min(anchor.right - bounds.width, left + width - bounds.width - margin))}px`;
      panel.style.top = `${Math.max(top + margin, Math.min(preferredTop, top + height - bounds.height - margin))}px`;
    };
    position();
    const observer = new ResizeObserver(position);
    observer.observe(panel);
    observer.observe(trigger);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    viewport?.addEventListener("resize", position);
    viewport?.addEventListener("scroll", position);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      viewport?.removeEventListener("resize", position);
      viewport?.removeEventListener("scroll", position);
    };
  }, [open]);

  return <>
    <span ref={triggerRef} className="inline-flex">
      <Button id={`${id}-button`} variant="secondary" popoverTarget={panelId} aria-haspopup="dialog" aria-controls={panelId} aria-expanded={open}>
        <SlidersHorizontal size={16} aria-hidden="true"/>Filters
      </Button>
    </span>
    <div ref={panelRef} id={panelId} popover="auto" role="dialog" aria-labelledby={`${id}-title`} onToggle={event => setOpen(event.newState === "open")} className="fixed inset-auto left-4 top-4 m-0 max-h-[calc(100dvh-2rem)] w-[min(24rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-ui-lg border border-admin-border bg-admin-surface p-4 text-admin-text shadow-ui-lg">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id={`${id}-title`} className="text-base font-medium">{title}</h2>
        <Button id={`${id}-close-button`} variant="ghost" size="icon" popoverTarget={panelId} popoverTargetAction="hide" aria-label="Close filters"><X size={18} aria-hidden="true"/></Button>
      </div>
      {children}
    </div>
  </>;
}
