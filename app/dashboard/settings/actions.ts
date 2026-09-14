"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDashboardContext } from "@/lib/auth/context";
import { roleHasPermission } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { businessLogoUrlSchema } from "@/modules/platform/business-branding";

import { requireAuthenticatedUser } from "@/lib/auth/context";
import { firstIssue, profileSchema } from "@/lib/auth/schemas";
import { isDashboardTheme } from "@/modules/platform/dashboard-theme";

function value(formData: FormData, key: string) {
  const submitted = formData.get(key);
  return typeof submitted === "string" ? submitted : "";
}

export async function updateProfile(formData: FormData) {
  const parsed = profileSchema.safeParse({ fullName: value(formData, "fullName"), phone: value(formData, "phone") });
  if (!parsed.success) redirect(`/dashboard/settings?error=${encodeURIComponent(firstIssue(parsed.error))}`);

  const { supabase, user } = await requireAuthenticatedUser("/dashboard/settings");
  const { error } = await supabase.from("profiles").update({ full_name: parsed.data.fullName, phone: parsed.data.phone || null }).eq("id", user.id);
  if (error) redirect("/dashboard/settings?error=Unable+to+update+your+profile.");
  redirect("/dashboard/settings?message=Profile+updated.");
}

export async function updateDashboardTheme(formData: FormData) {
  const theme = value(formData, "dashboardTheme");
  if (!isDashboardTheme(theme)) redirect("/dashboard/settings?error=Select+a+valid+color+theme.");

  const { supabase } = await requireAuthenticatedUser("/dashboard/settings");
  const { error } = await supabase.auth.updateUser({ data: { dashboard_theme: theme } });
  if (error) redirect("/dashboard/settings?error=Unable+to+update+your+color+theme.");
  redirect("/dashboard/settings?message=Color+theme+updated.");
}

export async function updateBusinessBranding(formData: FormData) {
  const { activeMembership } = await getDashboardContext();
  if (!roleHasPermission(activeMembership.role, "settings.manage")) redirect("/dashboard/settings?error=Settings+access+required.");
  const parsed = businessLogoUrlSchema.safeParse(value(formData, "logoUrl"));
  if (!parsed.success) redirect(`/dashboard/settings?error=${encodeURIComponent(firstIssue(parsed.error))}`);
  const supabase = await createClient();
  const { data, error } = await supabase.from("organizations")
    .update({ logo_url: parsed.data || null })
    .eq("id", activeMembership.organizationId).select("id").maybeSingle();
  if (error || !data) redirect("/dashboard/settings?error=Unable+to+save+your+business+logo.");
  revalidatePath("/dashboard", "layout");
  revalidatePath("/organizations");
  revalidatePath("/onboarding/setup");
  revalidatePath(`/shop/${activeMembership.organizationSlug}`, "layout");
  redirect("/dashboard/settings?message=Business+logo+updated.");
}
