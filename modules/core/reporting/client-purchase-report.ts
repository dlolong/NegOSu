import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { reportQuerySchema, resolveReportRange } from "@/lib/reporting";

export const clientPurchaseQuerySchema = reportQuerySchema.extend({
  q: z.string().trim().max(120).default(""),
  item: z.string().trim().max(120).default(""),
  kind: z.enum(["all", "service", "product", "other"]).default("all"),
  page: z.coerce.number().int().min(1).max(100000).default(1),
}).superRefine((input, ctx) => {
  if (input.preset === "custom" && (!input.start || !input.end || input.start > input.end || Date.parse(input.end) - Date.parse(input.start) > 731 * 86400000)) {
    ctx.addIssue({ code: "custom", message: "Choose both dates in order, covering no more than 732 days." });
  }
});
export type ClientPurchaseFilters = z.infer<typeof clientPurchaseQuerySchema>;
const money = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const clientPurchaseReportSchema = z.object({
  count: z.number().int().nonnegative(),
  summary: z.object({ records: z.number().int().nonnegative(), total: money, paid: money, balance: money }),
  rows: z.array(z.object({
    key: z.string(), clientId: z.uuid().nullable(), name: z.string(), lastActivity: z.iso.date(),
    records: z.number().int().nonnegative(), branches: z.array(z.string()), total: money, paid: money, balance: money,
    staff: z.array(z.object({ id: z.uuid(), name: z.string() })),
    items: z.array(z.object({ kind: z.enum(["service", "product", "other"]), name: z.string(), quantity: z.number().nonnegative(), unit: z.string(), included: z.boolean() })),
  })),
});
export type ClientPurchaseReport = z.infer<typeof clientPurchaseReportSchema>;

export async function loadClientPurchaseReport(db: SupabaseClient, membership: { organizationId: string; timezone: string; branches: readonly { id: string }[] }, filters: ClientPurchaseFilters) {
  if (filters.branch !== "all" && !membership.branches.some(branch => branch.id === filters.branch)) throw new Error("Branch access required.");
  const range = resolveReportRange(filters, membership.timezone);
  const { data, error } = await db.rpc("get_client_purchase_report", {
    p_organization_id: membership.organizationId, p_start_date: range.start, p_end_date: range.end,
    p_branch_id: filters.branch === "all" ? null : filters.branch, p_client_search: filters.q,
    p_item_search: filters.item, p_kind: filters.kind, p_page: filters.page,
  });
  const parsed = clientPurchaseReportSchema.safeParse(data);
  if (error || !parsed.success) throw new Error("Unable to load client purchases. Please try again.", { cause: error ?? parsed.error });
  return { report: parsed.data, range };
}
