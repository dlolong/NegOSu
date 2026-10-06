"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { inquirySchema, type InquiryState } from "@/modules/platform/inquiries";

export async function submitInquiry(_previous: InquiryState, form: FormData): Promise<InquiryState> {
  const parsed = inquirySchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Enter your name, a valid email, a subject (3–160 characters), and a message (10–5,000 characters)." };
  const value = parsed.data;
  try {
    const { error } = await createAdminClient().rpc("submit_platform_inquiry", {
      p_id: value.id, p_name: value.name, p_email: value.email, p_subject: value.subject, p_message: value.message,
    });
    if (error) return { error: error.code === "P0001" ? "Please wait before sending another inquiry. Leave at least a minute between messages; hourly limits may require waiting up to an hour." : "We couldn’t send your inquiry. Please try again." };
    return { success: true };
  } catch { return { error: "Inquiries are temporarily unavailable. Please try again later." }; }
}
