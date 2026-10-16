import Link from "next/link";
import { CompactFilters } from "@/components/compact-filters";
import { RecordTable } from "@/components/record-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/operations";
import type { ClientPurchaseFilters, ClientPurchaseReport } from "@/modules/core/reporting/client-purchase-report";

const base = "/dashboard/reports/clients";
const fieldClass = "block min-h-11 w-full min-w-0 rounded-xl border border-admin-border bg-white px-3 text-sm";
type Props = { filters: ClientPurchaseFilters; range: { start: string; end: string }; branches: readonly { id: string; name: string }[]; currency: string; report: ClientPurchaseReport; toolbarSearch?: boolean; onPageChange?: (page: number) => void };

export function ClientPurchases({ filters, range, branches, currency, report, onPageChange, toolbarSearch = false }: Props) {
  const pages = Math.max(1, Math.ceil(report.count / 50));
  function pageHref(page: number) {
    return `${base}?${new URLSearchParams({ ...filters, start: range.start, end: range.end, page: String(page) })}`;
  }
  const items = (row: ClientPurchaseReport["rows"][number], kind: "service" | "product" | "other") => {
    const selected = row.items.filter(item => item.kind === kind);
    return selected.length ? <ul className="space-y-1">{selected.map((item, index) => <li key={index}>{item.name}<span className="text-admin-text-secondary"> · {item.quantity.toLocaleString("en-PH", { maximumFractionDigits: 3 })}{item.unit ? ` ${item.unit}` : ""}{item.included ? " · Promo inclusion" : ""}</span></li>)}</ul> : <span className="text-admin-text-muted">None</span>;
  };
  return <>
    {!onPageChange ? <CompactFilters key={JSON.stringify([filters, range])} id="client-purchases-filters" action={base} hasFilters clearHref={base} searchLabel="Search clients" searchValue={filters.q}
      search={<Input id="client-purchases-client-search" name="q" type="search" maxLength={120} defaultValue={filters.q} placeholder="Client name"/>}>
      <label className="text-sm">Period<select id="client-purchases-period" name="preset" defaultValue={filters.preset} className={fieldClass}><option value="today">Today</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="month">This month</option><option value="custom">Custom dates</option></select></label>
      <label className="text-sm">Custom start<Input id="client-purchases-start" name="start" type="date" defaultValue={range.start}/></label>
      <label className="text-sm">Custom end<Input id="client-purchases-end" name="end" type="date" defaultValue={range.end}/></label>
      <label className="text-sm">Branch<select id="client-purchases-branch" name="branch" defaultValue={filters.branch} className={fieldClass}><option value="all">All accessible branches</option>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
      <label className="text-sm">Records containing<select id="client-purchases-kind" name="kind" defaultValue={filters.kind} className={fieldClass}><option value="all">Any purchase type</option><option value="service">Services / treatments</option><option value="product">Products</option><option value="other">Other charges</option></select></label>
      <label className="text-sm">Service or product name<Input id="client-purchases-item-search" name="item" maxLength={120} defaultValue={filters.item} placeholder="Any item name"/></label>
      <Button id="client-purchases-apply" type="submit">Apply filters</Button>
    </CompactFilters> : null}
    <p id="client-purchases-scope" className="text-sm text-admin-text-secondary">{range.start} – {range.end} · {filters.branch === "all" ? "All accessible branches" : branches.find(branch => branch.id === filters.branch)?.name} · {report.count} client{report.count === 1 ? "" : "s"} with purchases · {report.summary.records} records</p>
    {filters.kind !== "all" || filters.item ? <p className="mt-1 text-sm">Matching records: {filters.kind === "all" ? "any purchase type" : filters.kind === "service" ? "services / treatments" : filters.kind === "product" ? "products" : "other charges"}{filters.item ? ` · “${filters.item}”` : ""}. Items and totals include the entire matching appointment or bill.</p> : null}
    {!toolbarSearch ? <dl id="client-purchases-totals" className="my-4 grid gap-3 sm:grid-cols-3">{[["Total billed", report.summary.total], ["Paid to date", report.summary.paid], ["Balance", report.summary.balance]].map(([label, amount]) => <div key={label} className="rounded-xl border border-admin-border bg-admin-surface p-4"><dt className="text-sm text-admin-text-secondary">{label}</dt><dd className="mt-1 text-xl font-medium">{formatMoney(Number(amount), currency)}</dd></div>)}</dl> : null}
    <RecordTable reportSearch={toolbarSearch} id="client-purchases-table" caption="Client purchases" columns={[{ key: "client", label: "Client" }, { key: "staff", label: "Staff" }, { key: "services", label: "Services / treatments" }, { key: "products", label: "Products" }, { key: "other", label: "Other charges" }, { key: "total", label: "Total billed", align: "right" }]} rows={report.rows.map(row => ({ id: `client-purchase-${row.key}`, cells: {
      client: <>{row.clientId ? <Link id={`client-purchases-open-${row.clientId}`} className="font-medium underline" href={`/dashboard/customers/${row.clientId}`}>{row.name}</Link> : <><span className="font-medium">{row.name}</span><small className="block">Unlinked bill · kept separate</small></>}<small className="mt-1 block text-admin-text-secondary">{row.branches.join(", ")}<br/>{row.records} records · Last: {row.lastActivity}</small></>,
      staff: row.staff.length ? <ul className="space-y-1">{row.staff.map(person => <li key={person.id}>{person.name}</li>)}</ul> : <span className="text-admin-text-muted">Not recorded</span>,
      services: items(row, "service"), products: items(row, "product"), other: items(row, "other"),
      total: <><strong className="font-medium">{formatMoney(row.total, currency)}</strong><small className="mt-1 block text-admin-text-secondary">Paid {formatMoney(row.paid, currency)}<br/>Balance {formatMoney(row.balance, currency)}</small></>,
    } }))} empty="No client purchases match these filters."/>
    <nav id="client-purchases-pagination" aria-label="Client purchase pages" className="my-4 flex flex-wrap items-center justify-between gap-3">
      {filters.page > 1 ? onPageChange ? <Button id="client-purchases-previous" variant="secondary" onClick={() => onPageChange(filters.page - 1)}>Previous</Button> : <Link id="client-purchases-previous" className="inline-flex min-h-11 items-center underline" href={pageHref(Math.min(filters.page - 1, pages))}>Previous</Link> : <span/>}
      <span className="text-sm">Page {filters.page} of {pages} · Up to 50 clients per page</span>
      {filters.page < pages ? onPageChange ? <Button id="client-purchases-next" variant="secondary" onClick={() => onPageChange(filters.page + 1)}>Next</Button> : <Link id="client-purchases-next" className="inline-flex min-h-11 items-center underline" href={pageHref(filters.page + 1)}>Next</Link> : null}
    </nav>
    <p className="text-xs text-admin-text-secondary">Staff lists the people linked to matching visits, jobs, or stays; standalone product sales may have no recorded staff. Totals cover all matching clients across pages. Completed service visits use their appointment date; posted bills use their issue date, in each branch’s timezone. Paid and balance are current amounts on those records, not collections during the period. Drafts and voids are excluded. Promo inclusions add no extra charge. Refunds and physical returns are reported separately. Other charges include accommodation and items without a saved category.</p>
  </>;
}
