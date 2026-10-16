import { z } from "zod";
import { formatMoney } from "@/lib/operations";

export const staffReportSchema = z.object({ rows: z.array(z.object({
  key: z.string(), staff: z.string(), occurred_at: z.string(), timezone: z.string(),
  transaction: z.string(), client: z.string(), price: z.number().int().nonnegative(),
})) });
export type StaffReport = z.infer<typeof staffReportSchema>;
export const staffReportNote = "Completed work only. Price is the current transaction amount, not staff earnings; staff involved in the same transaction are listed together.";
/** RPC keys are kind:record:staff; group by record identity, never by labels or price.
 * Keeping this mapping shared also consolidates previously saved snapshots.
 */
export function staffTransactionRows(report: StaffReport): StaffReport["rows"] {
  const groups = new Map<string, { row: StaffReport["rows"][number]; staff: Map<string, string> }>();
  for (const row of report.rows) {
    const parts = row.key.split(":");
    const key = parts.length === 3 ? parts.slice(0, 2).join(":") : row.key;
    const staffId = parts.length === 3 ? parts[2] : row.staff;
    const group = groups.get(key);
    if (group) group.staff.set(staffId, row.staff);
    else groups.set(key, { row: { ...row, key }, staff: new Map([[staffId, row.staff]]) });
  }
  return [...groups.values()].map(({ row, staff }) => ({
    ...row, staff: [...staff.values()].sort((a, b) => a.localeCompare(b)).join(", "),
  }));
}
export function staffReportTable(report: StaffReport, currency: string) {
  return {
    columns: [{key:"staff",label:"Staff"},{key:"date",label:"Date and time"},{key:"transaction",label:"Transaction"},{key:"client",label:"Client / guest"},{key:"price",label:"Price"}],
    rows: staffTransactionRows(report).map(row => ({id:row.key,cells:{staff:row.staff,
      date:new Intl.DateTimeFormat("en-PH",{timeZone:row.timezone,dateStyle:"medium",timeStyle:"short"}).format(new Date(row.occurred_at)),
      transaction:row.transaction,client:row.client,price:formatMoney(row.price,currency)}})),
  };
}

export function staffReportTotal(report: StaffReport): number {
  return staffTransactionRows(report).reduce((total, row) => total + row.price, 0);
}
