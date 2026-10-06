import { z } from "zod";
export const inventoryReportQuery = z.object({
  view: z.enum(["cards", "daily", "overview"]).default("cards"),
  period: z.enum(["day", "week", "month", "year"]).default("month"),
  date: z.preprocess(value => typeof value === "string" && /^\d{4}-\d{2}$/.test(value) ? `${value}-01` : value, z.iso.date().optional()),
  category: z.string().trim().max(80).default(""),
  q: z.string().trim().max(120).default(""),
  start: z.iso.date().optional(),
  end: z.iso.date().optional(),
  branch: z.union([z.literal("all"), z.uuid()]).optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
}).superRefine((value, context) => {
  if (Boolean(value.start) !== Boolean(value.end) || (value.start && value.end && (value.start > value.end || (Date.parse(value.end) - Date.parse(value.start)) / 86400000 > 366))) {
    context.addIssue({ code: "custom", message: "Choose both dates in order, no more than 367 days apart." });
  }
});
export function inventoryReportDays(start: string, end: string) {
  const first = Date.parse(start);
  return Array.from({ length: Math.max(0, Math.min(367, Math.round((Date.parse(end) - first) / 86400000) + 1)) }, (_, index) => new Date(first + index * 86400000).toISOString().slice(0, 10));
}
export function inventoryReportRange(period: "day" | "week" | "month" | "year", date: string) {
  const start = new Date(`${date}T12:00:00Z`);
  if (period === "week") start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
  if (period === "month") start.setUTCDate(1);
  if (period === "year") start.setUTCMonth(0, 1);
  const end = new Date(start);
  if (period === "day") end.setUTCDate(end.getUTCDate() + 1);
  if (period === "week") end.setUTCDate(end.getUTCDate() + 7);
  if (period === "month") end.setUTCMonth(end.getUTCMonth() + 1);
  if (period === "year") end.setUTCFullYear(end.getUTCFullYear() + 1);
  end.setUTCDate(end.getUTCDate() - 1);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}
export type InventoryReportRow = {
  thumbnail_url?: string | null; id: string; name: string; category?: string; branch_name: string; unit: string; stock_tracked: boolean;
  opening: number; received: number; consumed: number; waste: number; other: number; closing: number;
};
export type InventoryReport = {
  categories?: string[];
  count: number; rows: InventoryReportRow[];
  product_daily?: Array<{ inventory_item_id: string; day: string; consumed: number }>;
  daily?: Array<{ day: string; unit: string; consumed: number }>;
  totals: Array<Omit<InventoryReportRow, "id" | "name" | "branch_name" | "stock_tracked">>;
};

export function inventoryMonthlyConsumption(report: InventoryReport, start: string, end: string) {
  const months = [...new Set(inventoryReportDays(start, end).map(day => day.slice(0, 7)))];
  const totals = new Map<string, number>();
  for (const row of report.product_daily ?? []) {
    if (row.day < start || row.day > end) continue;
    const key = `${row.inventory_item_id}:${row.day.slice(0, 7)}`;
    totals.set(key, (totals.get(key) ?? 0) + Number(row.consumed));
  }
  return report.rows.map(product => ({ product, months: months.map(month => ({ month, consumed: product.stock_tracked ? totals.get(`${product.id}:${month}`) ?? 0 : null })) }));
}
