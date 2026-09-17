import { PlanUpgradeNotice } from "@/components/plan-upgrade";

import { Download as DownloadIcon, RefreshCw as RefreshCwIcon, Search as SearchIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { loadBusinessReport } from "@/modules/core/reporting/report-reader";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { getDashboardContext } from "@/lib/auth/context";
import { formatMoney } from "@/lib/operations";
import { reportAccessSchema, reportQuerySchema, resolveReportScope, type OwnerReport } from "@/lib/reporting";
import { roleHasPermission } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { reportActionError } from "@/lib/errors/action-error";

const inputClass = "min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm";
const reportSections = ["overview", "revenue", "team", "branches"] as const;
type ReportSection = (typeof reportSections)[number];

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [raw, { activeMembership }, supabase] = await Promise.all([
    searchParams,
    getDashboardContext(),
    createClient(),
  ]);

  if (activeMembership.industry === "hospitality") { const { HospitalityReport } = await import("@/components/hospitality/report"); return <HospitalityReport query={Object.fromEntries(Object.entries(raw).flatMap(([key, value]) => typeof value === "string" ? [[key, value]] : []))}/>; }
  if (!roleHasPermission(activeMembership.role, "reports.view")) {
    return <ReportState title="Reports are not available" description="You do not have reporting access." />;
  }

  const parsed = reportQuerySchema.safeParse(
    Object.fromEntries(Object.entries(raw).flatMap(([key, value]) => typeof value === "string" ? [[key, value]] : [])),
  );
  const { data: reportAccess, error: accessError } = await supabase.rpc("get_org_entitlements", {
    p_organization_id: activeMembership.organizationId,
  });
  const entitlement = reportAccessSchema.safeParse(reportAccess);
  if (accessError || !entitlement.success) {
    reportActionError("reports.entitlements", accessError ?? new Error("Invalid report entitlements"), "Could not check report access.");
    return <ReportState title="Could not check report access" description="Try loading this page again shortly." retry />;
  }
  const advanced = entitlement.data.features.advanced_reports;
  const { filters, branch, range } = resolveReportScope(parsed.success ? parsed.data : reportQuerySchema.parse({}), activeMembership, advanced);
  const requestedSection = typeof raw.section === "string" ? raw.section : "overview";
  const candidateSection: ReportSection = reportSections.includes(requestedSection as ReportSection)
    ? requestedSection as ReportSection : "overview";
  const section: ReportSection = !advanced || (candidateSection === "branches" && branch !== "all") ? "overview" : candidateSection;

  const currency = activeMembership.currency;
  const appointmentBased = activeMembership.industry !== "automotive";
  let report: OwnerReport;
  try {
    report = await loadBusinessReport(supabase, { organizationId: activeMembership.organizationId, branchId: branch === "all" ? null : branch, start: range.start, end: range.end, basis: appointmentBased ? "appointment" : "invoice", advanced });
  } catch (error) {
    reportActionError("reports.load", error, "Could not load reports.");
    return <ReportState title="Could not load reports" description="Try loading this page again. No business data was changed." retry />;
  }

  const repeatRate = report.summary.customersServed
    ? Math.round(report.summary.repeatCustomers * 100 / report.summary.customersServed)
    : 0;
  const queryFor = (nextSection: ReportSection) => new URLSearchParams({
    preset: filters.preset,
    start: range.start,
    end: range.end,
    branch,
    section: nextSection,
  }).toString();
  const exportQuery = new URLSearchParams({
    preset: filters.preset,
    start: range.start,
    end: range.end,
    branch,
  }).toString();

  const tabs = [
    { id: "reports-tab-overview", label: "Overview", href: `/dashboard/reports?${queryFor("overview")}`, active: section === "overview" },
    { id: "reports-tab-revenue", label: "Revenue", href: `/dashboard/reports?${queryFor("revenue")}`, active: section === "revenue" },
    { id: "reports-tab-team", label: "Team", href: `/dashboard/reports?${queryFor("team")}`, active: section === "team" },
    ...(branch === "all" ? [{ id: "reports-tab-branches", label: "Branches", href: `/dashboard/reports?${queryFor("branches")}`, active: section === "branches" }] : []),
  ];

  return (
    <main id="reports-page" className="mx-auto w-full max-w-7xl">
      <header id="reports-page-header" className="flex flex-wrap items-center justify-between gap-4 min-w-0 [&>a]:ml-auto [&>button]:ml-auto [&>form]:ml-auto">
        <div className="min-w-0 flex-1 basis-full sm:basis-64 [overflow-wrap:anywhere]">
          <p className="text-sm font-medium text-brand-primary">Owner analytics</p>
          <h1 className="mt-1 text-2xl font-medium sm:text-3xl">Reports</h1>
          <p className="mt-2 text-sm text-zinc-600 sm:text-base">Revenue, customers, workload, and branch trends from operational records.</p>
        </div>
        {advanced ? <Button id="reports-export-button" className="ml-auto" asChild variant="secondary">
          <Link href={`/dashboard/reports/export?${exportQuery}`}><DownloadIcon aria-hidden="true" size={16} className="shrink-0"/>Export CSV</Link>
        </Button> : null}
      </header>

      {!advanced ? <Card id="reports-free-plan-info" className="mt-5 flex min-w-0 flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0 flex-1 basis-64">
          <h2 className="text-sm font-medium">Free reports · Last 30 days</h2>
          <p className="mt-1 text-sm text-admin-text-secondary">Summary totals, daily activity, and customer insights for {activeMembership.branchName}.</p>
        </div>
        <PlanUpgradeNotice id="reports-plan-upgrade" capability="advanced_reports" compact/>
      </Card> : null}

      {advanced ? <form id="reports-filter-form" className="mt-5 grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:items-end">
        <input type="hidden" name="section" value={section} />
        <label className="grid gap-1 text-xs font-medium" htmlFor="reports-period-select">
          Period
          <select id="reports-period-select" className={inputClass} name="preset" defaultValue={filters.preset}>
            <option value="today">Today</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="month">This month</option><option value="custom">Custom</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium" htmlFor="reports-start-date-input">From<input id="reports-start-date-input" className={inputClass} type="date" name="start" defaultValue={range.start} /></label>
        <label className="grid gap-1 text-xs font-medium" htmlFor="reports-end-date-input">To<input id="reports-end-date-input" className={inputClass} type="date" name="end" defaultValue={range.end} /></label>
        <label className="grid gap-1 text-xs font-medium" htmlFor="reports-branch-select">
          Branch
          <select id="reports-branch-select" className={inputClass} name="branch" defaultValue={branch}>
            <option value="all">All accessible branches</option>
            {activeMembership.branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <Button id="reports-apply-filters-button" type="submit"><SearchIcon aria-hidden="true" size={16} className="shrink-0"/>Apply</Button>
      </form> : null}
      <p id="reports-range-description" className="mt-2 text-xs text-zinc-500">{range.start} to {range.end} · local calendar dates per branch timezone{appointmentBased ? " · Sales: completed appointments by scheduled date. Receipts: payment date. Outstanding: current balances for appointments in this period." : ""}</p>

      <section id="reports-summary" aria-label="Report summary" className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Gross sales" value={formatMoney(report.summary.grossSalesCentavos, currency)} />
        <StatCard label="Payments received" value={formatMoney(report.summary.paymentsReceivedCentavos, currency)} />
        <StatCard label="Outstanding" value={formatMoney(report.summary.outstandingCentavos, currency)} />
        <StatCard label={appointmentBased ? "Completed appointments" : "Completed jobs"} value={String(report.summary.jobsCompleted)} />
        <StatCard label="Average ticket" value={formatMoney(report.summary.averageTicketCentavos, currency)} />
      </section>

      {advanced ? <Tabs id="reports-section-tabs" ariaLabel="Report sections" className="mt-5" items={tabs} /> : null}

      {section === "overview" ? (
        <section id="reports-overview-section" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card id="reports-daily-totals" className="overflow-hidden p-0">
            <div className="border-b border-zinc-100 p-4"><h2 className="font-medium">Daily totals</h2></div>
            {report.daily.length ? <>
              <table id="reports-daily-table" className="hidden w-full text-left text-sm sm:table">
                <thead className="bg-zinc-50 text-zinc-500"><tr><th className="px-4 py-2 font-medium">Date</th><th className="px-4 py-2 font-medium">Gross sales</th><th className="px-4 py-2 font-medium">Received</th><th className="px-4 py-2 font-medium">{appointmentBased ? "Appointments" : "Jobs"}</th></tr></thead>
                <tbody>{report.daily.map((row) => <tr className="border-t border-admin-border" key={row.day}><td className="px-4 py-2.5">{row.day}</td><td className="px-4 py-2.5">{formatMoney(row.grossSalesCentavos, currency)}</td><td className="px-4 py-2.5">{formatMoney(row.paymentsReceivedCentavos, currency)}</td><td className="px-4 py-2.5">{row.jobsCompleted}</td></tr>)}</tbody>
              </table>
              <div id="reports-daily-mobile-list" className="divide-y divide-admin-border sm:hidden">{report.daily.map((row) => <article className="p-4" key={row.day}><div className="flex justify-between gap-3"><span>{row.day}</span><span>{row.jobsCompleted} {appointmentBased ? "appointments" : "jobs"}</span></div><p className="mt-1 text-sm text-zinc-600">{formatMoney(row.grossSalesCentavos, currency)} gross · {formatMoney(row.paymentsReceivedCentavos, currency)} received</p></article>)}</div>
            </> : <p className="p-5 text-sm text-zinc-500">No activity in this period.</p>}
          </Card>
          <Card id="reports-customer-summary" className="p-4">
            <h2 className="font-medium">Customers</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <StatCard label="Served" value={String(report.summary.customersServed)} />
              <StatCard label="Repeat rate" value={`${repeatRate}%`} note={`${report.summary.repeatCustomers} repeat customers`} />
              <StatCard label="New" value={String(report.summary.newCustomers)} />
              <StatCard label="Returning" value={String(Math.max(0, report.summary.customersServed - report.summary.newCustomers))} />
            </div>
          </Card>
        </section>
      ) : null}

      {section === "revenue" ? <section id="reports-revenue-section" className="mt-4 grid gap-4 lg:grid-cols-2"><ReportList id="reports-service-revenue" title="Service revenue" rows={report.services.map((row) => [row.service, `${formatMoney(row.revenueCentavos, currency)} · ${row.quantity}`])} /><ReportList id="reports-category-revenue" title="Category revenue" rows={report.categories.map((row) => [row.category, formatMoney(row.revenueCentavos, currency)])} /></section> : null}
      {section === "team" ? <section id="reports-team-section" className="mt-4"><ReportList id="reports-technician-workload" title={appointmentBased ? "Staff workload" : "Technician workload"} rows={report.technicians.map((row) => [row.name, `${row.completedJobs}/${row.assignedJobs} completed`])} /></section> : null}
      {section === "branches" && branch === "all" ? <BranchComparison currency={currency} rows={report.branches} appointmentBased={appointmentBased} /> : null}
    </main>
  );
}

function ReportState({ title, description, retry, children }: { title: string; description: string; retry?: boolean; children?: ReactNode }) {
  return <main id="reports-page" className="mx-auto w-full max-w-5xl"><header id="reports-page-header"><h1 className="text-2xl font-medium sm:text-3xl">Reports</h1></header><Card id="reports-state" className="mt-5 p-6 text-center"><h2 className="font-medium">{title}</h2><p className="mt-2 text-sm text-zinc-600">{description}</p>{retry ? <Button id="reports-retry-button" asChild className="mt-4" variant="secondary"><Link href="/dashboard/reports"><RefreshCwIcon aria-hidden="true" size={16} className="shrink-0"/>Try again</Link></Button> : null}{children}</Card></main>;
}

function ReportList({ id, title, rows }: { id: string; title: string; rows: Array<[string, string]> }) {
  return <Card id={id} className="p-4"><h2 className="font-medium">{title}</h2><div className="mt-3 divide-y">{rows.map(([label, value], index) => <div className="flex justify-between gap-3 py-2.5 text-sm" key={`${label}-${index}`}><span>{label}</span><span className="text-right font-medium">{value}</span></div>)}{!rows.length ? <p className="py-4 text-sm text-zinc-500">No data in this period.</p> : null}</div></Card>;
}

function BranchComparison({ rows, appointmentBased, currency }: { currency: string; rows: OwnerReport["branches"]; appointmentBased: boolean }) {
  return <Card id="reports-branch-comparison" className="mt-4 p-4"><h2 className="font-medium">Branch comparison</h2><div className="mt-3 grid gap-3 sm:grid-cols-2">{rows.map((row) => <article id={`reports-branch-${row.id}`} className="flex justify-between gap-3 rounded-xl border p-3" key={row.id}><span>{row.name}</span><span className="text-right"><span className="block font-medium">{formatMoney(row.grossSalesCentavos, currency)}</span><small className="text-zinc-500">{row.invoices} {appointmentBased ? "appointments" : "invoices"}</small></span></article>)}{!rows.length ? <p className="text-sm text-zinc-500">No branch activity in this period.</p> : null}</div></Card>;
}
