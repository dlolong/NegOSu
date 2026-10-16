import { z } from "zod";

const money = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const rateSchema = z.object({ priceCentavos: money, finalCentavos: money.optional(), currency: z.string().regex(/^[A-Z]{3}$/), label: z.string(), durationMinutes: z.number().int().positive() });
const arrivalSchema = z.object({ tendered: money, deposit: money.optional().default(0), method: z.enum(["cash", "gcash", "maya", "bank_transfer", "card", "other"]), receipt: z.string().nullish(), reference: z.string().nullish() });

// Only persisted arrival snapshots belong on this receipt, never the current bill total.
export function checkInReceiptAmounts(rateInput: unknown, arrivalInput: unknown) {
  const rate = rateSchema.safeParse(rateInput);
  const arrival = arrivalSchema.safeParse(arrivalInput);
  if (!rate.success || !arrival.success) return null;
  const payment = rate.data.finalCentavos ?? rate.data.priceCentavos;
  const total = payment + arrival.data.deposit;
  const change = arrival.data.tendered - total;
  if (!Number.isSafeInteger(total) || change < 0 || (arrival.data.method !== "cash" && change !== 0)) return null;
  return { ...arrival.data, currency: rate.data.currency, label: rate.data.label, durationMinutes: rate.data.durationMinutes, payment, total, change };
}
export type CheckInReceiptAmounts = NonNullable<ReturnType<typeof checkInReceiptAmounts>>;
