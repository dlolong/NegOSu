import { z } from "zod";

export const customerMessageLimit = 3;
export const customerMessageLength = 300;
export const chatTokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100);
export const publicChatSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("start"), slug, token: chatTokenSchema, branchId: z.uuid(), customerName: z.string().trim().min(2).max(80), body: z.string().trim().min(1).max(customerMessageLength), requestId: z.uuid() }),
  z.object({ operation: z.literal("send"), slug, token: chatTokenSchema, body: z.string().trim().min(1).max(customerMessageLength), requestId: z.uuid() }),
  z.object({ operation: z.literal("read"), slug, token: chatTokenSchema }),
]);
export const staffChatSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("reply"), id: z.uuid(), body: z.string().trim().min(1).max(1000), requestId: z.uuid() }),
  z.object({ operation: z.literal("close"), id: z.uuid() }),
  z.object({ operation: z.literal("reopen"), id: z.uuid() }),
]);
export type ChatMessage = { id: string; sender: "customer" | "staff"; body: string; createdAt: string };
export type ChatSnapshot = { status: "open" | "closed"; branchId: string; customerName: string; remaining: number; expiresAt: string; messages: ChatMessage[] };
export type ChatResult = { data?: ChatSnapshot; error?: string; unavailable?: boolean };
export const chatStorageKey = (slug: string) => `negosu-chat:${slug}`;

export function chatBookingNote(snapshot: ChatSnapshot) {
  const messages = snapshot.messages.filter(message => message.sender === "customer").slice(0, customerMessageLimit).map(message => message.body.slice(0, customerMessageLength));
  return messages.length ? `Website chat:\n${messages.join("\n")}` : "";
}
