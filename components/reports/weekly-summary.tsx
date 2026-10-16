import type { loadWeeklyReport } from "@/modules/core/reporting/weekly-report";
import { formatMoney } from "@/lib/operations";
import { RecordTable } from "@/components/record-table";

export function WeeklySummary({ data, currency, branchName, timezone = "UTC", category = "daily" }: { timezone?: string; category?: "daily" | "bookings" | "payments"; data: Awaited<ReturnType<typeof loadWeeklyReport>>; currency: string; branchName: string }) {
  const bookings = category === "bookings";
  const payments = category === "payments";
  const title = bookings ? "Bookings" : payments ? "Payments" : "Daily activity";
  return <section id="reports-weekly-summary" className="space-y-3">
    <div><h2 className="text-lg font-medium">{title}</h2><p className="mt-1 text-sm text-admin-text-secondary">{branchName} · {data.range.start} – {data.range.end}</p></div>
    {data.kind === "business" ? <RecordTable id="reports-weekly-daily" caption={title} columns={[{ key: "date", label: "Date" }, ...(!bookings ? [{ key: "payments", label: "Payments received" }] : []), ...(!payments ? [{ key: "completed", label: "Completed work" }] : []), ...(!payments && !bookings ? [{ key: "sales", label: "Gross sales" }] : [])]} rows={data.report.daily.map(row => ({ id: `weekly-${row.day}`, cells: { date: row.day, sales: formatMoney(row.grossSalesCentavos, currency), payments: formatMoney(row.paymentsReceivedCentavos, currency), completed: row.jobsCompleted } }))} empty="No activity in this period."/> : <RecordTable id="reports-weekly-daily" caption="Check-ins and current stays" columns={[{key:"date",label:"Check-in"},{key:"guest",label:"Guest"},{key:"room",label:"Room"},{key:"status",label:"Status"}]} rows={data.report.rows.map((row,index)=>({id:`stay-${row.id ?? index}`,cells:{date:row.checked_in_at ? new Intl.DateTimeFormat("en-PH", { timeZone: timezone, dateStyle: "medium" }).format(new Date(String(row.checked_in_at))) : "—",guest:String(row.guest ?? "—"),room:String(row.room ?? "—"),status:row.checked_out_at ? "Checked out" : "In house"}}))} empty="No stays in this period."/>}
    {bookings && data.kind === "business" ? <p className="text-xs text-admin-text-secondary">Daily completed work. Use the booking register to review individual upcoming or cancelled bookings.</p> : null}
    {data.kind === "hospitality" ? <p className="text-xs text-admin-text-secondary">Current stays and check-ins/checkouts in this period · {data.report.rowCount} records. Showing {data.report.rows.length}.</p> : null}
  </section>;
}
