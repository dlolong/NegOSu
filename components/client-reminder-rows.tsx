import { RecordTable } from "@/components/record-table";
import Link from "next/link";
import { resolveReminder } from "@/app/dashboard/customers/reminder-actions";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";

export type ClientReminder = {
  id: string; reason: string; due_at: string; status: string; resolved_at: string | null;
  customer_id: string;
  customers: { full_name: string; phone: string | null } | null;
  branches: { name: string; timezone: string } | null;
};
export function ReminderRows({ rows, timezone, canWrite, now, searchable = false, clientOrigin = false }: { rows: ClientReminder[]; timezone: string; canWrite: boolean; now: string; searchable?: boolean; clientOrigin?: boolean }) {
  return <RecordTable searchable={searchable} id="client-reminders-table" className="mt-3" caption="Client reminders" columns={[{key:"client",label:"Client"},{key:"reason",label:"Reason",secondary:true},{key:"due",label:"Due",secondary:true},{key:"status",label:"Status",secondary:true},{key:"actions",label:"Actions",align:"right"}]} rows={rows.map(r => {
    const due = new Intl.DateTimeFormat("en-PH", {timeZone:r.branches?.timezone ?? timezone,dateStyle:"medium",timeStyle:"short"}).format(new Date(r.due_at));
    const status = r.status === "pending" ? new Date(r.due_at).valueOf() <= new Date(now).valueOf() ? "Due — contact client" : "Upcoming" : r.status === "contacted" ? "Contacted" : "Cancelled";
    return {id:`client-reminder-${r.id}`,cells:{client:<><Link id={`reminder-client-${r.id}`} href={`/dashboard/customers/${r.customer_id}`} className="font-medium underline">{r.customers?.full_name ?? "Client"}</Link><p className="text-xs">{r.customers?.phone || "No phone number recorded"}</p></>,reason:r.reason,due:<>{due}<p className="text-xs">{r.branches?.name}</p></>,status:<>{status}{r.resolved_at ? <p className="text-xs">Recorded {new Intl.DateTimeFormat("en-PH", {timeZone:r.branches?.timezone ?? timezone,dateStyle:"medium",timeStyle:"short"}).format(new Date(r.resolved_at))}</p> : null}</>,actions:canWrite && r.status === "pending" ? <div className="flex flex-wrap gap-2">
      <form action={resolveReminder}>{clientOrigin ? <input type="hidden" name="origin" value="client"/> : null}<input type="hidden" name="id" value={r.id}/><input type="hidden" name="status" value="contacted"/><SubmitButton id={`reminder-contacted-${r.id}`} pendingText="Saving…" size="sm">Mark contacted</SubmitButton></form>
      <form action={resolveReminder}>{clientOrigin ? <input type="hidden" name="origin" value="client"/> : null}<input type="hidden" name="id" value={r.id}/><input type="hidden" name="status" value="cancelled"/><SubmitButton id={`reminder-cancel-${r.id}`} pendingText="Saving…" size="sm" variant="secondary">Cancel reminder</SubmitButton></form>
    </div> : null},mobile:<><p>{r.reason}</p><p>{due} · {r.branches?.name}</p><p>{status}</p></>};
  })}/>;
}

export function HistoryNavigation({ id, path, parameter, page, hasMore }: { id: string; path: string; parameter: string; page: number; hasMore: boolean }) {
  return page > 1 || hasMore ? <nav id={id} aria-label={id.replaceAll("-", " ")} className="mt-3 flex flex-wrap items-center justify-between gap-2">
    {page > 1 ? <Button asChild variant="secondary" size="sm"><Link id={`${id}-previous`} href={`${path}${path.includes("?") ? "&" : "?"}${parameter}=${page - 1}`}>Previous</Link></Button> : <span/>}
    <span className="text-sm">Page {page}</span>
    {hasMore ? <Button asChild variant="secondary" size="sm"><Link id={`${id}-next`} href={`${path}${path.includes("?") ? "&" : "?"}${parameter}=${page + 1}`}>Next</Link></Button> : <span/>}
  </nav> : null;
}
