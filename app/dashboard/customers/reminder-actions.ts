"use server";

import { reminderReturnPath } from "@/lib/client-detail-navigation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { reminderInstant, reminderSchema } from "@/modules/core/crm/client-reminders";

function finish(path: string, error?: string): never {
  revalidatePath("/dashboard/customers", "layout");
  redirect(`${path}${path.includes("?") ? "&" : "?"}${error ? "error" : "message"}=${encodeURIComponent(error ?? "Reminder saved.")}`);
}
export async function createReminder(form: FormData) {
  const { activeMembership } = await getDashboardContext();
  const parsed = reminderSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) finish(reminderReturnPath("client", form.get("customerId")), "Enter a reason, branch, and valid reminder date and time.");
  const v = parsed.data, path = `/dashboard/customers/${v.customerId}?tab=reminders`;
  if (!["owner", "manager", "advisor"].includes(activeMembership.role)) finish(path, "You have read-only access.");
  const db = await createClient();
  const { data: branch } = await db.from("branches").select("timezone").eq("id", v.branchId).eq("organization_id", activeMembership.organizationId).eq("is_active", true).maybeSingle();
  if (!branch) finish(path, "Select an accessible branch.");
  const instant = reminderInstant(v.dueAt, branch.timezone);
  if (!instant) finish(path, "Enter a valid time in the branch timezone.");
  const { data: customer } = await db.from("customers").select("id").eq("id", v.customerId).eq("organization_id", activeMembership.organizationId).eq("is_archived", false).maybeSingle();
  if (!customer) finish(path, "Select an active client.");
  const { error } = await db.rpc("create_client_reminder", { p_id: v.id, p_branch: v.branchId, p_customer: v.customerId, p_reason: v.reason, p_due: instant });
  finish(path, error ? "Unable to save reminder. Check access and try again." : undefined);
}
export async function resolveReminder(form: FormData) {
  const { activeMembership } = await getDashboardContext();
  const parsed = z.object({ id: z.uuid(), status: z.enum(["contacted", "cancelled"]) }).safeParse(Object.fromEntries(form));
  let path = "/dashboard/customers/reminders";
  if (!parsed.success || !["owner", "manager", "advisor"].includes(activeMembership.role)) finish(path, "Unable to update reminder.");
  const db = await createClient();
  const { data: reminder } = await db.from("client_reminders").select("id,customer_id").eq("id", parsed.data.id).eq("organization_id", activeMembership.organizationId).maybeSingle();
  if (!reminder) finish(path, "Reminder unavailable.");
  path = reminderReturnPath(form.get("origin"), reminder.customer_id);
  const { error } = await db.rpc("resolve_client_reminder", { p_id: parsed.data.id, p_status: parsed.data.status });
  finish(path, error ? "Reminder could not be updated. It may already be resolved." : undefined);
}
