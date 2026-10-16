"use client";
import { reportCategories, catalogReportTable, catalogReportNote, type CatalogReport, type ReportCategory } from "@/modules/core/reporting/catalog-report";
import { hospitalityReportTable } from "@/modules/core/reporting/hospitality-table";
import type { HospitalityWorkspace } from "@/modules/hospitality/contracts";
import { formatMoney } from "@/lib/operations";
import { ViewTabs } from "@/components/ui/tabs";
import { Search, X } from "lucide-react";
import { RecordTableSearchContext } from "@/components/record-table-search-context";
import { bookingReportTable } from "@/modules/core/reporting/booking-tables";
import type { OwnerReport } from "@/lib/reporting";
import { PaymentTotals } from "./payment-totals";
import { FilterPopover } from "@/components/ui/filter-popover";
import { PlanUpgradeNotice } from "@/components/plan-upgrade";
import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RecordTable } from "@/components/record-table";
import { ClientPurchases } from "@/components/reports/client-purchases";
import type { ClientPurchaseReport } from "@/modules/core/reporting/client-purchase-report";
import { creditReportPayloadSchema, creditReportSections, type CreditReportPayload, type CreditSnapshot } from "@/modules/platform/trial-credits";

const field = "block min-h-11 w-full min-w-0 rounded-xl border border-admin-border bg-white px-3 text-sm";
type Category = ReportCategory;
type Props = { categoryTables?: Partial<Record<Category, ReactNode>>; defaultBranch?: string; organizationId: string; actorId: string; paid: boolean; industry: string; currency: string; branches: readonly { id: string; name: string }[]; range: { start: string; end: string } };
export function CreditReports(props: Props) {
  const [view, setView] = useState<"weekly" | "custom">("weekly");
  const [category, setCategory] = useState<Category>("bookings");
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  function closeSearch() { setSearch(""); setSearchOpen(false); document.getElementById("reports-search-button")?.focus(); }
  const formRef = useRef<HTMLFormElement>(null);
  const [dates, setDates] = useState(props.range);
  function categoryKind(next:Category):CreditReportPayload["kind"] {
    if(next === "promos" || next === "rooms") return "catalog";
    return ["bookings","payments"].includes(next) ? props.industry === "hospitality"?"hospitality":"overview" : "clients";
  }
  function selectCategory(next: Category) {setCategory(next);setView("weekly");setSearch("");setKind(categoryKind(next));}
  function resetFilters() {formRef.current?.reset();setKind(categoryKind(category));setDates(props.range);setError("");}
  function setPeriod(period: "week" | "month" | "previous") {
    const end = props.range.end;
    if (period === "week") { setDates(props.range); return; }
    if (period === "month") { setDates({ start: `${end.slice(0, 7)}-01`, end }); return; }
    const last = new Date(`${end.slice(0, 7)}-01T12:00:00Z`); last.setUTCDate(0);
    const lastDay = last.toISOString().slice(0, 10);
    setDates({ start: `${lastDay.slice(0, 7)}-01`, end: lastDay });
  }
  const reportLabel = (value: string) => value === "catalog" ? category === "rooms" ? "Rooms" : "Promos" : value === "clients" ? "Client purchases & staff" : value === "hospitality" ? "Apartelle operations" : "Business overview";
  const [kind, setKind] = useState<CreditReportPayload["kind"]>(props.industry === "hospitality" ? "hospitality" : "overview");
  const [snapshot, setSnapshot] = useState<CreditSnapshot | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [page, setPage] = useState(1), [section, setSection] = useState(0);
  const [exhausted, setExhausted] = useState(false);
  const lock = useRef(false);
  const requestRef = useRef<{ requestId: string; payload: CreditReportPayload } | null>(null);
  const storageKey = `negosu-credit-report:${props.organizationId}:${props.actorId}`;
  function received(data: CreditSnapshot) {
    setSearch("");
    document.getElementById("reports-filters-popover")?.hidePopover();
    setCategory(data.payload.kind === "catalog" ? data.payload.section === "rooms" ? "rooms" : "promos" : category);
    setSnapshot(data); setView("custom"); setPage(1); setSection(data.payload.kind === "hospitality" ? 1 : data.payload.kind === "overview" ? 1 : 0);

    requestAnimationFrame(() => {
      const result = document.getElementById("reports-main-content");
      if (result) { result.scrollTop = 0; if (window.matchMedia("(max-width: 1023px)").matches) result.scrollIntoView({ behavior: "smooth", block: "start" }); result.focus({ preventScroll: true }); }
    });
  }
  async function generate(form: HTMLFormElement, action: CreditReportPayload["action"]) {
    if (lock.current) return;
    const values = Object.fromEntries(new FormData(form));
    const parsed = creditReportPayloadSchema.safeParse({ ...values, kind, action, maxCost: props.paid ? 0 : 1, branch: values.branch === "all" ? null : values.branch });
    if (!parsed.success) { setError("Choose valid dates in order, covering up to 732 days, and search text up to 120 characters."); return; }
    lock.current = true; setBusy(true); setError("");
    try {
      let previous = requestRef.current;
      try { previous ??= JSON.parse(sessionStorage.getItem(storageKey) ?? "null"); } catch { /* Session storage may be disabled. In-memory retry still works. */ }
      const request = previous && JSON.stringify(previous.payload) === JSON.stringify(parsed.data) ? previous : { requestId: crypto.randomUUID(), payload: parsed.data };
      requestRef.current = request;
      try { sessionStorage.setItem(storageKey, JSON.stringify(request)); } catch { /* Optional reload recovery. */ }
      const response = await fetch("/api/dashboard/credit-reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) });
      const result = await response.json();
      window.dispatchEvent(new Event("negosu-usage-changed"));
      if (!response.ok) { setExhausted(result.code === "INSUFFICIENT_CREDITS"); setError(result.code === "INSUFFICIENT_CREDITS" ? "This report could not be prepared. Check notifications for details. Your last seven days remain available." : result.error ?? "Unable to generate this report."); return; }
      setExhausted(false);
      received(result); requestRef.current = null;
      try { sessionStorage.removeItem(storageKey); } catch { /* Optional reload recovery. */ }
    } catch { setError("Could not confirm the result. Retry with the same filters; the same request will not spend twice."); }
    finally { lock.current = false; setBusy(false); }
  }
  const tables = snapshot && snapshot.payload.kind !== "clients" ? creditReportSections(snapshot) : [];
  const bookingTable = snapshot?.payload.kind === "overview" && (["salon","pet_care","automotive"].includes(props.industry) && (category === "bookings" || category === "payments")) && ((snapshot.report as OwnerReport).bookingDetails ?? (snapshot.report as OwnerReport).salonDetails) ? bookingReportTable(snapshot.report as OwnerReport,category,props.currency,props.industry) : null;
  const extraTable=snapshot?.payload.kind === "catalog" ? catalogReportTable(snapshot.report as CatalogReport,props.currency) : snapshot?.payload.kind === "hospitality" ? hospitalityReportTable(snapshot.report as HospitalityWorkspace,snapshot.payload.section,props.currency) : null;
  const detailTable=bookingTable??extraTable;
  const totals=snapshot ? snapshot.payload.kind === "catalog" ? {sales:(snapshot.report as CatalogReport).summary.amount,revenue:(snapshot.report as CatalogReport).summary.revenue,note:catalogReportNote(category)}
    : snapshot.payload.kind === "clients" ? {sales:(snapshot.report as ClientPurchaseReport).summary.total,revenue:(snapshot.report as ClientPurchaseReport).summary.paid,note:"Whole matching appointments/bills across all clients. Revenue is paid to date on those records."}
    : snapshot.payload.kind === "overview" ? {sales:(snapshot.report as OwnerReport).summary.grossSalesCentavos,revenue:(snapshot.report as OwnerReport).summary.paymentsReceivedCentavos}
    : (snapshot.report as HospitalityWorkspace).reportTotals ? {sales:(snapshot.report as HospitalityWorkspace).reportTotals!.amount,revenue:(snapshot.report as HospitalityWorkspace).reportTotals!.revenue,note:"Amount: bills issued in this period. Revenue: paid receipts in this period."} : null : null;
  const table = tables[section];
  const maxPages = Math.max(1, Math.ceil((detailTable?.rows.length ?? table?.rows.length ?? 0) / 50));
  return <RecordTableSearchContext.Provider value={search}><div id="credit-reports" className="mt-5 min-w-0">
    {exhausted ? <PlanUpgradeNotice id="report-credit-exhausted" capability="advanced_reports"/> : null}
    <div>
      <ViewTabs id="reports-view-tabs" ariaLabel="Report categories" value={category} onChange={selectCategory} items={reportCategories(props.industry).map(value=>({id:`reports-category-${value}`,value,label:value.charAt(0).toUpperCase()+value.slice(1)}))}/>
      <div id="reports-toolbar" className="my-3 flex max-w-full min-w-0 flex-wrap items-center justify-end gap-2">
        {searchOpen ? <div className="flex min-w-0 items-center gap-1">
          <Input id="reports-search-input" type="search" autoFocus aria-label="Search loaded report records" placeholder="Search loaded records…" value={search} className="w-44 min-w-0 sm:w-60" onChange={event=>setSearch(event.target.value)} onKeyDown={event=>{if(event.key === "Escape") {event.preventDefault();closeSearch();}}}/>
          <Button id="reports-search-close" size="icon" variant="ghost" aria-label="Clear and close search" onClick={closeSearch}><X size={16} aria-hidden="true"/></Button>
        </div> : null}
        <Button id="reports-search-button" size="icon" variant="secondary" aria-label="Search reports" title="Search loaded records" aria-expanded={searchOpen} aria-controls={searchOpen ? "reports-search-input" : undefined} className={searchOpen ? "sr-only" : undefined} onClick={()=>setSearchOpen(true)}><Search size={16} aria-hidden="true"/></Button>
      <FilterPopover id="reports-filters" title="Report filters" iconOnly>
    <form ref={formRef} id="credit-report-form" onSubmit={event => { event.preventDefault(); void generate(event.currentTarget, "advanced_report"); }} className="space-y-3">
      <fieldset disabled={busy} className="grid min-w-0 gap-3">
        <div id="reports-filter-actions" className="grid grid-cols-2 gap-2 border-b border-admin-border bg-admin-surface py-3"><Button id="credit-report-generate" type="submit" title={props.paid ? "Included with your plan" : "Apply custom filters · 1 credit"}>{busy ? "Preparing…" : "Apply filters"}</Button><Button id="credit-report-export" title={props.paid ? "Included with your plan" : "Prepare CSV · 1 credit"} type="button" variant="secondary" onClick={event => { const form = event.currentTarget.form; if (form?.reportValidity()) void generate(form, "csv_export"); }}>Prepare CSV</Button></div>
        <div className="flex flex-wrap items-center gap-1" aria-label="Date shortcuts"><Button id="reports-period-week" type="button" size="sm" variant="ghost" onClick={() => setPeriod("week")}>Last 7 days</Button><Button id="reports-period-month" type="button" size="sm" variant="ghost" onClick={() => setPeriod("month")}>This month</Button><Button id="reports-period-previous" type="button" size="sm" variant="ghost" onClick={() => setPeriod("previous")}>Last month</Button></div>

        <label className="text-sm">Start date<Input id="credit-report-start" name="start" type="date" required value={dates.start} onChange={event => setDates(current => ({ ...current, start: event.target.value }))}/></label>
        <label className="text-sm">End date<Input id="credit-report-end" name="end" type="date" required value={dates.end} onChange={event => setDates(current => ({ ...current, end: event.target.value }))}/></label>
        <label className="text-sm">Branch<select id="credit-report-branch" name="branch" defaultValue={props.defaultBranch ?? "all"} className={field}><option value="all">All accessible branches</option>{props.branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
        <input type="hidden" name="purchaseKind" value={category === "products" ? "product" : category === "services" ? "service" : "all"}/>
        <input type="hidden" name="section" value={category === "promos" ? "promos" : category === "rooms" ? "rooms" : category === "payments" ? "collections" : "stays"}/>
        <Button id="reports-reset-filters" type="button" variant="ghost" onClick={resetFilters}>Reset filters</Button>
      </fieldset>
    </form>

      </FilterPopover>
      </div>
    </div>
    <div id="reports-workspace" className="min-w-0">
      <section id="reports-main-content" aria-label="Report results" tabIndex={0} className="min-w-0 space-y-4">
        {busy ? <p role="status">Preparing your report…</p> : null}
        {error ? <p id="credit-report-error" role="alert" className="text-sm text-red-700">{error}</p> : null}
        {view === "weekly" ? props.categoryTables?.[category] ?? <p role="alert">This table could not be loaded. Refresh to try again.</p> : <>
    {snapshot ? <section id="credit-report-result" className="min-w-0 space-y-4">
      <div><h2 className="text-lg font-medium">{reportLabel(snapshot.payload.kind)}</h2><p className="mt-1 text-sm text-admin-text-secondary">{snapshot.payload.start} – {snapshot.payload.end} · {props.branches.find(branch => branch.id === snapshot.payload.branch)?.name ?? "All accessible branches"}</p><p className="mt-1 text-xs text-admin-text-muted">Saved {new Date(snapshot.createdAt).toLocaleString()}. Apply filters to update these results.</p></div>
      {snapshot.payload.action === "csv_export" ? <Button asChild variant="secondary"><a id="credit-report-download" href={`/api/dashboard/credit-reports?id=${snapshot.id}&download=1`}>Download CSV</a></Button> : null}
      {totals ? <PaymentTotals {...totals} currency={props.currency}/> : null}
      {detailTable ? <>
        <RecordTable reportSearch id="credit-report-table" caption={category.charAt(0).toUpperCase()+category.slice(1)} columns={detailTable.columns} rows={detailTable.rows.slice((page-1)*50,page*50)}/>
        {props.industry === "automotive" && category === "bookings" ? <p className="text-xs text-admin-text-secondary">Total billed includes posted job and product invoices. Bookings without posted invoices show zero.</p> : null}
        <nav aria-label="Report pages" className="flex items-center justify-between gap-2"><Button id="credit-report-previous" variant="secondary" disabled={page===1} onClick={()=>setPage(page-1)}>Previous</Button><span>Page {page} of {maxPages}</span><Button id="credit-report-next" variant="secondary" disabled={page===maxPages} onClick={()=>setPage(page+1)}>Next</Button></nav>
      </> : snapshot.payload.kind === "clients" ? <ClientPurchases toolbarSearch filters={{ preset: "custom", start: snapshot.payload.start, end: snapshot.payload.end, branch: snapshot.payload.branch ?? "all", q: snapshot.payload.client, item: snapshot.payload.item, kind: snapshot.payload.purchaseKind, page }} range={snapshot.payload} branches={props.branches} currency={props.currency} report={{ ...(snapshot.report as ClientPurchaseReport), rows: (snapshot.report as ClientPurchaseReport).rows.slice((page - 1) * 50, page * 50) }} onPageChange={setPage}/> : table ? <>
        <label className="block text-sm">Report details<select id="credit-report-table-section" className={field} value={section} onChange={event => { setSection(Number(event.target.value)); setPage(1); }}>{tables.map((item, index) => <option key={item.title} value={index}>{item.title}</option>)}</select></label>
        <RecordTable reportSearch id="credit-report-table" caption={table.title} columns={table.columns.map((label, index) => ({ key: String(index), label:label.replace(" centavos", "") }))} rows={table.rows.slice((page - 1) * 50, page * 50).map((row, index) => ({ id: `credit-report-row-${index}`, cells: Object.fromEntries(row.map((cell, column) => [String(column), table.columns[column]?.includes("centavos") ? formatMoney(Number(cell),props.currency) : cell])) }))}/>
        <nav aria-label="Saved report pages" className="flex items-center justify-between gap-2"><Button id="credit-report-previous" variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button><span className="text-sm">Page {page} of {maxPages}</span><Button id="credit-report-next" variant="secondary" disabled={page === maxPages} onClick={() => setPage(page + 1)}>Next</Button></nav>
      </> : null}
    </section> : null}
        </>}
      </section>
    </div>
  </div></RecordTableSearchContext.Provider>;
}
