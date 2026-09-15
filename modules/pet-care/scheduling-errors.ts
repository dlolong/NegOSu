import { SchedulingError } from "@/modules/core/scheduling/scheduling.service";
import { appointmentPersistenceError } from "@/lib/supabase/appointment-persistence-errors";
import type { DatabaseError } from "@/lib/supabase/schema-compatibility";

const messages = new Map([
  ["Grooming appointment is outside branch hours", "The full grooming appointment must fit within branch operating hours. Choose an earlier time or another open day."],
  ["This pet already has a grooming appointment at that time", "This pet already has an appointment at that time. Choose another time."],
  ["Assign a groomer and grooming resource", "Select a groomer and grooming resource."],
  ["Assigned groomer is unavailable at this branch", "Select an active groomer assigned to this branch."],
  ["Assigned resource is unavailable at this branch", "Select an active grooming resource at this branch."],
  ["The assigned groomer is busy", "The selected groomer is already booked. Choose another groomer or time."],
  ["Grooming resource capacity exceeded", "The selected grooming resource is fully booked. Choose another resource or time."],
  ["Grooming service is unavailable", "Select an active grooming service available at this branch."],
  ["Pet is unavailable", "Select an active pet belonging to this workspace."],
  ["Pet owner is unavailable", "The pet's owner is archived or unavailable. Update the owner before booking."],
]);
export function petAppointmentPersistenceError(error: DatabaseError): Error {
  if (error && ["P0001", "23P01"].includes(error.code ?? "")) {
    const message = messages.get(error.message ?? "");
    if (message) return new SchedulingError(message);
  }
  return appointmentPersistenceError(error);
}
