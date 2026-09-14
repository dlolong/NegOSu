import { InventoryWorkspace } from "@/components/inventory-workspace";
import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import type { InventoryQuery } from "@/lib/inventory-workspace";

export default async function Page({ searchParams }: { searchParams: Promise<InventoryQuery> }) {
  const [query, { activeMembership }, supabase] = await Promise.all([searchParams, getDashboardContext(), createClient()]);
  const salon = activeMembership.industry === "salon";
  const canManage = ["owner", "manager"].includes(activeMembership.role);
  const [stock, movements, branches, services] = await Promise.all([
    supabase.from("inventory_stock").select("id,branch_id,name,sku,category,unit,description,lot_number,expires_on,quantity_on_hand,reorder_level,valuation_centavos").eq("organization_id", activeMembership.organizationId).order("low_stock", { ascending: false }).order("name"),
    supabase.from("inventory_movements").select("id,inventory_item_id,movement_type,quantity_delta,note,created_at,inventory_items(name,unit)").eq("organization_id", activeMembership.organizationId).eq("branch_id", activeMembership.branchId).order("created_at", { ascending: false }).limit(30),
    supabase.from("branches").select("id,name").eq("organization_id", activeMembership.organizationId).eq("is_active", true),
    salon || !canManage ? Promise.resolve({ data: [], error: null }) : supabase.from("services").select("id,name").eq("organization_id", activeMembership.organizationId).eq("is_active", true).order("name"),
  ]);
  const loadError = [stock, movements, branches, services].some(result => result.error) ? "Unable to load inventory. Try again to see current stock and movements." : undefined;
  return <InventoryWorkspace stock={stock.data ?? []} movements={(movements.data ?? []).map(movement => {
    const item = Array.isArray(movement.inventory_items) ? movement.inventory_items[0] : movement.inventory_items;
    return { id: movement.id, itemId: movement.inventory_item_id, name: item?.name ?? "Inventory item", unit: item?.unit ?? "", type: movement.movement_type, quantity: movement.quantity_delta, note: movement.note, createdAt: movement.created_at };
  })} branches={branches.data ?? []} services={services.data ?? []} branchId={activeMembership.branchId} branchName={activeMembership.branchName} salon={salon} canManage={canManage} query={query} loadError={loadError} timezone={activeMembership.timezone}/>;
}
