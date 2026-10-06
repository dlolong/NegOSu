import { withProductPhotos } from "@/modules/core/catalog/product-photos";
import { InventoryConsumptionCards } from "@/components/inventory-consumption-cards";
import { Tabs } from "@/components/ui/tabs";
import { requireIndustryFeature } from "@/lib/auth/industry-access";
import { CompactFilters } from "@/components/compact-filters";
import { Input } from "@/components/ui/input";
import { InventoryConsumptionMatrix } from "@/components/inventory-consumption-matrix";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { roleHasPermission } from "@/lib/rbac";
import { inventoryReportQuery, inventoryReportRange, type InventoryReport } from "@/lib/inventory-report";
import { PageTitle } from "@/components/page-title";
import { Button } from "@/components/ui/button";

export default async function InventoryReportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireIndustryFeature("inventory");
  const [{ activeMembership: m }, raw, db] = await Promise.all([getDashboardContext(), searchParams, createClient()]);
  if (!roleHasPermission(m.role, "reports.view")) notFound();
  const parsed = inventoryReportQuery.safeParse(raw);
  const query = parsed.success ? parsed.data : inventoryReportQuery.parse({});
  const date = query.date ?? new Intl.DateTimeFormat("en-CA", { timeZone: m.timezone }).format(new Date());
  const branch = query.branch === "all" || m.branches.some(b => b.id === query.branch) ? query.branch! : m.branchId;
  const range = query.start && query.end ? { start: query.start, end: query.end } : inventoryReportRange(query.period, date);
  const { data, error } = await db.rpc("get_inventory_consumption_report", {
    p_org: m.organizationId, p_branch: branch === "all" ? null : branch,
    p_start: range.start, p_end: range.end, p_page: query.page, p_search: query.q, p_category: query.category,
  });
  const report = data as InventoryReport | null;
  if (report && !error) report.rows = await withProductPhotos(db, m.organizationId, report.rows);
  const href = (page = 1, view = query.view) => `/dashboard/inventory/consumption?${new URLSearchParams({ start: range.start, end: range.end, branch, q: query.q, category: query.category, view, page: String(page) })}`;
  const number = (value: number) => new Intl.NumberFormat("en", { maximumFractionDigits: 3 }).format(value);
  return <main id="inventory-report-page" className="mx-auto min-w-0 max-w-7xl">
    <PageTitle back={<Link className="inline-flex min-h-11 items-center underline" href="/dashboard/inventory">Back to inventory</Link>} className="text-2xl">{query.view === "overview" ? "Inventory overview" : "Consumption & history"}</PageTitle>
    <Tabs id="inventory-consumption-tabs" ariaLabel="Inventory views" className="mt-4" items={[
      {id:"inventory-consumption-stock-tab",label:"Stock",href:"/dashboard/inventory",active:false},
      {id:"inventory-consumption-overview-tab",label:"Overview",href:href(1, "overview"),active:query.view === "overview"},
      {id:"inventory-consumption-active-tab",label:"Consumption & history",href:href(1, "cards"),active:query.view !== "overview"},
    ]}/>


    {!parsed.success ? <p role="alert" className="mt-3 text-sm">Invalid filters were reset. Choose both dates in order, with a maximum of 367 days.</p> : null}

    <CompactFilters id="inventory-report-filters" hiddenFields={<input type="hidden" name="view" value={query.view}/>} hasFilters searchLabel="Search products" searchValue={query.q} search={<Input id="inventory-report-search" name="q" defaultValue={query.q} maxLength={120} placeholder="Search product name or SKU"/>}>
      <label className="grid gap-1 text-sm" htmlFor="inventory-report-start">From<input className="min-h-11 rounded-xl border border-admin-border bg-white px-3" id="inventory-report-start" name="start" type="date" defaultValue={range.start} required/></label>
      <label className="grid gap-1 text-sm" htmlFor="inventory-report-end">To<input className="min-h-11 rounded-xl border border-admin-border bg-white px-3" id="inventory-report-end" name="end" type="date" defaultValue={range.end} required/></label>
      <label className="grid gap-1 text-sm" htmlFor="inventory-report-branch">Branch<select className="min-h-11 max-w-full rounded-xl border border-admin-border bg-white px-3" id="inventory-report-branch" name="branch" defaultValue={branch}><option value="all">All accessible branches</option>{m.branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
      <label className="grid gap-1 text-sm" htmlFor="inventory-report-category">Category<select id="inventory-report-category" name="category" defaultValue={query.category} className="min-h-11 rounded-xl border border-admin-border bg-white px-3"><option value="">All categories</option>{[...new Set([...(report?.categories ?? []), ...(query.category ? [query.category] : [])])].map(category => <option key={category} value={category}>{category}</option>)}</select></label>
      <Button id="inventory-report-apply" type="submit">Apply</Button>
    </CompactFilters>
      <p className="mb-3 text-xs text-admin-text-secondary">{range.start} to {range.end} · {report?.count ?? 0} products{query.q ? " matching search" : ""}</p>
    {error || !report ? <p id="inventory-report-error" role="alert" className="rounded-xl border border-admin-border p-5">Unable to load inventory. Please try again.</p> : <>
      {query.view === "overview" ? <>
      <section id="inventory-report-totals" aria-label="Inventory totals" className="my-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {(report?.totals ?? []).flatMap(t => [["Opening", t.opening], ["Stock in", t.received], ["Consumed", t.consumed], ["Waste", t.waste], ["Other net", t.other], ["Closing", t.closing]].map(([label, value]) => <div key={`${t.unit}-${label}`} className="rounded-xl border border-admin-border bg-white p-3"><p className="text-xs text-admin-text-secondary">{label} · {t.unit}</p><p className="mt-1 text-xl font-semibold text-brand-primary-strong">{number(Number(value))}</p></div>))}
      </section>
        {!report.totals.length ? <p className="p-4 text-sm">No tracked products match these filters.</p> : null}
      </> : <>
        <div className="my-4 flex flex-wrap items-center justify-between gap-3">
          <Tabs id="inventory-activity-views" ariaLabel="Consumption and history views" items={[
            {id:"inventory-monthly-view",label:"Monthly products",href:href(1, "cards"),active:query.view === "cards"},
            {id:"inventory-daily-view",label:"Daily table",href:href(1, "daily"),active:query.view === "daily"},
            {id:"inventory-history-view",label:"Movement history",href:"/dashboard/inventory?view=history",active:false},
          ]}/>
          <Button asChild variant="outline"><a id="inventory-consumption-export" href={href().replace("consumption?", "consumption/export?")}>Export CSV</a></Button>
        </div>
        {query.view === "cards" ? <InventoryConsumptionCards report={report} start={range.start} end={range.end}/> : <InventoryConsumptionMatrix report={report} start={range.start} end={range.end}/>}
      </>}

      {query.view !== "overview" ? <nav className="mt-4 flex items-center justify-between gap-3" aria-label="Inventory report pages">{query.page > 1 ? <Link id="inventory-report-previous" className="inline-flex min-h-11 items-center underline" href={href(query.page - 1)}>Previous</Link> : <span/>}<span className="text-sm">Page {query.page} of {Math.max(1, Math.ceil(report.count / 50))}</span>{query.page * 50 < report.count ? <Link id="inventory-report-next" className="inline-flex min-h-11 items-center underline" href={href(query.page + 1)}>Next</Link> : null}</nav> : null}
    </>}
  </main>;
}
