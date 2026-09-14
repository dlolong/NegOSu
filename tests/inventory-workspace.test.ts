import assert from "node:assert/strict";
import test from "node:test";
import { filterInventory, inventoryHref, inventoryPage, inventoryReturnHref, matchingTransferTargets, stockStatus, type InventoryStock } from "../lib/inventory-workspace";
import { inventoryItemSchema } from "../lib/inventory";
const base: InventoryStock = { id: "a", branch_id: "main", name: "Cleaning solution", sku: "CLEAN", category: "Supplies", unit: "L", quantity_on_hand: 5, reorder_level: 5, valuation_centavos: 10000 };
const stock = [base, { ...base, id: "b", name: "Brush", sku: "BRUSH", quantity_on_hand: 0 }, { ...base, id: "c", name: "Towel", sku: null, category: null, quantity_on_hand: 20 }];
test("stock statuses distinguish zero, reorder threshold and healthy stock", () => {
  assert.deepEqual(stock.map(stockStatus), ["low", "out", "healthy"]);
  assert.equal(stockStatus({ ...base, quantity_on_hand: "-0.001" }), "out");
  assert.equal(stockStatus({ ...base, quantity_on_hand: "5.001" }), "healthy");
});
test("inventory searches names, SKU and category and combines status filters", () => {
  assert.deepEqual(filterInventory(stock, { q: " cLeAn " }).map(item => item.id), ["a"]);
  assert.deepEqual(filterInventory(stock, { q: "supplies", status: "out", category: "Supplies" }).map(item => item.id), ["b"]);
  assert.equal(filterInventory(stock, { q: "missing" }).length, 0);
  assert.equal(filterInventory(stock, {}).length, 3);
});
test("inventory pagination bounds invalid and stale page requests", () => {
  assert.deepEqual(inventoryPage(stock, "2", 2).rows.map(item => item.id), ["c"]);
  for (const value of ["-1", "NaN", "1.5", "Infinity"]) assert.equal(inventoryPage(stock, value).page, 1);
  assert.equal(inventoryPage([], "999").page, 1);
  assert.equal(inventoryPage(stock, "999", 2).page, 2);
});
test("transfer choices match SKU without case sensitivity and exclude the source branch", () => {
  const targets = [base, { ...base, id: "other", branch_id: "east", sku: "clean" }, { ...base, id: "wrong", branch_id: "east", sku: "OTHER" }];
  assert.deepEqual(matchingTransferTargets(base, targets).map(item => item.id), ["other"]);
  assert.deepEqual(matchingTransferTargets(undefined, targets), []);
});
test("inventory return URLs preserve filters and discard dialogs or external redirects", () => {
  assert.equal(inventoryReturnHref(inventoryHref({ q: "A & B", status: "low", dialog: "create", itemId: "unsafe" })), "/dashboard/inventory?q=A+%26+B&status=low");
  for (const value of ["https://evil.test/dashboard/inventory", "//evil.test", "/dashboard/services"]) assert.equal(inventoryReturnHref(value), "/dashboard/inventory");
});
test("product expiry accepts real dates or omission and rejects impossible dates", () => {
  const item = { name: "Soap", sku: "", category: "", description: "", unit: "unit", cost: "0", sellPrice: "0", reorderLevel: 0, lotNumber: "" };
  for (const expiresOn of ["", "2028-02-29"]) assert.equal(inventoryItemSchema.safeParse({ ...item, expiresOn }).success, true);
  for (const expiresOn of ["2026-02-30", "tomorrow"]) assert.equal(inventoryItemSchema.safeParse({ ...item, expiresOn }).success, false);
});
