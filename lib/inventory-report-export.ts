import { inventoryReportDays, type InventoryReport } from "./inventory-report";
import { csvCell } from "./reporting";

export function inventoryConsumptionCsvRows(report: InventoryReport, start: string, end: string) {
  const days = inventoryReportDays(start, end);
  const usage = new Map(report.product_daily?.map(row => [`${row.inventory_item_id}:${row.day}`, row.consumed]));
  return report.rows.map(row => [row.id, row.name, row.category || "Uncategorized", row.branch_name, row.unit, row.stock_tracked ? "Yes" : "No", start, end,
    ...[row.opening, row.received, row.consumed, row.waste, row.other, row.closing].map(value => row.stock_tracked ? value : ""),
    ...days.map(day => row.stock_tracked ? usage.get(`${row.id}:${day}`) ?? 0 : ""),
  ].map(csvCell).join(",")).join("\r\n");
}
export function inventoryConsumptionCsvHeader(start: string, end: string) {
  return ["Product ID", "Product", "Category", "Branch", "Unit", "Stock tracked", "From", "To", "Opening", "Stock in", "Consumed", "Waste", "Other net", "Closing", ...inventoryReportDays(start, end)].map(csvCell).join(",");
}
