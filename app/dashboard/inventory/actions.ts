"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDashboardContext } from "@/lib/auth/context";
import { firstError, formValue } from "@/lib/crm";
import { inventoryItemSchema, movementSchema, recipeSchema, transferSchema } from "@/lib/inventory";
import { inventoryReturnHref, type InventoryActionState } from "@/lib/inventory-workspace";
import { parseMoneyToCentavos } from "@/lib/operations";
import { createClient } from "@/lib/supabase/server";

function saved(data: FormData, message: string): never {
  revalidatePath("/dashboard/inventory");
  let href = "/dashboard/inventory";
  try { href = inventoryReturnHref(formValue(data, "returnTo")); } catch { /* Invalid return URLs fall back to inventory. */ }
  redirect(`${href}${href.includes("?") ? "&" : "?"}message=${encodeURIComponent(message)}`);
}
export async function createInventoryItem(data: FormData): Promise<InventoryActionState> {
  const parsed = inventoryItemSchema.safeParse(Object.fromEntries(["name", "sku", "category", "description", "unit", "cost", "sellPrice", "reorderLevel", "lotNumber", "expiresOn"].map(key => [key, formValue(data, key)])));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { activeMembership } = await getDashboardContext();
  if (!["owner", "manager"].includes(activeMembership.role)) return { error: "Inventory management access required." };
  const cost = parseMoneyToCentavos(parsed.data.cost), sell = parseMoneyToCentavos(parsed.data.sellPrice);
  if (cost === null || sell === null) return { error: "Invalid inventory price." };
  const supabase = await createClient();
  const { error } = await supabase.from("inventory_items").insert({ organization_id: activeMembership.organizationId, branch_id: activeMembership.branchId, name: parsed.data.name, sku: parsed.data.sku || null, category: parsed.data.category || null, description: parsed.data.description || null, unit: parsed.data.unit, cost_centavos: cost, sell_price_centavos: sell, reorder_level: parsed.data.reorderLevel, lot_number: parsed.data.lotNumber || null, expires_on: parsed.data.expiresOn || null });
  if (error) return { error: error.code === "23505" ? "This SKU already exists in the selected branch. Use a different SKU." : "Unable to create inventory item. Please try again." };
  saved(data, "Product created. Record its opening stock to update the balance.");
}
export async function recordMovement(data: FormData): Promise<InventoryActionState> {
  const parsed = movementSchema.safeParse({ itemId: formValue(data, "itemId"), type: formValue(data, "type"), quantity: formValue(data, "quantity"), note: formValue(data, "note"), idempotencyKey: formValue(data, "idempotencyKey") });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { activeMembership } = await getDashboardContext();
  if (!["owner", "manager"].includes(activeMembership.role)) return { error: "Inventory management access required." };
  const supabase = await createClient();
  const { data: item } = await supabase.from("inventory_items").select("id").eq("id", parsed.data.itemId).eq("organization_id", activeMembership.organizationId).eq("branch_id", activeMembership.branchId).maybeSingle();
  if (!item) return { error: "Product unavailable in the selected branch. Close this dialog and refresh inventory." };
  const { error } = await supabase.rpc("record_inventory_movement", { p_item_id: parsed.data.itemId, p_type: parsed.data.type, p_quantity: parsed.data.quantity, p_note: parsed.data.note, p_idempotency_key: parsed.data.idempotencyKey });
  if (error) return { error: "Unable to record this movement. Check the quantity and available stock, then try again." };
  saved(data, "Stock movement recorded.");
}
export async function transferStock(data: FormData): Promise<InventoryActionState> {
  const parsed = transferSchema.safeParse({ sourceItemId: formValue(data, "sourceItemId"), targetItemId: formValue(data, "targetItemId"), quantity: formValue(data, "quantity"), note: formValue(data, "note"), idempotencyKey: formValue(data, "idempotencyKey") });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { activeMembership } = await getDashboardContext();
  if (!["owner", "manager"].includes(activeMembership.role)) return { error: "Inventory management access required." };
  const supabase = await createClient();
  const { data: items } = await supabase.from("inventory_items").select("id,branch_id").eq("organization_id", activeMembership.organizationId).in("id", [parsed.data.sourceItemId, parsed.data.targetItemId]);
  if (items?.length !== 2 || items[0].branch_id === items[1].branch_id) return { error: "Choose accessible products in two different branches." };
  const { error } = await supabase.rpc("transfer_inventory", { p_source_item_id: parsed.data.sourceItemId, p_target_item_id: parsed.data.targetItemId, p_quantity: parsed.data.quantity, p_note: parsed.data.note, p_idempotency_key: parsed.data.idempotencyKey });
  if (error) return { error: "Unable to transfer this stock. Check the matching SKUs, available quantity and branch access, then try again." };
  saved(data, "Stock transferred successfully.");
}
export async function saveRecipe(data: FormData): Promise<InventoryActionState> {
  const parsed = recipeSchema.safeParse({ serviceId: formValue(data, "serviceId"), inventoryItemId: formValue(data, "inventoryItemId"), quantity: formValue(data, "quantity") });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { activeMembership } = await getDashboardContext();
  if (activeMembership.industry === "salon" || !["owner", "manager"].includes(activeMembership.role)) return { error: "Service recipe management is unavailable for this account." };
  const supabase = await createClient();
  const [item, service] = await Promise.all([
    supabase.from("inventory_items").select("id").eq("id", parsed.data.inventoryItemId).eq("organization_id", activeMembership.organizationId).eq("branch_id", activeMembership.branchId).maybeSingle(),
    supabase.from("services").select("id").eq("id", parsed.data.serviceId).eq("organization_id", activeMembership.organizationId).eq("is_active", true).maybeSingle(),
  ]);
  if (!item.data || !service.data) return { error: "Select an active service and a product in the current branch." };
  const { error } = await supabase.from("service_consumables").upsert({ organization_id: activeMembership.organizationId, service_id: parsed.data.serviceId, inventory_item_id: parsed.data.inventoryItemId, quantity: parsed.data.quantity }, { onConflict: "service_id,inventory_item_id" });
  if (error) return { error: "Unable to save service recipe. Please try again." };
  saved(data, "Service recipe saved.");
}
