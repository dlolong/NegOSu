import "server-only";
import { NextResponse } from "next/server";
import { csvCell } from "@/lib/reporting";
import { hospitalityContext } from "./runtime";
import type { HospitalityWorkspace } from "./contracts";
/** Route composition has already enforced reports.view, paid export and branch access. */
export async function exportHospitalityReport(input: { branch: string | null; start: string; end: string; section: string }) {
  const { db, activeMembership } = await hospitalityContext();
  const { data, error } = await db.rpc("export_hospitality_workspace", { p_org: activeMembership.organizationId, p_branch: input.branch, p_start: input.start, p_end: input.end, p_section: input.section });
  if (error?.code === "54000") return new NextResponse("This export exceeds 10,000 rows. Narrow the period or branch.", { status: 422 });
  if (error) throw new Error("Unable to export hospitality report", { cause: error });
  const first = data as HospitalityWorkspace, records = first.rows;
  const metrics: Array<Array<string | number>> = [["Activity period", `${input.start} to ${input.end}`], ["Current snapshot", "Rooms, in-house stays, outstanding balances and stock"], ["Occupied rooms now", first.occupied], ["Available rooms now", first.vacant], ["Cleaning rooms now", first.cleaning], ["Inactive rooms now", first.inactive], ["Check-ins in period", first.checkIns], ["Checkouts in period", first.checkOuts], ["In-house stays now", first.inHouse]];
  if (first.finance) metrics.push(["Collected in period (centavos; excludes void/refund)", first.finance.collected], ["Outstanding now (centavos; includes checked-out stays)", first.finance.outstanding], ["Deposits held now (centavos; excluded from revenue)", first.finance.depositsHeld], ["Deposits received in period (centavos)", first.finance.depositsReceived], ["Deposits returned in period (centavos)", first.finance.depositsReturned]);
  // No contacts or internal tenant identifiers in exports.
  const keys = Object.keys(records[0] ?? {}).filter(key => key !== "id" && !key.endsWith("_id"));
  const rows = [...metrics, [], keys, ...records.map(row => keys.map(key => String(row[key] ?? "")))];
  return new NextResponse(`\uFEFF${rows.map(row => row.map(csvCell).join(",")).join("\r\n")}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="negosu-hospitality-${input.section}-${input.start}-${input.end}.csv"`, "Cache-Control": "private, no-store" } });
}
