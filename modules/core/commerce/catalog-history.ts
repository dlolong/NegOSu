import type { SupabaseClient } from "@supabase/supabase-js";
import { listingDate, listingDateEnd, listingPattern, listingSearch } from "@/lib/listing-query";
export const CATALOG_HISTORY_SIZE = 20;
export type CatalogHistoryKind = "service" | "promo";
export type CatalogHistoryTab = "usage" | "purchases";
export function catalogHistoryTab(value?: string): CatalogHistoryTab { return value === "purchases" ? value : "usage"; }
/** Filter parent records before pagination; multi-service promos never duplicate visits/payments. */
export function loadCatalogHistory(db: SupabaseClient, scope: { organizationId: string; branchId: string; industry: string }, kind: CatalogHistoryKind, id: string, tab: CatalogHistoryTab, page: number, filters: { q?: string; from?: string; to?: string } = {}) {
  const relation = kind === "promo" ? "appointment_promo_snapshots" : "appointment_services", key = kind === "promo" ? "promo_id" : "service_id";
  const customers = `customers${listingSearch(filters.q) ? "!inner" : ""}(full_name)`;
  const automotive = tab === "purchases" && scope.industry === "automotive";
  const table = tab === "usage" ? "appointments" : automotive ? kind === "service" ? "invoice_items" : "invoices" : "payments";
  const fields: string = tab === "usage" ? `id,starts_at,created_at,status,${customers},${relation}!inner(${key})` : automotive ? kind === "service"
    ? "id,invoice_id,description_snapshot,line_total_centavos,invoices!inner(job_order_id,organization_id,branch_id,customer_name_snapshot,status,issued_at,created_at)"
    : "id,job_order_id,customer_name_snapshot,total_centavos,status,issued_at,created_at,job_orders!inner(organization_id,branch_id,appointments!inner(organization_id,branch_id,appointment_promo_snapshots!inner(promo_id)))"
    : `id,amount_centavos,currency,paid_at,created_at,status,appointments!inner(id,organization_id,branch_id,${customers},${relation}!inner(${key}))`;
  let request = db.from(table).select(fields).eq("organization_id", scope.organizationId);
  let nameColumn = "customers.full_name", dateColumn = "starts_at", orderColumn = "starts_at";
  if (tab === "usage") request = request.eq("branch_id", scope.branchId).eq(`${relation}.${key}`, id);
  else if (automotive && kind === "service") {
    request = request.eq("service_id", id).eq("invoices.organization_id", scope.organizationId).eq("invoices.branch_id", scope.branchId).neq("invoices.status", "draft");
    nameColumn = "invoices.customer_name_snapshot"; dateColumn = "invoices.issued_at"; orderColumn = "invoices(issued_at)";
  } else if (automotive) {
    request = request.eq("branch_id", scope.branchId).eq("job_orders.organization_id", scope.organizationId).eq("job_orders.branch_id", scope.branchId).eq("job_orders.appointments.organization_id", scope.organizationId).eq("job_orders.appointments.branch_id", scope.branchId).eq("job_orders.appointments.appointment_promo_snapshots.promo_id", id).neq("status", "draft");
    nameColumn = "customer_name_snapshot"; dateColumn = orderColumn = "issued_at";
  } else {
    request = request.eq("branch_id", scope.branchId).eq("appointments.organization_id", scope.organizationId).eq("appointments.branch_id", scope.branchId).eq(`appointments.${relation}.${key}`, id).in("status", ["paid", "refunded", "voided"]);
    nameColumn = "appointments.customers.full_name"; dateColumn = orderColumn = "paid_at";
  }
  if (listingSearch(filters.q)) request = request.ilike(nameColumn, listingPattern(filters.q));
  if (listingDate(filters.from)) request = request.gte(dateColumn, `${listingDate(filters.from)}T00:00:00Z`);
  if (listingDateEnd(filters.to)) request = request.lt(dateColumn, listingDateEnd(filters.to)!);
  const offset = (page - 1) * CATALOG_HISTORY_SIZE;
  return request.order(orderColumn, { ascending: false, nullsFirst: false }).order("id").range(offset, offset + CATALOG_HISTORY_SIZE);
}
