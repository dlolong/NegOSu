"use client";

import { useRef, useState, type ReactNode } from "react";
import { Search, X } from "lucide-react";
import { FilterPopover } from "@/components/ui/filter-popover";
import { cn } from "@/lib/utils";

/** One GET form keeps search, filters and current-view fields together even
 * when controls are collapsed. Each page still owns its query contract. */
export function CompactFilters({ id, action, search, searchLabel = "Search records", searchValue = "", children, hiddenFields, hasFilters = false, clearAction, className }: {
  id: string; action?: string; search?: ReactNode; searchLabel?: string; searchValue?: string;
  children?: ReactNode; hiddenFields?: ReactNode; hasFilters?: boolean; clearAction?: ReactNode; className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLDivElement>(null);
  function closeSearch() {
    setExpanded(false);
    trigger.current?.focus();
  }
  return <form id={id} action={action} method="get" className={cn("my-3 flex min-w-0 flex-wrap items-center justify-end gap-2", className)}>
    {hiddenFields}
    {/* First submitter preserves native Enter-to-search with several filter fields. */}
    <button type="submit" hidden aria-hidden="true" tabIndex={-1}/>
    {search ? <>
      <button ref={trigger} id={`${id}-search-toggle`} type="button" aria-label={expanded ? "Hide search" : searchLabel} title={expanded ? "Hide search" : searchLabel} aria-expanded={expanded} aria-controls={`${id}-search-field`} className="relative inline-flex size-11 shrink-0 items-center justify-center rounded-ui-md border border-admin-border-strong bg-admin-surface text-admin-text hover:bg-admin-surface-muted" onClick={() => {
        if (expanded) closeSearch();
        else {
          setExpanded(true);
          requestAnimationFrame(() => field.current?.querySelector("input")?.focus());
        }
      }}>
        {expanded ? <X size={18} aria-hidden="true"/> : <Search size={18} aria-hidden="true"/>}
        {searchValue && !expanded ? <span aria-hidden="true" className="absolute right-1.5 top-1.5 size-2 rounded-full bg-brand-primary"/> : null}
      </button>
      <div ref={field} id={`${id}-search-field`} hidden={!expanded} className="min-w-0 flex-1 sm:max-w-sm" onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); closeSearch(); }
      }}>
        <label className="block min-w-0"><span className="sr-only">{searchLabel}</span>{search}</label>
      </div>
    </> : null}
    {hasFilters ? <FilterPopover id={`${id}-filters`} iconOnly>
      <div className="grid min-w-0 gap-3 [&>select]:w-full [&>select]:min-w-0 [&>button]:w-full">{children}</div>
    </FilterPopover> : <div hidden>{children}</div>}
    {clearAction}
    {searchValue && !expanded ? <span id={`${id}-search-summary`} className="max-w-full truncate text-xs text-admin-text-secondary" title={`Search: ${searchValue}`}>Search: {searchValue}</span> : null}
  </form>;
}
