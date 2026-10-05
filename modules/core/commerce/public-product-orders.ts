import { z } from "zod";
import { quantityThousandths } from "@/modules/core/commerce/quantity";
export const publicProductOrderSchema = z.object({
  slug: z.string().max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  productId: z.uuid(), requestKey: z.uuid(),
  quantity: z.string().refine(value => { try { return quantityThousandths(value) <= 1_000_000n; } catch { return false; } }, "Enter a quantity above zero and up to 1,000, with at most three decimal places."),
  customerName: z.string().trim().min(2, "Enter your full name.").max(120),
  phone: z.string().trim().min(7).max(30).refine(value => /^\+?[\d ()-]+$/.test(value) && value.replace(/\D/g, "").length >= 7 && value.replace(/\D/g, "").length <= 15, "Enter a valid phone number."),
  email: z.union([z.literal(""), z.email().max(254)]),
  note: z.string().trim().max(1000), website: z.string().max(0),
  expectedPrice: z.coerce.number().int().min(0).max(10_000_000_000),
  expectedCurrency: z.string().length(3), expectedUnit: z.string().min(1).max(30),
});
export type PublicProductOrderState = { error?: string; reference?: string };
export function publicOrderError(code?: string) {
  if (code === "P0409") return "A recent order for this product is already pending. Please wait for confirmation or contact the business to change your order.";
  if (code === "40001") return "The product price changed. Refresh this page and review the latest price before ordering.";
  if (code === "54000") return "Too many order requests. Please try again later or contact the business.";
  return "Unable to submit this order. The product may be unavailable. Please try again or contact the business.";
}
