import "server-only";
import { createClient } from "@/lib/supabase/server";
import { appointmentPersistenceError } from "@/lib/supabase/appointment-persistence-errors";
import { SchedulingError, type SaveAppointmentInput } from "@/modules/core/scheduling/scheduling.service";
import type { AppointmentPromoChoice } from "./appointment-promos";

export async function getAppointmentPromos(organizationId: string) {
  const db = await createClient();
  const { data, error } = await db.from("commerce_promos").select("id,name,description,branch_id,version,price_centavos,currency,valid_from,valid_through,components").eq("organization_id", organizationId).eq("status", "active").order("name");
  const choices: AppointmentPromoChoice[] = [];
  for (const p of data ?? []) {
    const services = (p.components as { kind: string; referenceId: string }[]).filter(c => c.kind === "service");
    const service = services[0];
    if (service) choices.push({ id: p.id, name: p.name, description: p.description, branchId: p.branch_id, serviceId: service.referenceId, serviceIds: services.map(s => s.referenceId), version: p.version, priceCentavos: Number(p.price_centavos), currency: p.currency, validFrom: p.valid_from, validThrough: p.valid_through });
  }
  return { choices, error: error ? "Promos could not be loaded. Ask an administrator to check commerce setup." : undefined };
}

export async function persistPromoAppointment(input: SaveAppointmentInput, extension: { vehicleId?: string | null; petId?: string; maintenanceDueId?: string | null } = {}) {
  if (input.appointmentId || !input.requestId) throw new SchedulingError("Select promos when creating a new appointment.");
  const db = await createClient();
  const { data, error } = await db.rpc("book_appointment_with_promos", {
    p_request: input.requestId, p_branch: input.branchId, p_customer: input.customerId,
    p_vehicle: extension.vehicleId ?? null, p_pet: extension.petId ?? null, p_maintenance: extension.maintenanceDueId ?? null,
    p_services: input.serviceIds, p_promos: input.promoSelections, p_start: input.scheduledStart,
    p_staff: (input.staffAssignments ?? []).map(s => s.staffId), p_resources: (input.resourceAssignments ?? []).map(r => r.resourceId),
    p_customer_note: input.customerNote ?? null, p_internal_note: input.internalNote ?? null, p_allow_conflict: input.allowAppointmentConflict ?? false,
  });
  if (error || !data) {
    if (["PGRST202", "42P01", "42883"].includes(error?.code ?? "")) throw new SchedulingError("Appointment promos need database setup. Apply migration 0105, then try again.");
    if (error?.code === "22023" || error?.code === "40001") throw new SchedulingError("A selected promo changed or is unavailable for this branch or appointment date. Refresh and select it again.");
    throw appointmentPersistenceError(error);
  }
  return data as string;
}
