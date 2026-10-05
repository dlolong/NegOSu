import type { ReactNode } from "react";

/** Command Center uses a full-height rail in the page scroll; other workspaces retain their compact rail. */
export function WorkspaceColumns({ id, sidebar, children, layout = "default" }: { id: string; sidebar: ReactNode; children: ReactNode; layout?: "default" | "command-center" }) {
  const commandCenter = layout === "command-center";
  return <div id={id} className={commandCenter ? "grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_17.5rem] 2xl:gap-6" : "mt-3 grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]"}>
    <div id={`${id}-primary`} className={commandCenter ? "mx-auto w-full min-w-0 max-w-5xl" : "min-w-0"}>{children}</div>
    <aside id={`${id}-sidebar`} tabIndex={commandCenter ? undefined : 0} aria-label="Shortcuts and business information" className={`${commandCenter ? "" : "xl:sticky xl:top-0 xl:max-h-[calc(100dvh-14rem)] xl:overflow-y-auto xl:overscroll-y-contain xl:pr-2 xl:[scrollbar-gutter:stable]"} grid min-w-0 gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary`}>{sidebar}</aside>
  </div>;
}
