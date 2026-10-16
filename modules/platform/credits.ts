import { z } from "zod";
export const creditUsageSchema = z.object({
  remaining: z.number().int().nonnegative(), allowance: z.number().int().nonnegative(), reserved: z.number().int().nonnegative(),
  oneTimeRemaining: z.number().int().nonnegative(), monthlyRemaining: z.number().int().nonnegative(), monthlyAllowance: z.number().int().nonnegative(),
  nextRefresh: z.string().nullable(), periodStart: z.string().nullable(), periodKey: z.string(), status: z.enum(["NORMAL", "LOW", "CRITICAL", "EMPTY"]),
  count: z.number().int().nonnegative().default(0), history: z.array(z.object({ id: z.uuid(), createdAt: z.string(), activity: z.string(), amount: z.number().int(), status: z.string() })).default([]),
});
export type CreditUsage = z.infer<typeof creditUsageSchema>;
export type CreditNotice = { id: string; kind: Exclude<CreditUsage["status"], "NORMAL">; remaining: number; createdAt: string; readAt: string | null };
/** Status is computed by the single database threshold policy, never by a browser balance check. */
export function creditStatusMessage(status: CreditUsage["status"]) {
  return { NORMAL: "Usage credits available", LOW: "Your NegOSu credits are running low", CRITICAL: "You’re almost out of NegOSu credits", EMPTY: "Your usage credits have been used up" }[status];
}
export type CreditOperationCode = "CREDIT_NOT_REQUIRED" | "CREDIT_RESERVED" | "CREDIT_COMMITTED" | "CREDIT_RELEASED" | "CREDIT_REFUNDED" | "INSUFFICIENT_CREDITS" | "FEATURE_NOT_ENTITLED" | "IDEMPOTENCY_CONFLICT" | "CLAIM_INACTIVE";
export const creditOperationResultSchema = z.object({ code: z.enum(["CREDIT_NOT_REQUIRED", "CREDIT_RESERVED", "CREDIT_COMMITTED", "CREDIT_RELEASED", "CREDIT_REFUNDED", "INSUFFICIENT_CREDITS", "FEATURE_NOT_ENTITLED", "IDEMPOTENCY_CONFLICT", "CLAIM_INACTIVE"]), remaining: z.number().optional(), required: z.number().optional() });
