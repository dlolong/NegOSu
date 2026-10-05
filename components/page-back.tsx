"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft } from "lucide-react";

const BackTarget = createContext<HTMLElement | null>(null);

/** Put page-owned navigation before layout-owned tabs without changing its destination. */
export function PageBackProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  return <BackTarget.Provider value={target}>
    <div ref={setTarget} data-page-back-target className="mb-3 empty:hidden print:hidden" />
    {children}
  </BackTarget.Provider>;
}

export function PageBack({ children, decorate = true }: { children: ReactNode; decorate?: boolean }) {
  const target = useContext(BackTarget);
  if (children === null || children === false) return null;
  const control = <div data-page-back-slot className="mb-3 w-fit max-w-full print:hidden">
    {decorate ? <div className="relative inline-flex max-w-full items-center">
      <ArrowLeft aria-hidden="true" size={20} className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2" />
      <div className="min-w-0 [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center [&_a]:pl-10 [&_button]:min-h-11 [&_button]:pl-10 [&_svg]:hidden">{children}</div>
    </div> : children}
  </div>;
  return target ? createPortal(control, target) : control;
}
