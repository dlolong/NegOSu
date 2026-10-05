"use server";

import { readAppointmentPromos } from "@/modules/core/commerce/appointment-promos";
import { publicRequestRateKey, publicBookingProtectionError } from "@/lib/public-request-protection";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { formValue, firstError } from "@/lib/crm";
import { reportActionError } from "@/lib/errors/action-error";
import { publicBookingSchemaForIndustry, type PublicBookingState, type PublicShop } from "@/lib/public-booking";
import { createClient } from "@/lib/supabase/server";

export async function submitBooking(_previous: PublicBookingState, data: FormData): Promise<PublicBookingState> {
  const fields = ["slug", "branchId", "preferredAt", "customerName", "phone", "email", "vehicleMake", "vehicleModel", "vehicleYear", "vehicleType", "plateNumber", "customerNote", "website", "petName", "species", "breed"];
  const values = Object.fromEntries(fields.map((key) => [key, formValue(data, key)]));
  const fail = (error: string) => ({ error, values });
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.slug)) return fail("This booking link is invalid.");
  const supabase = await createClient();
  const { data: publicShop, error: shopError } = await supabase.rpc("get_public_shop", { p_slug: values.slug });
  const shop = publicShop as PublicShop | null;
  if (shopError || !shop) return fail("Online booking is unavailable. Please contact the business directly.");
  // Legacy Automotive responses predate the industry field; unsupported industries fail closed.
  const industry = shop.industry ?? "automotive";
  if (industry !== "salon" && industry !== "automotive" && industry !== "pet_care") return fail("Online booking is unavailable.");
  const parsed = publicBookingSchemaForIndustry(industry).safeParse({ ...values, serviceIds: data.getAll("serviceIds") });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    const labels: Record<string, string> = { preferredAt: "preferred time", customerName: "full name", phone: "mobile number", email: "email address", vehicleMake: "vehicle make", vehicleModel: "vehicle model", vehicleYear: "model year" };
    const message = firstError(parsed.error);
    return fail(message === "Invalid input" && typeof field === "string" && labels[field] ? `Please enter a valid ${labels[field]}.` : message);
  }
  if (!shop.branches.some((branch) => branch.id === parsed.data.branchId && branch.acceptsBookings)
    || parsed.data.serviceIds.some((id) => !shop.services.some((service) => service.id === id))) {
    return fail("This branch or service is no longer available. Please refresh the openings.");
  }
  let promos: ReturnType<typeof readAppointmentPromos>;
  try { promos=readAppointmentPromos(data); } catch { return fail("Refresh and select your promo again."); }
  if(promos.length>10)return fail("Select no more than 10 promos.");
  const h = await headers();
  const rateKey = publicRequestRateKey(h.get("x-forwarded-for"));
  const common={p_slug:parsed.data.slug,p_branch_id:parsed.data.branchId,p_service_ids:parsed.data.serviceIds,p_preferred_at:parsed.data.preferredAt,p_customer_name:parsed.data.customerName,p_phone:parsed.data.phone,p_email:parsed.data.email||null,p_customer_note:parsed.data.customerNote||null,p_rate_key_hash:rateKey,p_honeypot:parsed.data.website};
  const vehicle={p_vehicle_make:parsed.data.vehicleMake||null,p_vehicle_model:parsed.data.vehicleModel||null,p_vehicle_year:parsed.data.vehicleYear||null,p_vehicle_type:parsed.data.vehicleType||null,p_plate_number:parsed.data.plateNumber||null};
  const pet={p_pet_name:values.petName.trim()||null,p_species:values.species||null,p_breed:values.breed.trim()||null};
  const {data:result,error}=promos.length
    ?await supabase.rpc("submit_public_promo_booking",{...common,...vehicle,...pet,p_promos:promos})
    :await supabase.rpc(industry==="pet_care"?"submit_pet_public_booking":"submit_public_booking",{...common,...(industry==="pet_care"?pet:vehicle)});
  const protectionError = error ? publicBookingProtectionError(error) : null;
  if (protectionError) return fail(protectionError);
  if(promos.length&&error?.code==="22023")return fail("A selected promo changed or is unavailable for this date. Go back to services and select it again.");
  if(promos.length&&["PGRST202","42P01","42883"].includes(error?.code??""))return fail("Promo booking is temporarily unavailable. Please contact the business or choose a regular service.");
  if (error || !result) return fail(reportActionError("public_booking.submit", error, "Unable to submit this request. The opening may no longer be available. Please refresh the openings or try again."));
  const response = result as { token: string };
  if (!/^[a-f0-9]{64}$/.test(response.token)) return fail("Unable to retrieve your booking status. Please contact the business before submitting again.");
  redirect(`/booking/${response.token}`);
}
