"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { petSchema, groomingNoteSchema } from "@/modules/pet-care/pets";
import { petContext, schedulePet } from "@/modules/pet-care/runtime";
import { zonedDateTimeToUtc, parseMoneyToCentavos, selectedValues } from "@/lib/operations";
import { recordPaymentInputSchema } from "@/modules/core/payments/payment.service";
import { createAppointmentSelfServiceLink } from "@/modules/core/scheduling/appointment-self-service.runtime";
import { reportActionError } from "@/lib/errors/action-error";
const root = "/dashboard/pet-care";
function text(data: FormData, key: string) { return String(data.get(key) ?? "").trim(); }
function fail(path: string, message: string): never { redirect(`${root}${path}?error=${encodeURIComponent(message)}`); }
async function scopedAppointment(data: FormData) {
  const context = await petContext(true);
  const parsed = z.uuid().safeParse(text(data, "appointmentId"));
  if (!parsed.success) fail("/appointments", "Appointment not found.");
  const { data: appointment } = await context.db.from("appointments").select("id,branch_id").eq("id", parsed.data).eq("organization_id", context.activeMembership.organizationId).single();
  if (!appointment || !context.activeMembership.branches.some(branch => branch.id === appointment.branch_id)) fail("/appointments", "Appointment not found.");
  return { ...context, id: appointment.id };
}
export async function savePet(data: FormData) {
  const { db, activeMembership } = await petContext(true);
  const parsed = petSchema.safeParse({ ...Object.fromEntries(data), id: text(data, "id") || null, size_category: text(data, "size_category") || null, is_active: text(data, "is_active") === "true" });
  if (!parsed.success) fail("/pets", parsed.error.issues[0]?.message ?? "Check the pet details.");
  const { id, ...values } = parsed.data;
  const result = id ? await db.from("pet_profiles").update(values).eq("id", id).eq("organization_id", activeMembership.organizationId).select("id").single() : await db.from("pet_profiles").insert({ ...values, organization_id: activeMembership.organizationId }).select("id").single();
  if (result.error || !result.data) fail("/pets", "Unable to save this pet. Check the owner and date of birth. Finish or cancel active appointments before changing owners.");
  redirect(`${root}/pets/${result.data.id}`);
}
export async function savePetAppointment(data: FormData): Promise<{ error: string }> {
  const { db, activeMembership, branchTimezone } = await petContext(true);
  const petId = z.uuid().safeParse(text(data, "petId"));
  if (!petId.success) return { error: "Select a pet." };
  const { data: pet } = await db.from("pet_profiles").select("customer_id").eq("id", petId.data).eq("organization_id", activeMembership.organizationId).eq("is_active", true).single();
  const starts = zonedDateTimeToUtc(text(data, "startsAt"), branchTimezone);
  if (!pet || !starts) return { error: "Select an active pet and a valid local time." };
  if (!selectedValues(data, "staffIds").length || !selectedValues(data, "resourceIds").length) return { error: "Select a groomer and grooming resource." };
  let id: string;
  try { id = await schedulePet(petId.data, { organizationId: activeMembership.organizationId, appointmentId: text(data, "appointmentId") || null, branchId: activeMembership.branchId, customerId: pet.customer_id, serviceIds: selectedValues(data, "serviceIds"), staffAssignments: selectedValues(data, "staffIds").map(staffId => ({ staffId })), resourceAssignments: selectedValues(data, "resourceIds").map(resourceId => ({ resourceId })), scheduledStart: starts.toISOString(), customerNote: text(data, "customerNote"), internalNote: text(data, "internalNote") }); }
  catch (error) { return { error: reportActionError("pet.appointment.save", error, "Unable to save this grooming appointment. Your entries have been kept. Please try again.") }; }
  redirect(`${root}/appointments/${id}`);
}
export async function transitionPet(data: FormData) {
  const { db, id } = await scopedAppointment(data);
  const { error } = await db.rpc("transition_pet_appointment", { p_appointment_id: id, p_action: text(data, "action") });
  if (error) fail(`/appointments/${id}`, "This action is no longer available. Refresh the appointment.");
  redirect(`${root}/appointments/${id}`);
}
export async function payPetAppointment(data: FormData) {
  const { db, id } = await scopedAppointment(data);
  const parsed = recordPaymentInputSchema.safeParse({ appointmentId: id, amountCentavos: Number(parseMoneyToCentavos(text(data, "amount"))), method: text(data, "method"), idempotencyKey: text(data, "idempotencyKey"), reference: text(data, "reference") || null, notes: null });
  if (!parsed.success) fail(`/appointments/${id}`, "Enter a valid payment amount and method.");
  const p = parsed.data;
  const { error } = await db.rpc("record_appointment_payment", { p_appointment_id: id, p_amount_centavos: p.amountCentavos, p_method: p.method, p_idempotency_key: p.idempotencyKey, p_reference: p.reference, p_notes: p.notes });
  if (error) fail(`/appointments/${id}`, "Unable to record payment. Check your access and the remaining balance.");
  redirect(`${root}/appointments/${id}`);
}
export async function createPetLink(data: FormData) {
  const { id } = await scopedAppointment(data);
  let token: string;
  try { token = (await createAppointmentSelfServiceLink({ appointmentId: id, expiresAt: new Date(Date.now() + 7 * 86400000).toISOString() })).token; }
  catch { fail(`/appointments/${id}`, "Unable to create the appointment link."); }
  redirect(`${root}/appointments/${id}?link=${encodeURIComponent(`/appointment/${token}`)}`);
}

export async function reschedulePetAppointment(data: FormData) {
  const { db, id, activeMembership } = await scopedAppointment(data);
  const { data: appointment } = await db.from("appointments").select("branch_id,customer_id,customer_note,internal_note,branches(timezone),pet_appointment_details(pet_id),appointment_services(service_id),appointment_staff_assignments(staff_profile_id),appointment_resource_assignments(resource_id)").eq("id", id).single();
  if (!appointment) fail("/appointments", "Appointment not found.");
  const branch = Array.isArray(appointment.branches) ? appointment.branches[0] : appointment.branches;
  const pet = Array.isArray(appointment.pet_appointment_details) ? appointment.pet_appointment_details[0] : appointment.pet_appointment_details;
  const starts = zonedDateTimeToUtc(text(data, "startsAt"), branch?.timezone ?? activeMembership.timezone);
  if (!pet || !starts) fail(`/appointments/${id}`, "Select a valid local time.");
  try {
    await schedulePet(pet.pet_id, { appointmentId: id, organizationId: activeMembership.organizationId, branchId: appointment.branch_id, customerId: appointment.customer_id, scheduledStart: starts.toISOString(), serviceIds: appointment.appointment_services.map(s => s.service_id), staffAssignments: appointment.appointment_staff_assignments.map(s => ({staffId:s.staff_profile_id})), resourceAssignments: appointment.appointment_resource_assignments.map(r => ({resourceId:r.resource_id})), customerNote: appointment.customer_note, internalNote: appointment.internal_note });
  } catch (error) { fail(`/appointments/${id}`, reportActionError("pet.appointment.reschedule", error, "Unable to reschedule this appointment. Please try again.")); }
  redirect(`${root}/appointments/${id}`);
}

export async function addGroomingNote(data: FormData) {
 const {db,id}=await scopedAppointment(data);
 const parsed=groomingNoteSchema.safeParse({id:text(data,"id"),appointmentId:id,note:text(data,"note"),nextVisitOn:text(data,"nextVisitOn")});
 if(!parsed.success) fail(`/appointments/${id}`,"Enter a grooming note and a valid return date.");
 const {error}=await db.rpc("add_pet_grooming_note",{p_id:parsed.data.id,p_appointment_id:id,p_note:parsed.data.note,p_next_visit_on:parsed.data.nextVisitOn});
 if(error) fail(`/appointments/${id}`,"Unable to save the note. Check visit status, return date, and your access.");
 redirect(`${root}/appointments/${id}`);
}

export async function createAppointmentPet(input: unknown) {
 const { db, activeMembership } = await petContext(true);
 const { createVisitPet } = await import("@/modules/pet-care/quick-pet");
 return createVisitPet(input, activeMembership, db);
}
