import { z } from "zod";
export const creditUsageSchema = z.object({
  remaining: z.number().int().nonnegative(), allowance: z.number().int().nonnegative(), reserved: z.number().int().nonnegative(),
  oneTimeRemaining: z.number().int().nonnegative(), monthlyRemaining: z.number().int().nonnegative(), monthlyAllowance: z.number().int().nonnegative(),
  oneTimeAllowance: z.number().int().nonnegative().optional(), purchasedRemaining: z.number().int().nonnegative().default(0), usedThisPeriod: z.number().int().nonnegative().default(0), periodEnd: z.string().nullable().optional(),
  nextRefresh: z.string().nullable(), periodStart: z.string().nullable(), periodKey: z.string(), status: z.enum(["NORMAL", "LOW", "CRITICAL", "EMPTY"]),
  count: z.number().int().nonnegative().default(0), history: z.array(z.object({ id: z.uuid(), createdAt: z.string(), activity: z.string(), amount: z.number().int(), status: z.string() })).default([]),
});
export type CreditUsage = z.infer<typeof creditUsageSchema>;
export type CreditNotice = { id: string; kind: Exclude<CreditUsage["status"], "NORMAL">; remaining: number; createdAt: string; readAt: string | null; nextRefresh?: string | null; planName?: string };
/** Status is computed by the single database threshold policy, never by a browser balance check. */
export function creditStatusMessage(status: CreditUsage["status"]) {
  return { NORMAL: "Usage credits available", LOW: "Your NegOSu credits are running low", CRITICAL: "You’re almost out of NegOSu credits", EMPTY: "Your usage credits have been used up" }[status];
}
export type CreditOperationCode = "CREDIT_NOT_REQUIRED" | "CREDIT_RESERVED" | "CREDIT_COMMITTED" | "CREDIT_RELEASED" | "CREDIT_REFUNDED" | "INSUFFICIENT_CREDITS" | "FEATURE_NOT_ENTITLED" | "IDEMPOTENCY_CONFLICT" | "CLAIM_INACTIVE";
export const creditOperationResultSchema = z.object({ code: z.enum(["CREDIT_NOT_REQUIRED", "CREDIT_RESERVED", "CREDIT_COMMITTED", "CREDIT_RELEASED", "CREDIT_REFUNDED", "INSUFFICIENT_CREDITS", "FEATURE_NOT_ENTITLED", "IDEMPOTENCY_CONFLICT", "CLAIM_INACTIVE"]), remaining: z.number().optional(), required: z.number().optional() });

/** Display only; numeric allowances come from the database plan catalog. */
export function planCreditLabel(plan: { monthly_credits?: number | null; one_time_credits?: number; credit_grant_policy?: string | null }) {
  if (plan.monthly_credits != null && plan.monthly_credits > 0 && plan.credit_grant_policy) return `${plan.monthly_credits.toLocaleString()} monthly usage credits`;
  if (plan.one_time_credits) return `${plan.one_time_credits.toLocaleString()} one-time starter credits`;
  return null;
}
export function creditRefreshMessage(nextRefresh: string | null | undefined) {
  return nextRefresh ? `Included credits refresh ${new Intl.DateTimeFormat("en-PH", {timeZone:"UTC",dateStyle:"medium"}).format(new Date(nextRefresh))} (UTC).` : "Starter credits do not refresh. Compare plans for monthly usage credits.";
}
