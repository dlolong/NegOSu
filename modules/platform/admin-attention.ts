import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrganizationMembership } from "@/lib/auth/context";
import { roleHasPermission } from "@/lib/rbac";
import { automotiveActiveJobStatuses } from "@/modules/automotive/command-center/automotive-command-center";

export type AttentionKind = "messages" | "bookings" | "appointments" | "stock" | "jobs";
export type AttentionItem = { id: AttentionKind; title: string; description: string; count: number; href: string };
export type AttentionSnapshot = {
  organizationId: string; branchId: string; branchName: string;
  items: AttentionItem[]; total: number; unavailable: string[]; updatedAt: string;
};
type Membership = Pick<OrganizationMembership, "organizationId" | "branchId" | "branchName" | "role" | "industry">;
type CountResult = { count: number | null; error: unknown; data?: { id: string }[] | null };

/** The caller supplies server-resolved membership; every query also uses RLS. */
export async function loadAdminAttention(db: SupabaseClient, membership: Membership, now = new Date()): Promise<AttentionSnapshot> {
  const { organizationId, branchId, branchName, role, industry } = membership;
  const sources: { item: Omit<AttentionItem, "count">; query: PromiseLike<CountResult>; recordHref?: string }[] = [];
  const count = (table: string) => db.from(table).select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("branch_id", branchId);
  if (roleHasPermission(role, "appointments.manage")) {
    sources.push({ item: { id: "messages", title: "Messages need a reply", description: "Reply to customers in the inbox.", href: "/dashboard/inbox?tab=needs_reply" }, query: count("customer_conversations").eq("status", "open").eq("needs_reply", true).gt("expires_at", now.toISOString()) });
    sources.push({ item: { id: "bookings", title: "Booking requests to review", description: "Confirm or decline online requests.", href: "/dashboard/bookings?status=requested" }, query: count("public_booking_requests").eq("status", "requested") });
    sources.push({ item: { id: "appointments", title: "Appointments to confirm", description: "Open the next appointment awaiting confirmation.", href: industry === "pet_care" ? "/dashboard/pet-care/appointments?status=requested" : "/dashboard/appointments?status=requested" },
      query: db.from("appointments").select("id", { count: "exact" }).eq("organization_id", organizationId).eq("branch_id", branchId).eq("status", "requested").order("starts_at").limit(1),
      recordHref: industry === "pet_care" ? "/dashboard/pet-care/appointments/" : "/dashboard/appointments/" });
  }
  if (industry === "automotive" && roleHasPermission(role, "jobs.manage")) sources.push({ item: { id: "jobs", title: "Jobs past their promised time", description: "Review the oldest overdue job.", href: "/dashboard/jobs" },
    query: db.from("job_orders").select("id", { count: "exact" }).eq("organization_id", organizationId).eq("branch_id", branchId).in("status", [...automotiveActiveJobStatuses]).lt("promised_at", now.toISOString()).order("promised_at").limit(1), recordHref: "/dashboard/jobs/" });
  if (roleHasPermission(role, "inventory.manage")) sources.push({ item: { id: "stock", title: "Stock needs replenishing", description: "Review low-stock and out-of-stock items.", href: "/dashboard/inventory" }, query: count("inventory_stock").eq("low_stock", true) });

  const results = await Promise.allSettled(sources.map(source => source.query));
  const items: AttentionItem[] = [], unavailable: string[] = [];
  results.forEach((result, index) => {
    const source = sources[index];
    if (result.status === "rejected" || result.value.error || result.value.count === null) { unavailable.push(source.item.title); return; }
    const total = result.value.count;
    if (total > 0) {
      const recordId = result.value.data?.[0]?.id;
      items.push({ ...source.item, count: total, href: source.recordHref && recordId ? `${source.recordHref}${encodeURIComponent(recordId)}` : source.item.href });
    }
  });
  return { organizationId, branchId, branchName, items, total: items.reduce((sum, item) => sum + item.count, 0), unavailable, updatedAt: now.toISOString() };
}
