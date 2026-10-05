"use server";
import { publicRequestRateKey } from "@/lib/public-request-protection";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { publicProductOrderSchema, publicOrderError, type PublicProductOrderState } from "@/modules/core/commerce/public-product-orders";
export async function submitProductOrder(_previous: PublicProductOrderState, form: FormData): Promise<PublicProductOrderState> {
  const parsed = publicProductOrderSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the order details." };
  const v = parsed.data, h = await headers(), db = await createClient();
  const rateKey = publicRequestRateKey(h.get("x-forwarded-for"));
  const { data, error } = await db.rpc("submit_public_product_order", {
    p_slug: v.slug, p_product: v.productId, p_quantity: v.quantity, p_request: v.requestKey,
    p_name: v.customerName, p_phone: v.phone, p_email: v.email, p_note: v.note,
    p_rate_key: rateKey, p_honeypot: v.website, p_expected_price: v.expectedPrice,
    p_expected_currency: v.expectedCurrency, p_expected_unit: v.expectedUnit,
  });
  if (error) return { error: publicOrderError(error.code) };
  const result = z.object({ reference: z.uuid() }).safeParse(data);
  if (!result.success) return { error: "Your order status could not be retrieved. Contact the business before submitting again." };
  revalidatePath("/dashboard/products/orders");
  return { reference: result.data.reference };
}
