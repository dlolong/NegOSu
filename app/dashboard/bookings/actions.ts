"use server";

import { proposeAlternativeSchema, alternativeError } from "@/modules/core/scheduling/booking-alternatives";
import { zonedDateTimeToUtc } from "@/lib/operations";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { formValue } from "@/lib/crm";
import { requireIndustryFeature } from "@/lib/auth/industry-access";
import { roleHasPermission } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";

export async function reviewBooking(data: FormData) {
  const { activeMembership } = await requireIndustryFeature("booking_requests");
  if (!roleHasPermission(activeMembership.role, "appointments.manage")) redirect("/dashboard/bookings?error=Booking+management+access+required.");
  const parsed = z.object({ id: z.uuid(), action: z.enum(["confirm", "decline"]), reason: z.string().trim().max(1000) }).safeParse({ id: formValue(data, "id"), action: formValue(data, "action"), reason: formValue(data, "reason") });
  if (!parsed.success) redirect("/dashboard/bookings?error=Invalid+review.");
  const supabase = await createClient();
  const request = await supabase.from("public_booking_requests").select("id").eq("id", parsed.data.id).eq("organization_id", activeMembership.organizationId).eq("branch_id", activeMembership.branchId).maybeSingle();
  if (request.error || !request.data) redirect("/dashboard/bookings?error=Booking+request+not+available+in+this+branch.");
  const alternativeVersion = Number(formValue(data,"alternativeVersion"));
  if (parsed.data.action === "confirm" && Number.isInteger(alternativeVersion) && alternativeVersion > 0) {
    const petId = formValue(data,"petId") || null;
    if (petId && !z.uuid().safeParse(petId).success) redirect("/dashboard/bookings?error=Invalid+pet+record.");
    const {error}=await supabase.rpc("confirm_booking_alternative",{p_booking:parsed.data.id,p_version:alternativeVersion,p_pet:petId});
    if(error)redirect(`/dashboard/bookings?error=${encodeURIComponent(alternativeError(error))}`);
    revalidatePath("/dashboard/bookings");revalidatePath("/dashboard/appointments");revalidatePath("/dashboard/pet-care");revalidatePath("/booking/[token]","page");
    redirect("/dashboard/bookings?message=Agreed+alternative+confirmed.");
  }
  const petConfirmation = activeMembership.industry === "pet_care" && parsed.data.action === "confirm";
  const assignment = z.object({petId:z.uuid().nullable(),staffId:z.uuid(),resourceId:z.uuid()}).safeParse({petId:formValue(data,"petId")||null,staffId:formValue(data,"staffId"),resourceId:formValue(data,"resourceId")});
  if (petConfirmation && !assignment.success) redirect("/dashboard/bookings?error=Select+a+groomer+and+resource.");
  const { error } = petConfirmation && assignment.success ? await supabase.rpc("confirm_pet_public_booking", { p_booking_id:parsed.data.id, p_pet_id:assignment.data.petId, p_staff_id:assignment.data.staffId, p_resource_id:assignment.data.resourceId }) : await supabase.rpc("review_public_booking", { p_booking_id: parsed.data.id, p_action: parsed.data.action, p_reason: parsed.data.reason || null });
  if (error) redirect("/dashboard/bookings?error=Unable+to+update+this+booking.+Refresh+and+try+again.");
  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/appointments");
  revalidatePath("/dashboard/pet-care");
  redirect(`/dashboard/bookings?message=${parsed.data.action === "confirm" ? "Booking+confirmed." : "Booking+declined."}`);
}

export async function proposeAlternative(data: FormData) {
  const { activeMembership } = await requireIndustryFeature("booking_requests");
  if (!roleHasPermission(activeMembership.role,"appointments.manage")) redirect("/dashboard/bookings?error=Booking+management+access+required.");
  const parsed=proposeAlternativeSchema.safeParse({id:formValue(data,"id"),version:formValue(data,"version"),startsAt:formValue(data,"startsAt"),staffId:formValue(data,"staffId")||null,resourceId:formValue(data,"resourceId")||null,message:formValue(data,"message")});
  if(!parsed.success)redirect("/dashboard/bookings?error=Check+the+proposed+date,+staff,+and+message.");
  const db=await createClient();
  const {data:request}=await db.from("public_booking_requests").select("id").eq("id",parsed.data.id).eq("organization_id",activeMembership.organizationId).eq("branch_id",activeMembership.branchId).maybeSingle();
  if(!request)redirect("/dashboard/bookings?error=Booking+unavailable+in+this+branch.");
  const startsAt=zonedDateTimeToUtc(parsed.data.startsAt,activeMembership.timezone);
  if(!startsAt)redirect("/dashboard/bookings?error=Invalid+local+date+and+time.");
  const {error}=await db.rpc("propose_booking_alternative",{p_booking:parsed.data.id,p_version:parsed.data.version,p_start:startsAt,p_staff:parsed.data.staffId,p_resource:parsed.data.resourceId,p_message:parsed.data.message});
  if(error)redirect(`/dashboard/bookings?requestId=${parsed.data.id}&error=${encodeURIComponent(alternativeError(error))}`);
  revalidatePath("/dashboard/bookings");revalidatePath("/booking/[token]","page");
  redirect("/dashboard/bookings?message=Alternative+published+on+the+client%27s+booking+status+page.+Waiting+for+their+response.");
}
