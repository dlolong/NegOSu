"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/modules/platform/admin-access";
import { parseAdminMutation, adminMutationError } from "@/modules/platform/admin-mutations";

export async function mutatePlatformRecord(_previous: { error?: string; success?: boolean }, formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const actor = await requirePlatformAdmin();
  const parsed = parseAdminMutation(Object.fromEntries(formData));
  if ("error" in parsed) return { error: parsed.error };
  const { input, values } = parsed;
  if (input.action === "delete_user" && (input.target === actor.id || isPlatformAdmin(input.target, process.env.PLATFORM_ADMIN_USER_IDS))) return { error: "Platform administrators cannot be deleted here. Remove their admin access before deleting another admin account." };
  try {
    const { error } = await createAdminClient().rpc("platform_admin_mutate", {
      p_actor: actor.id, p_request: input.requestId, p_action: input.action, p_target: input.target,
      p_expected: input.expected, p_values: values, p_reason: input.reason, p_confirmation: input.confirmation,
    });
    if (error) return { error: adminMutationError(error) };
  } catch { return { error: "The change could not be confirmed. Retry this form to safely check the same request." }; }
  revalidatePath("/admin", "layout");
  revalidatePath("/dashboard", "layout");
  if (input.action === "update_plan") { revalidatePath("/plans"); revalidatePath("/"); }
  return { success: true };
}
