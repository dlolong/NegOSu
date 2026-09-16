"use server";
import { revalidatePath } from "next/cache";
import { getDashboardContext } from "@/lib/auth/context";
import { roleHasPermission } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { reportActionError } from "@/lib/errors/action-error";
import { staffChatSchema } from "@/modules/core/chat/contracts";

export async function manageChat(input: unknown): Promise<{ error?: string }> {
  const parsed = staffChatSchema.safeParse(input);
  if (!parsed.success) return { error: "Enter a reply of up to 1,000 characters." };
  const { activeMembership } = await getDashboardContext();
  if (!roleHasPermission(activeMembership.role, "appointments.manage")) return { error: "You do not have access to this inbox." };
  const db = await createClient();
  const { data: conversation, error: readError } = await db.from("customer_conversations").select("id").eq("id", parsed.data.id).eq("organization_id", activeMembership.organizationId).eq("branch_id", activeMembership.branchId).maybeSingle();
  if (readError || !conversation) return { error: "This conversation is unavailable in the current branch." };
  const value = parsed.data;
  const { error } = await db.rpc("manage_customer_chat", { p_id: value.id, p_operation: value.operation, ...(value.operation === "reply" ? { p_request_id: value.requestId, p_body: value.body } : {}) });
  if (error) return { error: error.code === "P0003" ? "The conversation is closed, expired, or has reached its reply limit." : reportActionError("customer_chat.staff", error, "The change could not be saved. Please try again.") };
  revalidatePath("/dashboard/inbox");
  return {};
}
