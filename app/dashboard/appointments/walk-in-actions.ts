"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { selectedValues } from "@/lib/operations";
import { reportActionError } from "@/lib/errors/action-error";
import { appointmentPersistenceError } from "@/lib/supabase/appointment-persistence-errors";
import { petAppointmentPersistenceError } from "@/modules/pet-care/scheduling-errors";
import { SchedulingError } from "@/modules/core/scheduling/scheduling.service";

const inputSchema = z.object({
  requestId: z.uuid(), branchId: z.uuid(), customerId: z.uuid().nullable(), petId: z.uuid().nullable(),
  serviceIds: z.array(z.uuid()).min(1).max(50), staffIds: z.array(z.uuid()).max(50), resourceIds: z.array(z.uuid()).max(50),
  customerNote: z.string().max(2000), internalNote: z.string().max(2000),
});

export async function saveAppointmentWalkIn(data: FormData): Promise<{ error: string }> {
  const { activeMembership: member } = await getDashboardContext();
  if (!["salon", "pet_care"].includes(member.industry) || !["owner", "manager", "advisor"].includes(member.role)) return { error: "You do not have access to add walk-ins." };
  const value = (key: string) => String(data.get(key) ?? "").trim();
  const parsed = inputSchema.safeParse({ requestId: value("requestId"), branchId: value("branchId") || member.branchId,
    customerId: value("customerId") || null, petId: value("petId") || null, serviceIds: selectedValues(data, "serviceIds"),
    staffIds: selectedValues(data, "staffIds"), resourceIds: selectedValues(data, "resourceIds"),
    customerNote: value("customerNote") || value("notes"), internalNote: value("internalNote"),
  });
  if (!parsed.success) return { error: "Select the customer or pet and at least one service. Notes must be under 2,000 characters." };
  const input = parsed.data;
  if (!member.branches.some(branch => branch.id === input.branchId)) return { error: "Select an available branch." };
  if (member.industry === "pet_care" && (!input.petId || !input.staffIds.length || !input.resourceIds.length)) return { error: "Select a pet, groomer, and grooming resource." };
  if (member.industry === "salon" && !input.customerId) return { error: "Select a client." };
  const db = await createClient();
  const { data: id, error } = await db.rpc("create_appointment_walk_in", {
    p_request_id: input.requestId, p_branch_id: input.branchId, p_customer_id: member.industry === "salon" ? input.customerId : null,
    p_pet_id: member.industry === "pet_care" ? input.petId : null, p_service_ids: input.serviceIds,
    p_staff_ids: input.staffIds, p_resource_ids: input.resourceIds, p_customer_note: input.customerNote, p_internal_note: input.internalNote,
  });
  if (error || !id) {
    const messages: Record<string, string> = {
      "Walk-in is outside branch hours": "There is not enough time to finish this walk-in within branch hours. Choose shorter services or book an appointment for another time.",
      "Another appointment overlaps this time": "The branch already has a visit at this time. Review the schedule before adding this walk-in.",
      "Walk-in customer is unavailable": "Select an active client in this workspace.",
    };
    const message = error?.code === "P0001" ? messages[error.message] : undefined;
    const persistenceError = member.industry === "pet_care" ? petAppointmentPersistenceError(error) : appointmentPersistenceError(error);
    return { error: reportActionError("appointment.walk_in", message ? new SchedulingError(message) : persistenceError, "Unable to add this walk-in. Your entries have been kept. Please try again.") };
  }
  const root = member.industry === "pet_care" ? "/dashboard/pet-care/appointments" : "/dashboard/appointments";
  revalidatePath(root); revalidatePath("/dashboard"); revalidatePath("/dashboard/pet-care");
  redirect(`${root}/${id}`);
}
