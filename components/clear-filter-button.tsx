"use client";
import { useEffect, useRef, useState } from "react";
import { FilterX } from "lucide-react";
import Link from "next/link";
import { clearFiltersHref } from "@/lib/clear-filters";

export function ClearFilterButton({ id, formId, href: override }: { id: string; formId?: string; href?: string }) {
 const anchor = useRef<HTMLSpanElement>(null);
 const [href, setHref] = useState<string | null>(null);
 useEffect(() => {
  const form = formId ? document.getElementById(formId) : anchor.current?.closest("form");
  if (!(form instanceof HTMLFormElement)) return;
  const controls = [...form.elements].filter((element): element is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement =>
   element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement && !["hidden","submit","button"].includes(element.type));
  const update = () => {
   const result = clearFiltersHref(window.location.href, controls.map(control => control.name).filter(Boolean));
   setHref(result ? override ?? result : null);
  };
  update();
  window.addEventListener("popstate", update);
  return () => window.removeEventListener("popstate", update);
 });
 return <span ref={anchor} className={href ? "inline-flex" : "hidden"}>{href ? <Link id={id} href={href} aria-label="Clear filters" title="Clear filters" className="inline-flex size-11 shrink-0 items-center justify-center rounded-ui-md border border-admin-border-strong bg-admin-surface text-admin-text hover:bg-admin-surface-muted focus-visible:outline-2 focus-visible:outline-brand-primary"><FilterX size={18} aria-hidden="true"/></Link> : null}</span>;
}
