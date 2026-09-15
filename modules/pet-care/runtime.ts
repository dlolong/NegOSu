import "server-only";
import { petAppointmentPersistenceError } from "@/modules/pet-care/scheduling-errors";
import { notFound } from "next/navigation";
import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { getSchedulingServiceDependencies } from "@/modules/core/scheduling/scheduling.runtime";
import { saveAppointmentWithPersistence, type SaveAppointmentInput } from "@/modules/core/scheduling/scheduling.service";
export async function petContext(write = false) {
  const context = await getDashboardContext();
  if (context.activeMembership.industry !== "pet_care") notFound();
  const db = await createClient();
  const { data: enabled } = await db.rpc("pet_care_enabled", { p_org: context.activeMembership.organizationId });
  if (write && !enabled) throw new Error("This Pet Care business is currently unavailable.");
  const { data: branch } = await db.from("branches").select("timezone,opening_hours").eq("id", context.activeMembership.branchId).eq("organization_id", context.activeMembership.organizationId).single();
  return { ...context, db, enabled: enabled === true, branchTimezone: branch?.timezone ?? context.activeMembership.timezone, openingHours: branch?.opening_hours ?? {} };
}
export async function schedulePet(petId: string, input: SaveAppointmentInput) {
  const { db } = await petContext(true);
  return saveAppointmentWithPersistence({ ...input, allowAppointmentConflict: false }, async validated => {
    const { data, error } = await db.rpc("save_pet_appointment", { p_pet_id: petId, p_appointment_id: validated.appointmentId, p_branch_id: validated.branchId, p_service_ids: validated.serviceIds, p_starts_at: validated.scheduledStart, p_staff_ids: validated.staffAssignments.map(row => row.staffId).sort(), p_resource_ids: validated.resourceAssignments.map(row => row.resourceId).sort(), p_customer_note: validated.customerNote, p_internal_note: validated.internalNote });
    if (error || !data) throw petAppointmentPersistenceError(error);
    return data as string;
  }, await getSchedulingServiceDependencies());
}
