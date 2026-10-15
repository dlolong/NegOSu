import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const amount = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const productReportSchema = z.object({
  sales: amount, paid: amount, balance: amount,
  rows: z.array(z.object({
    inventory_item_id: z.uuid(), name: z.string(), unit: z.string(),
    sold: z.number().nonnegative(), sales: amount, included: z.number().nonnegative(),
    handed_over: z.number().nonnegative(), returned: z.number().nonnegative(),
  })),
});
export type ProductReport = z.infer<typeof productReportSchema>;

export function productReportPage(value: unknown) {
  const page = typeof value === "string" ? Number(value) : 1;
  return Number.isFinite(page) ? Math.max(1, Math.min(10000, Math.trunc(page))) : 1;
}

export async function loadProductReport(db: SupabaseClient, branchId: string, page: number): Promise<ProductReport> {
  const { data, error } = await db.rpc("get_checkout_product_report", { p_branch: branchId, p_page: page });
  if (error) throw new Error("Unable to load product sales. Please try again.", { cause: error });
  const parsed = productReportSchema.safeParse(data);
  if (!parsed.success) throw new Error("Unable to load product sales. Please try again.");
  return parsed.data;
}
