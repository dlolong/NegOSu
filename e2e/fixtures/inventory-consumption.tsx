import React from "react";
import { createRoot } from "react-dom/client";
import { InventoryConsumptionCards } from "@/components/inventory-consumption-cards";
import { InventoryConsumptionMatrix } from "@/components/inventory-consumption-matrix";
const report = { count: 2, rows: [
  { id: "soap", name: "Soap", category: "Supplies", branch_name: "Main", unit: "L", stock_tracked: true, opening: 5, received: 0, consumed: 1.75, waste: 0, other: 0, closing: 3.25 },
  { id: "nonstock", name: "Non-stock product", category: "Supplies", branch_name: "East", unit: "piece", stock_tracked: false, opening: 0, received: 0, consumed: 0, waste: 0, other: 0, closing: 0 },
], totals: [], product_daily: [{ inventory_item_id: "soap", day: "2026-09-30", consumed: 1.25 }, { inventory_item_id: "soap", day: "2026-10-01", consumed: 0.5 }] };
const query = new URLSearchParams(location.search);
if (query.has("empty")) report.rows = [];
createRoot(document.getElementById("root")!).render(query.has("daily") ? <InventoryConsumptionMatrix report={report} start="2026-09-30" end="2026-10-02"/> : <InventoryConsumptionCards report={report} start="2026-09-30" end="2026-10-02"/>);
