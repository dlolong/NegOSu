import Link from "next/link";
import { CompactFilters } from "@/components/compact-filters";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function ListingFilters({ id, action, query, searchId, clearHref, searchLabel = "Search records", options = [], parameter = "status", dates = false }: {
  id: string; action: string; searchId?: string; clearHref?: string; query: Record<string, string | undefined>; searchLabel?: string;
  options?: { value: string; label: string }[]; parameter?: string; dates?: boolean;
}) {
  return <CompactFilters id={id} action={action} searchLabel={searchLabel} searchValue={query.q ?? ""} search={<div className="flex gap-2"><Input id={searchId ?? `${id}-search`} name="q" defaultValue={query.q} placeholder={searchLabel} maxLength={120}/><Button id={`${id}-search-submit`} type="submit" size="sm">Search</Button></div>}
    hiddenFields={Object.entries(query).filter(([key, value]) => value && !["q", "page", "from", "to", "dialog", "error", "message", ...(options.length ? [parameter] : [])].includes(key)).map(([key, value]) => <input key={key} type="hidden" name={key} value={value}/>)}
    hasFilters={options.length > 0 || dates} clearAction={<Button asChild variant="ghost" size="sm"><Link id={`${id}-clear`} href={clearHref ?? action}>Clear</Link></Button>}>
    {options.length ? <label className="text-sm">Filter<select id={`${id}-${parameter}`} name={parameter} defaultValue={query[parameter] ?? options[0].value} className="mt-1 min-h-11 w-full rounded-md border border-admin-border px-3">{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label> : null}
    {dates ? <><label className="text-sm">From date (UTC)<Input id={`${id}-from`} name="from" type="date" defaultValue={query.from}/></label><label className="text-sm">Through date (UTC)<Input id={`${id}-to`} name="to" type="date" defaultValue={query.to}/></label></> : null}
    <Button id={`${id}-apply`} type="submit" size="sm">Apply</Button>
  </CompactFilters>;
}
