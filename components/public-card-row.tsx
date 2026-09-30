import type { ReactNode } from "react";

export function PublicCardRow({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return <div className="min-w-0 max-w-full">
    <p id={`${id}-hint`} className="sr-only">Scroll horizontally to explore.</p>
    <div id={id} role="region" aria-label={label} aria-describedby={`${id}-hint`} tabIndex={0} className="grid min-w-0 max-w-full auto-cols-[85%] grid-flow-col gap-4 overflow-x-auto overscroll-x-contain snap-x snap-proximity p-1 pb-4 focus-visible:outline-2 focus-visible:outline-brand-primary sm:auto-cols-[calc((100%_-_1rem)/2)] lg:auto-cols-[calc((100%_-_2rem)/3)] [&>*]:min-w-0 [&>*]:snap-start">
      {children}
    </div>
  </div>;
}
