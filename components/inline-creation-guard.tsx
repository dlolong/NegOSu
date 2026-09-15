"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
// An inline editor is deliberately not a nested form. Block the enclosing save
// until it is saved or cancelled, including Enter-key submissions.
export function InlineCreationGuard({ children }: { children: ReactNode }) {
  const element = useRef<HTMLDivElement>(null), [blocked, setBlocked] = useState(false);
  useEffect(() => {
    const form = element.current?.closest("form");
    const block = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); setBlocked(true); element.current?.querySelector<HTMLInputElement>("input:not([type=hidden]):not(:disabled)")?.focus(); };
    form?.addEventListener("submit", block, true);
    return () => form?.removeEventListener("submit", block, true);
  }, []);
  return <div ref={element} className="min-w-0" onKeyDown={event => { if (event.key === "Enter" && event.target instanceof HTMLInputElement) event.preventDefault(); }}>{children}{blocked ? <p role="alert" className="mt-2 text-sm text-status-danger">Save or cancel the new record before submitting this form.</p> : null}</div>;
}
