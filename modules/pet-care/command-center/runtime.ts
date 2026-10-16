import "server-only";
import { appointmentAgendaRange } from "@/lib/operations";
import { dashboardBranchContextHref } from "@/modules/platform/command-center-branch-context";
import { createClient } from "@/lib/supabase/server";
import type { SharedCommandCenterSnapshot } from "@/modules/core/command-center";
import { loadAppointmentAssignmentContext, assignmentContextLabel } from "@/modules/core/scheduling/appointment-assignment-view";
import { listOperationalStaffDirectory } from "@/modules/core/staff/staff.runtime";

export async function getPetCommandCenter(shared: SharedCommandCenterSnapshot) {
  const db = await createClient();
  // Current work and nearby scheduled visits, bounded for the presentation only.
  // Summary counts come from the uncapped, branch-authorized aggregate RPC.
  const windows = shared.branchPerformance.map(branch => appointmentAgendaRange(new Intl.DateTimeFormat("en-CA", { timeZone: branch.timezone }).format(new Date()), 1, branch.timezone)!);
  const start = new Date(Math.min(...windows.map(window => window.start.valueOf()))).toISOString();
  const end = new Date(Math.max(...windows.map(window => window.end.valueOf()))).toISOString();
  const result = await db.from("appointments").select("id,branch_id,starts_at,status,customers(full_name),appointment_services(service_name_snapshot),pet_appointment_details!inner(pet_name_snapshot,pickup_status)")
    .eq("organization_id", shared.scope.organizationId).in("branch_id", shared.scope.branchIds)
    .or(`and(starts_at.gte.${start},starts_at.lt.${end}),status.in.(checked_in,in_service)`)
    .order("starts_at").limit(200);
  if (result.error) throw new Error("Grooming activity unavailable.");
  const assignments = await loadAppointmentAssignmentContext(shared.scope.organizationId, (result.data ?? []).map(a => a.id));
  const directory = await listOperationalStaffDirectory(shared.scope.organizationId);
  const rows = (result.data ?? []).filter(a => {
    const tz = shared.branchPerformance.find(b => b.branchId === a.branch_id)?.timezone ?? "UTC";
    const day = (value: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(value);
    return ["checked_in", "in_service"].includes(a.status) || (a.starts_at && day(new Date(a.starts_at)) === day(new Date()));
  });
  const relation = (value: unknown, key: string) => String((Array.isArray(value) ? value[0] : value)?.[key] ?? "");
  const counts = shared.activity!;
  return { ...shared, metrics: [
    ...shared.metrics.filter(m => m.key === "appointments_today"),
    { key: "checked_in", label: "Checked in", value: counts.checkedIn, valueKind: "count" as const },
    { key: "grooming", label: "Grooming in progress", value: counts.inService, valueKind: "count" as const },
    { key: "pickup", label: "Ready for pickup", value: counts.readyPickup, valueKind: "count" as const },
    ...shared.metrics.filter(m => m.valueKind === "currency"),
  ], actions: [
    ...(counts.readyPickup ? [{ id: "pickup", code: "pickup", title: `${counts.readyPickup} pet(s) ready for pickup`, priority: "high" as const, href: "/dashboard/pet-care/appointments" }] : []),
    ...(counts.checkedIn ? [{ id: "waiting", code: "waiting", title: `${counts.checkedIn} pet(s) checked in`, priority: "medium" as const, href: "/dashboard/pet-care/appointments" }] : []),
    ...shared.branchPerformance.filter(b => b.lowStockCount > 0).map(b => ({ id: `stock-${b.branchId}`, branchId: b.branchId, code: "stock", title: `${b.lowStockCount} low-stock product(s)`, priority: "medium" as const, href: dashboardBranchContextHref(b.branchId, "/dashboard/inventory") })),
  ], operations: rows.map(a => {
    const labels = assignmentContextLabel(assignments.get(a.id) ?? { scheduledStaff: [], scheduledResources: [] });
    return { id: a.id, branchId: a.branch_id, title: relation(a.pet_appointment_details, "pet_name_snapshot"), subject: relation(a.customers, "full_name"), startsAt: a.starts_at,
      status: relation(a.pet_appointment_details, "pickup_status") === "ready" ? "ready_for_pickup" : a.status,
      serviceSummary: a.appointment_services.map(s => s.service_name_snapshot).join(", "), staffSummary: labels.staff, resourceSummary: labels.resources, href: `/dashboard/pet-care/appointments/${a.id}` };
  }), staff: directory.filter(s => !s.branchIds.length || s.branchIds.some(id => shared.scope.branchIds.includes(id))).slice(0, 10).map(s => ({ id: s.staffId, displayName: s.fullName, status: "active" as const, context: s.jobFunction ?? "Staff profile", href: "/dashboard/settings/staff" })) };
}
