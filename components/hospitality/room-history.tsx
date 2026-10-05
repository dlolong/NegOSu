import { z } from "zod";
import { hospitalityContext } from "@/modules/hospitality/runtime";
import { reportAccessSchema, reportQuerySchema } from "@/lib/reporting";
import { resolveHospitalityReportScope } from "@/modules/hospitality/reporting";
import { PlanUpgradeNotice } from "@/components/plan-upgrade";
import { RecordTable } from "@/components/record-table";
import { RecordLink } from "@/components/record-item";
import { HospitalityReportFilters } from "./report-filters";
import { LoadError, PageLinks, dateLabel, pageNumber } from "./shared";

const historySchema = z.object({ rowCount: z.number(), rows: z.array(z.object({ id: z.uuid(), guest_name_snapshot: z.string(), checked_in_at: z.string(), checked_out_at: z.string().nullable() })) });
export async function RoomHistory({ roomId, query }: { roomId: string; query: Record<string, string | undefined> }) {
  const { db, activeMembership: m } = await hospitalityContext();
  const access = await db.rpc("get_org_entitlements", { p_organization_id: m.organizationId });
  const entitlement = reportAccessSchema.safeParse(access.data);
  if (access.error || !entitlement.success) return <LoadError>Could not check history access. Refresh to try again.</LoadError>;
  const advanced = entitlement.data.features.advanced_reports;
  const parsed = reportQuerySchema.safeParse(query);
  const scope = resolveHospitalityReportScope(parsed.success ? parsed.data : reportQuerySchema.parse({}), m, advanced, "history");
  const page = pageNumber(query.page);
  const result = await db.rpc("get_hospitality_room_history", { p_org: m.organizationId, p_branch: m.branchId, p_room: roomId, p_start: scope.range.start, p_end: scope.range.end, p_page: page });
  const history = historySchema.safeParse(result.data);
  const qs = new URLSearchParams({ tab: "history", preset: scope.filters.preset, start: scope.range.start, end: scope.range.end });
  return <section id="hospitality-room-history" className="mt-5">
    {!advanced ? <div className="flex flex-wrap items-center gap-3 text-sm"><p>Free plan · Up to 30 days. Custom dates require a paid plan.</p><PlanUpgradeNotice id="hospitality-room-history-upgrade" capability="advanced_reports" compact/></div> : null}
    <HospitalityReportFilters advanced={advanced} mode="history" section="stays" scope={scope} branchName={m.branchName} branches={m.branches}/>
    <p className="my-3 text-xs text-slate-500">Activity period: {scope.range.start} to {scope.range.end}. Current in-house stays plus check-ins or checkouts during the period.</p>
    {result.error || !history.success ? <LoadError>Room history could not be loaded. Refresh to try again.</LoadError> : <>
      <RecordTable searchable id="hospitality-room-history-table" caption="Room stay history" empty="No stays found for this period." columns={[{ key: "guest", label: "Guest" }, { key: "arrival", label: "Check-in", secondary: true }, { key: "departure", label: "Check-out" }]} rows={history.data.rows.map(stay => ({ id: `hospitality-room-history-${stay.id}`, cells: { guest: <RecordLink href={`/dashboard/hospitality/stays/${stay.id}`}>{stay.guest_name_snapshot}</RecordLink>, arrival: dateLabel(stay.checked_in_at, m.timezone), departure: stay.checked_out_at ? dateLabel(stay.checked_out_at, m.timezone) : "In house" }, mobile: <p>Check-in: {dateLabel(stay.checked_in_at, m.timezone)}</p> }))}/>
      <PageLinks page={page} count={history.data.rowCount} href={p => `/dashboard/hospitality/rooms/${roomId}?${qs}&page=${p}`}/>
    </>}
  </section>;
}
