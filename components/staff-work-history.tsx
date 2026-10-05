import Link from "next/link";
import { RecordTable } from "@/components/record-table";
import { ListingFilters } from "@/components/listing-filters";
import { HistoryNavigation } from "@/components/client-reminder-rows";
import { STAFF_HISTORY_SIZE, staffWorkHref, workSourceLabels, type StaffWork } from "@/modules/core/staff/work-history";

export function StaffWorkHistory({ staffId, branchName, industry, timezone, query, page, rows, error }: {
  staffId: string; branchName: string; industry: string; timezone: string;
  query: { q?: string; from?: string; to?: string }; page: number; rows: StaffWork[]; error: boolean;
}) {
  const path = `/dashboard/settings/staff/${staffId}`;
  const date = (value: string) => new Intl.DateTimeFormat("en-PH", { timeZone: timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  return <section id="staff-work-history" className="mt-6 min-w-0">
    <h2 className="text-lg font-medium">Completed work</h2>
    <p className="mt-2 text-sm text-admin-text-secondary">Completed visits and jobs, and recorded stay duties at {branchName}. Shared work appears for each recorded team member. Visit dates are appointment times, not verified completion times. Times shown in {timezone}.</p>
    <ListingFilters id="staff-history-filters" action={path} query={query} searchLabel="Search customer or task" dates/>
    {error ? <p id="staff-history-error" role="alert" className="mt-4">Work history could not be loaded. Please try again or check that the staff history database update is installed.</p> : <>
      <RecordTable id="staff-history-table" className="mt-4" caption="Completed staff work" empty="No completed work matches this view." columns={[{key:"task",label:"Task"},{key:"customer",label:"Customer",secondary:true},{key:"role",label:"Contribution",secondary:true},{key:"date",label:"Date and time"}]} rows={rows.slice(0, STAFF_HISTORY_SIZE).map(row => {
        const role = row.sources.map(source => workSourceLabels[source]).join(" · ");
        return { id: `staff-work-${row.kind}-${row.record_id}`, cells: { task: <Link id={`staff-work-open-${row.kind}-${row.record_id}`} href={staffWorkHref(row, industry)} className="font-medium underline">{row.work_label}</Link>, customer: row.customer_name, role, date: <>{date(row.occurred_at)}<p className="text-xs text-admin-text-secondary">{row.time_label}</p></> }, mobile: <><p>{row.customer_name}</p><p>{role}</p></> };
      })}/>
      <HistoryNavigation id="staff-history-pagination" path={`${path}?${new URLSearchParams({ q: query.q ?? "", from: query.from ?? "", to: query.to ?? "" })}`} parameter="page" page={page} hasMore={rows.length > STAFF_HISTORY_SIZE}/>
    </>}
  </section>;
}
