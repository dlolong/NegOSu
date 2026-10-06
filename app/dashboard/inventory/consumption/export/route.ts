import { requireIndustryFeature } from "@/lib/auth/industry-access";
import { roleHasPermission } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { inventoryReportQuery, inventoryReportRange, type InventoryReport } from "@/lib/inventory-report";
import { inventoryConsumptionCsvHeader, inventoryConsumptionCsvRows } from "@/lib/inventory-report-export";

export async function GET(request: Request) {
  const { activeMembership: m } = await requireIndustryFeature("inventory");
  const headers = { "Cache-Control": "private, no-store" };
  if (!roleHasPermission(m.role, "reports.view")) return new Response("Forbidden", { status: 403, headers });
  const parsed = inventoryReportQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return new Response("Invalid report filters", { status: 400, headers });
  const query = parsed.data, branch = query.branch ?? m.branchId;
  if (branch !== "all" && !m.branches.some(b => b.id === branch)) return new Response("Forbidden", { status: 403, headers });
  const date = query.date ?? new Intl.DateTimeFormat("en-CA", { timeZone: m.timezone }).format(new Date());
  const range = query.start && query.end ? { start: query.start, end: query.end } : inventoryReportRange(query.period, date);
  try {
  const db = await createClient();
  const chunks = ["\uFEFF" + inventoryConsumptionCsvHeader(range.start, range.end)];
  // Bound export work and fail explicitly rather than silently truncating a large report.
  for (let page = 1; page <= 200; page++) {
    const { data, error } = await db.rpc("get_inventory_consumption_report", { p_org: m.organizationId, p_branch: branch === "all" ? null : branch, p_start: range.start, p_end: range.end, p_page: page, p_search: query.q, p_category: query.category });
    const report = data as InventoryReport | null;
    if (error || !report || report.product_daily === undefined) return new Response("Unable to export consumption. Please try again.", { status: 503, headers });
    if (report.count > 10000) return new Response("Too many products. Filter by branch, category or product before exporting.", { status: 422, headers });
    if (report.rows.length) chunks.push(inventoryConsumptionCsvRows(report, range.start, range.end));
    if (page * 50 >= report.count) return new Response(chunks.join("\r\n"), { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="inventory-consumption-${range.start}-${range.end}.csv"` } });
  }
  return new Response("Inventory changed during export. Please try again.", { status: 409, headers });
  } catch {
    return new Response("Unable to export consumption. Please try again.", { status: 503, headers });
  }
}
