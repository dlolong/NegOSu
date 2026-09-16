import Link from "next/link";
import { Download, Search, BedDouble } from "lucide-react";
import { reportAccessSchema, reportQuerySchema, resolveReportRange, resolveReportScope } from "@/lib/reporting";
import { roleHasPermission } from "@/lib/rbac";
import { formatMoney } from "@/lib/operations";
import { hospitalityContext, loadHospitalityWorkspace } from "@/modules/hospitality/runtime";
import { canHospitality, type HospitalityWorkspace, type WorkspaceRow } from "@/modules/hospitality/contracts";
import { PageHeader } from "@/components/page-patterns";
import { Button } from "@/components/ui/button";
import { ListTabs } from "@/components/list-tabs";
import { RecordTable } from "@/components/record-table";
import { RecordLink } from "@/components/record-item";
import { Field, fieldClass, pageNumber, PageLinks, dateLabel, LoadError } from "./shared";
export type HospitalityReportQuery = Record<string, string | undefined>;
const sections = [{ value: "stays", label: "Stays" }, { value: "rooms", label: "Room status" }, { value: "collections", label: "Collections" }, { value: "outstanding", label: "Outstanding" }, { value: "inventory", label: "Stock" }, { value: "movements", label: "Stock movements" }];
export async function HospitalityReport({ query: q, mode = "report" }: { query: HospitalityReportQuery; mode?: "report" | "payments" | "history" }) {
  const { db, activeMembership: m } = await hospitalityContext();
  const finance = canHospitality(m.role, "financeRead"), inventory = roleHasPermission(m.role, "inventory.manage");
  if ((mode === "report" && !roleHasPermission(m.role, "reports.view")) || (mode === "payments" && !finance)) return <LoadError>You do not have access to this page.</LoadError>;
  const access = mode === "report" ? await db.rpc("get_org_entitlements", { p_organization_id: m.organizationId }) : { data: { features: { advanced_reports: true } }, error: null };
  const entitlement = reportAccessSchema.safeParse(access.data);
  if (access.error || !entitlement.success) return <LoadError>Could not check report access. Refresh to try again.</LoadError>;
  const advanced = entitlement.data.features.advanced_reports, parsed = reportQuerySchema.safeParse(q);
  const filters = parsed.success ? parsed.data : reportQuerySchema.parse({ branch: m.branchId });
  const scope = mode === "report" ? resolveReportScope(filters, m, advanced) : { filters, branch: m.branchId, range: resolveReportRange(filters, m.timezone) };
  const options = mode === "payments" ? [sections[3], sections[2], sections[0]] : mode === "history" ? [sections[0]] : sections.filter(s => (!['collections', 'outstanding'].includes(s.value) || finance) && (!['inventory', 'movements'].includes(s.value) || inventory));
  const section = options.some(s => s.value === q.section) ? q.section! : options[0].value, page = pageNumber(q.page);
  let report: HospitalityWorkspace;
  try { report = await loadHospitalityWorkspace({ branch: scope.branch === "all" ? null : scope.branch, start: scope.range.start, end: scope.range.end, section, page, mode }); } catch { return <LoadError>Could not load these records. Check the selected dates and branch, then try again.</LoadError>; }
  const base = mode === "report" ? "/dashboard/reports" : mode === "payments" ? "/dashboard/payments" : "/dashboard/hospitality/rooms";
  const query = { preset: scope.filters.preset, start: scope.range.start, end: scope.range.end, branch: scope.branch, section, ...(mode === "history" ? { tab: "history" } : {}) };
  const qs = new URLSearchParams(query);
  const metrics: Array<{ label: string; value: number | string }> = section === "stays" ? [
    { label: "Check-ins in period", value: report.checkIns }, { label: "Checkouts in period", value: report.checkOuts }, { label: "In-house stays now", value: report.inHouse },
  ] : section === "rooms" ? [
    { label: "Occupied now", value: report.occupied }, { label: "Available now", value: report.vacant }, { label: "Cleaning now", value: report.cleaning }, { label: "Inactive rooms now", value: report.inactive },
  ] : section === "collections" && report.finance ? [
    { label: "Collected in period", value: formatMoney(report.finance.collected, m.currency) }, { label: "Ledger entries in period", value: report.rowCount },
  ] : section === "outstanding" && report.finance ? [
    { label: "Outstanding now", value: formatMoney(report.finance.outstanding, m.currency) }, { label: "Checked-out stays with debt", value: report.finance.checkedOutDebt },
  ] : section === "inventory" ? [
    { label: "Products now", value: report.stockItems ?? 0 }, { label: "Low-stock products now", value: report.lowStock ?? 0 },
  ] : [{ label: "Movements in period", value: report.rowCount }];
  return <main id={mode === "report" ? "hospitality-reports-page" : mode === "payments" ? "hospitality-payments-page" : "hospitality-stay-history-page"} className="mx-auto min-w-0 max-w-7xl">
    <PageHeader id={`hospitality-${mode}-header`} title={mode === "report" ? "Reports" : mode === "payments" ? "Payments" : "Stay history"} description={mode === "payments" ? "Guest collections and balances. NegOSu subscription payments are under Settings → Billing & Plan." : "Activity uses each branch’s local dates. Room status, in-house stays, balances and stock are current snapshots."} action={mode === "report" && advanced ? <Button asChild variant="secondary"><Link id="hospitality-report-export" href={`/dashboard/reports/export?${qs}`}><Download size={16}/>Export CSV</Link></Button> : mode === "history" ? <Button asChild variant="secondary"><Link href="/dashboard/hospitality/rooms"><BedDouble size={16}/>Rooms</Link></Button> : undefined}/>
    {mode === "report" && !advanced ? <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">Free plan: current branch and the last 30 days. Paid plans include custom periods, accessible branches and CSV export.</p> : null}
    {advanced ? <details id="hospitality-report-filter-panel" className="my-4 rounded-xl border border-admin-border bg-white shadow-sm"><summary className="min-h-11 cursor-pointer px-4 py-3 text-sm">Period & branch filters</summary><form id="hospitality-report-filters" className="grid items-end gap-3 border-t border-admin-border p-4 sm:grid-cols-2 lg:grid-cols-5"><input type="hidden" name="section" value={section}/>{mode === "history" ? <input type="hidden" name="tab" value="history"/> : null}<Field label="Period"><select id="hospitality-report-period" name="preset" defaultValue={scope.filters.preset} className={fieldClass}><option value="today">Today</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="month">This month</option><option value="custom">Custom dates</option></select></Field><Field label="Start (custom)"><input id="hospitality-report-start" name="start" type="date" defaultValue={scope.range.start} className={fieldClass}/></Field><Field label="End (custom)"><input id="hospitality-report-end" name="end" type="date" defaultValue={scope.range.end} className={fieldClass}/></Field>{mode === "report" ? <Field label="Branch"><select id="hospitality-report-branch" name="branch" defaultValue={scope.branch} className={fieldClass}><option value="all">All accessible branches</option>{m.branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field> : <p className="text-sm text-slate-500">{m.branchName}</p>}<Button id="hospitality-report-apply" type="submit" variant="secondary"><Search size={16}/>Apply</Button></form></details> : null}
    <p className="mt-4 text-xs text-slate-500">Activity period: {scope.range.start} to {scope.range.end}</p>
    <div id="hospitality-report-summary" className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">{metrics.map(metric => <Metric key={metric.label} {...metric}/>)}</div>
    <ListTabs id="hospitality-report-tabs" baseHref={base} parameter="section" query={query} value={section} options={options}/>
    <p className="my-3 text-xs text-slate-500">{section === "outstanding" ? "All current outstanding balances, including checked-out stays. Independent of the activity period." : section === "collections" ? "Payments received in the period. Voided and refunded entries are shown for history and excluded from collected totals. This is not profit." : section === "rooms" || section === "inventory" ? "Current snapshot, independent of the activity period." : section === "stays" ? "Current in-house stays plus check-ins or checkouts during the period." : "Stock movements during the selected period."} Totals cover the full authorized scope.</p>
    {section === "collections" && report.finance ? <div className="mb-3 flex flex-wrap gap-2 text-xs">{report.finance.methods.map(method => <span key={method.method} className="rounded-lg border bg-white px-3 py-2 capitalize">{method.method.replaceAll("_", " ")}: {formatMoney(method.amount, m.currency)}</span>)}</div> : null}
    <ReportRows rows={report.rows} section={section} timezone={m.timezone} currency={m.currency}/><PageLinks page={page} count={report.rowCount} href={p => `${base}?${qs}&page=${p}`}/>
  </main>;
}
function Metric({ label, value }: { label: string; value: number | string }) { return <div className="min-w-0 rounded-xl border border-admin-border bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-xl [overflow-wrap:anywhere]">{value}</p></div>; }
function ReportRows({ rows, section, timezone, currency }: { rows: WorkspaceRow[]; section: string; timezone: string; currency: string }) {
  const fields: Record<string, [string, string][]> = { stays: [["room", "Room"], ["guest", "Guest"], ["checked_in_at", "Checked in"], ["checked_out_at", "Checked out"]], outstanding: [["guest", "Guest / room"], ["charges", "Charges"], ["paid", "Paid"], ["balance", "Balance"]], collections: [["guest", "Guest / room"], ["paid_at", "Received"], ["method", "Method / status"], ["amount", "Amount"]], rooms: [["room", "Room"], ["guest", "Current guest"], ["capacity", "Capacity"], ["status", "Status"]], inventory: [["name", "Product"], ["unit", "Unit"], ["reorder_level", "Low-stock threshold"], ["quantity_on_hand", "On hand"]], movements: [["name", "Product"], ["created_at", "Date"], ["movement_type", "Movement"], ["quantity_delta", "Quantity"]] };
  const columns = fields[section] ?? fields.stays;
  const display = (row: WorkspaceRow, key: string) => ['charges', 'paid', 'balance', 'amount'].includes(key) ? formatMoney(Number(row[key] ?? 0), currency) : key.endsWith('_at') ? dateLabel(row[key] as string | null, String(row.timezone ?? timezone)) : String(row[key] ?? "—").replaceAll("_", " ");
  return <RecordTable id="hospitality-report-table" caption={section} columns={columns.map(([key, label], index) => ({ key, label, secondary: index > 0 && index < columns.length - 1, ...(index === columns.length - 1 ? { align: "right" as const } : {}) }))} rows={rows.map((row, index) => {
    const href = section === "inventory" ? `/dashboard/inventory?dialog=details&itemId=${row.id}` : section === "rooms" ? row.stay_id ? `/dashboard/hospitality/stays/${row.stay_id}` : `/dashboard/hospitality/rooms?dialog=details&room=${row.id}` : section === "movements" ? "/dashboard/inventory?view=history" : `/dashboard/hospitality/stays/${row.id}`;
    return { id: `hospitality-report-row-${row.payment_id ?? row.id ?? index}`, cells: Object.fromEntries(columns.map(([key], i) => [key, i === 0 ? <><RecordLink href={href}>{display(row, key)}</RecordLink>{row.branch ? <p className="mt-1 text-xs text-slate-500">{String(row.branch)}</p> : null}{section === "collections" || section === "outstanding" ? <p className="mt-1 text-xs text-slate-500">{String(row.room)}{row.checked_out_at ? " · Checked out" : ""}</p> : null}</> : key === "method" ? `${display(row, key)} · ${row.status}` : display(row, key)])), mobile: <>{columns.slice(1, -1).map(([key, label]) => <p key={key}>{label}: {display(row, key)}{key === "method" ? ` · ${row.status}` : ""}</p>)}</> };
  })}/>;
}
