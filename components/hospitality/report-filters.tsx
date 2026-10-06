import { ClearFilterButton } from "@/components/clear-filter-button";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterPopover } from "@/components/ui/filter-popover";
import { Input } from "@/components/ui/input";
import type { resolveReportScope } from "@/lib/reporting";
import { Field, fieldClass } from "./shared";

export function HospitalityReportFilters({ advanced, mode, section, scope, branchName, branches }: {
  advanced: boolean;
  mode: "report" | "payments" | "history";
  section: string;
  scope: ReturnType<typeof resolveReportScope>;
  branchName: string;
  branches: readonly { id: string; name: string }[];
}) {
  const payments = mode === "payments";
  const form = <form id="hospitality-report-filters" method="get" className="grid min-w-0 gap-3 sm:grid-cols-2">
    <input type="hidden" name="section" value={section}/>
    {mode === "history" ? <input type="hidden" name="tab" value="history"/> : null}
    <Field label="Period" full={payments}><select id="hospitality-report-period" name="preset" defaultValue={scope.filters.preset} className={fieldClass}>
      <option value="today">Today</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option>{advanced ? <option value="custom">Custom dates</option> : <option value="custom" disabled>Custom dates · Paid plan</option>}
    </select></Field>
    {advanced ? <><Field label="Start (custom)"><Input id="hospitality-report-start" name="start" type="date" defaultValue={scope.range.start} className={fieldClass}/></Field>
    <Field label="End (custom)"><Input id="hospitality-report-end" name="end" type="date" defaultValue={scope.range.end} className={fieldClass}/></Field></> : null}
    {mode === "report" && advanced ? <Field label="Branch"><select id="hospitality-report-branch" name="branch" defaultValue={scope.branch} className={fieldClass}>
      <option value="all">All accessible branches</option>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
    </select></Field> : <p className={payments ? "text-sm text-admin-text-secondary sm:col-span-2" : "text-sm text-slate-500"}>{branchName}</p>}
    <Button id="hospitality-report-apply" type="submit" variant="secondary" className="sm:col-span-2"><Search size={16} aria-hidden="true"/>Apply</Button>
  </form>;

  return <div className="my-3 flex justify-end gap-2"><FilterPopover iconOnly key={`${section}-${scope.filters.preset}-${scope.range.start}-${scope.range.end}`} id={payments ? "hospitality-payments-filters" : "hospitality-report-filter-panel"} title={payments ? "Payment filters" : "Period & branch filters"}>{form}</FilterPopover><ClearFilterButton id="hospitality-report-clear-filters" formId="hospitality-report-filters"/></div>;
}
