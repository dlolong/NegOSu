import { listingSearch, listingPattern, listingDate, listingDateEnd } from "@/lib/listing-query";
import type { SupabaseClient } from "@supabase/supabase-js";
export const PRODUCT_HISTORY_SIZE = 20;
export type ProductHistoryTab = "usage" | "purchases" | "stock";
export function productHistoryTab(value?: string): ProductHistoryTab {
  return value === "purchases" || value === "stock" ? value : "usage";
}
export type ProductMovement = { id: string; movement_type: string; quantity_delta: number; note: string | null; created_at: string };
export type ProductPurchase = {
  id: string; checkout_id: string; name: string; unit: string; quantity: number; line_total_centavos: number;
  handed_over: number; returned: number; included_key: string | null; promo_name: string | null; created_at: string;
  checkouts: { customer_name: string; customer_id: string | null; organization_id: string; branch_id: string };
  invoices: { status: string; issued_at: string | null } | null;
};
/** Session client and explicit tenant/branch filters preserve the existing RLS boundaries. */
export function loadProductHistory(db: SupabaseClient, scope: { organizationId: string; branchId: string }, productId: string, tab: ProductHistoryTab, page: number, filters: {q?:string;from?:string;to?:string} = {}) {
  const offset = (page - 1) * PRODUCT_HISTORY_SIZE;
  if (tab === "purchases") {
    let request = db.from("checkout_lines")
    .select("id,checkout_id,name,unit,quantity,line_total_centavos,handed_over,returned,included_key,promo_name,created_at,checkouts!inner(customer_name,customer_id,organization_id,branch_id),invoices(status,issued_at)")
    .eq("inventory_item_id", productId).eq("checkouts.organization_id", scope.organizationId).eq("checkouts.branch_id", scope.branchId)
    .is("removed_at", null).or("invoice_id.not.is.null,and(included_key.not.is.null,handed_over.gt.0)")
;
    if (listingSearch(filters.q)) request = request.ilike("checkouts.customer_name", listingPattern(filters.q));
    if (listingDate(filters.from)) request = request.gte("created_at", `${listingDate(filters.from)}T00:00:00Z`);
    if (listingDateEnd(filters.to)) request = request.lt("created_at", listingDateEnd(filters.to)!);
    return request.order("created_at", { ascending: false }).order("id").range(offset, offset + PRODUCT_HISTORY_SIZE);
  }
  let request = db.from("inventory_movements").select("id,movement_type,quantity_delta,note,created_at")
    .eq("organization_id", scope.organizationId).eq("branch_id", scope.branchId).eq("inventory_item_id", productId)
    .in("movement_type", tab === "stock" ? ["purchase"] : ["usage", "consume", "waste", "return"])
;
  if (listingSearch(filters.q)) request = request.ilike("note", listingPattern(filters.q));
  if (listingDate(filters.from)) request = request.gte("created_at", `${listingDate(filters.from)}T00:00:00Z`);
  if (listingDateEnd(filters.to)) request = request.lt("created_at", listingDateEnd(filters.to)!);
  return request.order("created_at", { ascending: false }).order("id").range(offset, offset + PRODUCT_HISTORY_SIZE);
}
