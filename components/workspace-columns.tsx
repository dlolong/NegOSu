import type { ReactNode } from "react";

/** Supporting cards scroll independently on desktop; mobile keeps normal page scrolling. */
export function WorkspaceColumns({ id, sidebar, children }: { id: string; sidebar: ReactNode; children: ReactNode }) {
  return <div id={id} className="mt-3 grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
    <div id={`${id}-primary`} className="min-w-0">{children}</div>
    <aside id={`${id}-sidebar`} tabIndex={0} aria-label="Shortcuts and business information" className="grid min-w-0 gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary xl:sticky xl:top-0 xl:max-h-[calc(100dvh-14rem)] xl:overflow-y-auto xl:overscroll-y-contain xl:pr-2 xl:[scrollbar-gutter:stable]">{sidebar}</aside>
  </div>;
}
