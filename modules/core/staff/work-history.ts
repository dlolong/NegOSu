import type { SupabaseClient } from "@supabase/supabase-js";
import { listingDate, listingDateEnd, listingOrSearch, listingSearch } from "@/lib/listing-query";

export const STAFF_HISTORY_SIZE = 20;
export type WorkScope = { organizationId: string; branchId: string; industry: string };
export type WorkSource = "scheduled_staff" | "visit_assignment" | "job_assignment" | "service_assignment" | "work_session" | "cashier" | "housekeeper";
export const workSourceLabels: Record<WorkSource, string> = {
  scheduled_staff: "Scheduled team", visit_assignment: "Visit team", job_assignment: "Job lead", service_assignment: "Service assignment",
  work_session: "Recorded work on job", cashier: "Cashier", housekeeper: "Housekeeper",
};
export type StaffWork = {
  kind: "appointment" | "job" | "stay"; record_id: string; target_id: string; staff_id: string;
  customer_name: string; occurred_at: string; time_label: string; work_label: string; sources: WorkSource[];
};
export type WorkParticipation = {
  kind: StaffWork["kind"]; record_id: string; target_id: string; appointment_id: string | null;
  staff_id: string; staff_name: string; service_id: string | null; source: WorkSource;
};
export type WorkContributor = { staffId: string; name: string; sources: WorkSource[] };

export function loadStaffWorkHistory(db: SupabaseClient, scope: WorkScope, staffId: string, page: number, filters: { q?: string; from?: string; to?: string }) {
  let request = db.from("staff_completed_work").select("kind,record_id,target_id,staff_id,customer_name,occurred_at,time_label,work_label,sources")
    .eq("organization_id", scope.organizationId).eq("branch_id", scope.branchId).eq("staff_id", staffId);
  if (listingSearch(filters.q)) request = request.or(listingOrSearch(["customer_name", "work_label"], filters.q));
  if (listingDate(filters.from)) request = request.gte("occurred_at", `${listingDate(filters.from)}T00:00:00Z`);
  if (listingDateEnd(filters.to)) request = request.lt("occurred_at", listingDateEnd(filters.to)!);
  const offset = (page - 1) * STAFF_HISTORY_SIZE;
  return request.order("occurred_at", { ascending: false }).order("kind").order("record_id").range(offset, offset + STAFF_HISTORY_SIZE);
}
export function staffWorkHref(row: Pick<StaffWork, "kind" | "target_id">, industry: string) {
  if (row.kind === "job") return `/dashboard/jobs/${row.target_id}`;
  if (row.kind === "stay") return `/dashboard/hospitality/stays/${row.target_id}`;
  return `/dashboard/${industry === "pet_care" ? "pet-care/" : ""}appointments/${row.target_id}`;
}

/** Preserve every employee; repeat sessions/roles never repeat their name. */
export function groupWorkContributors(rows: WorkParticipation[], key: "appointment_id" | "target_id", serviceIds?: Set<string>) {
  const groups = new Map<string, Map<string, WorkContributor>>();
  for (const row of rows) {
    const id = row[key];
    if (!id || (row.source === "service_assignment" && serviceIds && (!row.service_id || !serviceIds.has(row.service_id)))) continue;
    const people = groups.get(id) ?? new Map<string, WorkContributor>();
    const person = people.get(row.staff_id) ?? { staffId: row.staff_id, name: row.staff_name, sources: [] };
    if (!person.sources.includes(row.source)) person.sources.push(row.source);
    // A work-session snapshot is the historical name, ahead of today's profile.
    if (row.source === "work_session") person.name = row.staff_name;
    people.set(row.staff_id, person); groups.set(id, people);
  }
  return new Map([...groups].map(([id, people]) => [id, [...people.values()].sort((a, b) => a.name.localeCompare(b.name))]));
}

/** Bounded page of parent IDs, fully paged children so large teams aren't truncated. */
export async function loadWorkParticipation(db: SupabaseClient, scope: WorkScope, key: "appointment_id" | "target_id", ids: string[]) {
  const uniqueIds = [...new Set(ids)];
  if (!uniqueIds.length) return { data: [] as WorkParticipation[], error: null };
  const rows: WorkParticipation[] = [];
  for (let offset = 0; ; offset += 500) {
    const result = await db.from("staff_work_participation").select("kind,record_id,target_id,appointment_id,staff_id,staff_name,service_id,source")
      .eq("organization_id", scope.organizationId).eq("branch_id", scope.branchId).in(key, uniqueIds)
      .order("record_id").order("staff_id").order("source").order("service_id").order("staff_name").range(offset, offset + 499);
    if (result.error) return { data: [] as WorkParticipation[], error: result.error };
    rows.push(...(result.data ?? []) as WorkParticipation[]);
    if ((result.data?.length ?? 0) < 500) return { data: rows, error: null };
  }
}
