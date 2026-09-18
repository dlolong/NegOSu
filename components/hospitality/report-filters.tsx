import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterPopover } from "@/components/ui/filter-popover";
import { Input } from "@/components/ui/input";
import type { resolveReportScope } from "@/lib/reporting";
import { Field, fieldClass } from "./shared";

export function HospitalityReportFilters({ mode, section, scope, branchName, branches }: {
  mode: "report" | "payments" | "history";
  section: string;
  scope: ReturnType<typeof resolveReportScope>;
  branchName: string;
  branches: readonly { id: string; name: string }[];
}) {
  const payments = mode === "payments";
  const form = <form id="hospitality-report-filters" method="get" className={payments ? "grid gap-3 sm:grid-cols-2" : "grid items-end gap-3 border-t border-admin-border p-4 sm:grid-cols-2 lg:grid-cols-5"}>
    <input type="hidden" name="section" value={section}/>
    {mode === "history" ? <input type="hidden" name="tab" value="history"/> : null}
    <Field label="Period" full={payments}><select id="hospitality-report-period" name="preset" defaultValue={scope.filters.preset} className={fieldClass}>
      <option value="today">Today</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="month">This month</option><option value="custom">Custom dates</option>
    </select></Field>
    <Field label="Start (custom)"><Input id="hospitality-report-start" name="start" type="date" defaultValue={scope.range.start} className={fieldClass}/></Field>
    <Field label="End (custom)"><Input id="hospitality-report-end" name="end" type="date" defaultValue={scope.range.end} className={fieldClass}/></Field>
    {mode === "report" ? <Field label="Branch"><select id="hospitality-report-branch" name="branch" defaultValue={scope.branch} className={fieldClass}>
      <option value="all">All accessible branches</option>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
    </select></Field> : <p className={payments ? "text-sm text-admin-text-secondary sm:col-span-2" : "text-sm text-slate-500"}>{branchName}</p>}
    <Button id="hospitality-report-apply" type="submit" variant="secondary" className={payments ? "sm:col-span-2" : undefined}><Search size={16} aria-hidden="true"/>Apply</Button>
  </form>;

  return payments ? <FilterPopover key={`${section}-${scope.filters.preset}-${scope.range.start}-${scope.range.end}`} id="hospitality-payments-filters" title="Payment filters">{form}</FilterPopover> :
    <details id="hospitality-report-filter-panel" className="my-4 rounded-xl border border-admin-border bg-white shadow-sm"><summary className="min-h-11 cursor-pointer px-4 py-3 text-sm">Period &amp; branch filters</summary>{form}</details>;
}
