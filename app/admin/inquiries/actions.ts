"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function closeInquiry(form: FormData) {
  await requirePlatformAdmin();
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) redirect("/admin/inquiries?error=Invalid%20inquiry.");
  const { data, error } = await createAdminClient().from("platform_inquiries").update({ status: "closed" }).eq("id", id.data).select("id").maybeSingle();
  if (error || !data) redirect("/admin/inquiries?error=Unable%20to%20close%20inquiry.");
  revalidatePath("/admin/inquiries");
  redirect("/admin/inquiries?message=Inquiry%20closed.");
}
