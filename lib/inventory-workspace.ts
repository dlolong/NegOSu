export type InventoryStock = {
  id: string; branch_id: string; name: string; sku: string | null; category: string | null; unit: string;
  description?: string | null; lot_number?: string | null; expires_on?: string | null;
  quantity_on_hand: number | string; reorder_level: number | string; valuation_centavos: number | string;
};
export type InventoryMovement = { id: string; itemId?: string; name: string; unit: string; type: string; quantity: number | string; note: string | null; createdAt: string };
export type InventoryQuery = { q?: string; category?: string; status?: string; view?: string; page?: string; dialog?: string; itemId?: string; message?: string; error?: string };
export type InventoryActionState = { error?: string };
export function stockStatus(item: InventoryStock) {
  return Number(item.quantity_on_hand) <= 0 ? "out" : Number(item.quantity_on_hand) <= Number(item.reorder_level) ? "low" : "healthy";
}
export const stockStatusLabels = { out: "Out of stock", low: "Low stock", healthy: "In stock" };
export function filterInventory(stock: InventoryStock[], query: InventoryQuery) {
  const search = (query.q ?? "").trim().toLocaleLowerCase();
  return stock.filter(item => (!search || [item.name, item.sku, item.category].some(value => value?.toLocaleLowerCase().includes(search)))
    && (!query.category || (item.category ?? "") === query.category)
    && (!query.status || query.status === "all" || stockStatus(item) === query.status));
}
export function inventoryHref(query: InventoryQuery = {}) {
  const params = new URLSearchParams();
  for (const key of ["q", "category", "status", "view", "page", "dialog", "itemId"] as const) {
    if (query[key]) params.set(key, query[key]);
  }
  return `/dashboard/inventory${params.size ? `?${params}` : ""}`;
}
// Keep mutation navigation within inventory and discard dialog/error parameters.
export function inventoryReturnHref(value: string) {
  const url = new URL(value, "https://inventory.invalid");
  if (url.origin !== "https://inventory.invalid" || url.pathname !== "/dashboard/inventory") return inventoryHref();
  return inventoryHref(Object.fromEntries(["q", "category", "status", "view", "page"].map(key => [key, url.searchParams.get(key) ?? ""])));
}
export function matchingTransferTargets(source: InventoryStock | undefined, stock: InventoryStock[]) {
  if (!source) return [];
  return stock.filter(item => item.branch_id !== source.branch_id && (item.sku ?? "").toLowerCase() === (source.sku ?? "").toLowerCase());
}
export function inventoryPage<T>(rows: T[], pageInput?: string, size = 20) {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const requested = Number(pageInput);
  const page = Number.isSafeInteger(requested) ? Math.min(pages, Math.max(1, requested)) : 1;
  return { rows: rows.slice((page - 1) * size, page * size), page, pages };
}
