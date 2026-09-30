"use server";
import { revalidatePath } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { respondAlternativeSchema } from "@/modules/core/scheduling/booking-alternatives";

export async function respondToAlternative(_previous: {error?:string}, data: FormData): Promise<{error?:string}> {
  const parsed=respondAlternativeSchema.safeParse(Object.fromEntries(data));
  if(!parsed.success)return {error:"Invalid response. Refresh your booking page."};
  const {error}=await createPublicClient().rpc("respond_booking_alternative",{p_token:parsed.data.token,p_version:parsed.data.version,p_action:parsed.data.action});
  if(error)return {error:error.code==="40001"?"The business updated this offer. Refresh to see the latest suggestion.":"Unable to respond. The time or staff may no longer be available. Refresh or contact the business."};
  revalidatePath(`/booking/${parsed.data.token}`);revalidatePath("/dashboard/bookings");
  return {};
}
