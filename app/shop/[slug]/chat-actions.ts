"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { reportActionError } from "@/lib/errors/action-error";
import { publicChatSchema, type ChatResult, type ChatSnapshot } from "@/modules/core/chat/contracts";

export async function customerChat(input: unknown): Promise<ChatResult> {
  const parsed = publicChatSchema.safeParse(input);
  if (!parsed.success) return { error: "Enter your name and a message of up to 300 characters." };
  const data = parsed.data;
  try {
    const db = createAdminClient();
    const h = await headers();
    const fingerprint = createHash("sha256").update(`${h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local"}|${h.get("user-agent") ?? "unknown"}`).digest("hex");
    const result = data.operation === "read"
      ? await db.rpc("read_customer_chat", { p_slug: data.slug, p_token: data.token })
      : await db.rpc("send_customer_chat", { p_slug: data.slug, p_token: data.token, p_request_id: data.requestId, p_body: data.body,
        ...(data.operation === "start" ? { p_branch_id: data.branchId, p_customer_name: data.customerName, p_visitor_hash: fingerprint } : {}) });
    if (result.error) {
      if (result.error.code === "P0002") return { error: "This conversation is unavailable or has expired. You can still book an appointment or contact the business.", unavailable: true };
      if (result.error.code === "P0003") return { error: "This conversation is closed or its message limit has been reached. Continue to booking or contact the business." };
      reportActionError("customer_chat." + data.operation, result.error, "Chat could not be loaded.");
      return { error: "Chat is temporarily unavailable. Please try again or continue to booking." };
    }
    return { data: result.data as ChatSnapshot };
  } catch (error) {
    reportActionError("customer_chat." + data.operation, error, "Chat unavailable.");
    return { error: "Chat is temporarily unavailable. Please try again or continue to booking." };
  }
}
