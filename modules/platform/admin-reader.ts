import "server-only";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminPageNumber } from "@/modules/platform/admin-access";
import type { ChartPoint } from "@/modules/platform/chart-data";

export const adminSections = {
  signups: "Signups", businesses: "Businesses", subscriptions: "Subscriptions",
  payments: "Payments", events: "Billing events", plans: "Plan catalog",
} as const;
export type AdminSection = keyof typeof adminSections;
export type AdminQuery = { page?: string; q?: string; status?: string; mode?: string; edit?: string };
export type AdminOverview = {
  users: number; businesses: number; activeBusinesses: number; unverifiedUsers: number;
  pastDue: number; reviewOrders: number; webhookErrors: number; collected: number;
  signups: ChartPoint[]; payments: ChartPoint[]; plans: ChartPoint[];
};
export type AdminRow = Record<string, unknown>;
export const statusOptions: Record<AdminSection, string[]> = {
  signups: [], businesses: ["active", "suspended", "closed"],
  subscriptions: ["free", "trialing", "active", "past_due", "cancelled", "paused"],
  payments: ["creating", "pending", "paid", "cancelled", "expired", "review"],
  events: ["processed", "error", "pending"], plans: [],
};

export async function loadAdminOverview(livemode: boolean): Promise<AdminOverview> {
  await requirePlatformAdmin();
  const { data, error } = await createAdminClient().rpc("platform_admin_overview", { p_livemode: livemode });
  if (error || !data) throw new Error("Unable to load platform overview.");
  return data as AdminOverview;
}

export async function loadAdminDirectory(section: AdminSection, query: AdminQuery) {
  // Every reader checks authorization independently of layouts and navigation.
  await requirePlatformAdmin();
  const db = createAdminClient();
  const page = adminPageNumber(query.page);
  const term = typeof query.q === "string" ? query.q.trim().slice(0, 120) : "";
  const status = statusOptions[section].includes(query.status ?? "") ? query.status! : "";
  const livemode = query.mode !== "test";
  if (section === "signups") {
    const { data, error } = await db.rpc("platform_admin_signups", { p_page: page, p_search: term });
    if (error || !data) throw new Error("Unable to load signups.");
    return { rows: data.rows as AdminRow[], total: Number(data.total), page, term, status, livemode };
  }
  const definitions = {
    businesses: ["organizations", "id,name,slug,industry,status,created_at", "created_at"],
    subscriptions: ["organization_subscriptions", "organization_id,plan_id,status,provider,current_period_end,cancel_at_period_end,billing_interval,updated_at,organizations(name)", "created_at"],
    payments: ["billing_orders", "id,organization_id,plan_name,billing_interval,amount_centavos,currency,status,kind,livemode,created_at,paid_at,organizations(name)", "created_at"],
    events: ["billing_webhook_events", "id,provider,event_type,created_at,processed_at,processing_error", "created_at"],
    plans: ["plans", "id,name,monthly_price_centavos,yearly_price_centavos,is_active,is_custom,admin_revision", "sort_order"],
  } as const;
  const [table, projection, order] = definitions[section];
  let request = db.from(table as string).select(projection as string, { count: "exact" });
  if (section === "businesses" && term) request = request.ilike("name", `%${term.replace(/[\\%_]/g, "\\$&")}%`);
  if (section === "payments") request = request.eq("livemode", livemode);
  if (section === "events") {
    if (status === "error") request = request.not("processing_error", "is", null);
    if (status === "processed") request = request.not("processed_at", "is", null).is("processing_error", null);
    if (status === "pending") request = request.is("processed_at", null).is("processing_error", null);
  } else if (status) request = request.eq("status", status);
  const { data, count, error } = await request.order(order, { ascending: section === "plans" })
    .order(section === "subscriptions" ? "organization_id" : "id").range((page - 1) * 25, page * 25 - 1);
  if (error) throw new Error("Unable to load platform records.");
  const rows = (data ?? []) as unknown as AdminRow[];
  const safeRows = section === "events" ? rows.map(row => {
    const { processing_error, ...safe } = row;
    return { ...safe, processing_status: processing_error != null ? "Error" : row.processed_at ? "Processed" : "Pending" };
  }) : rows;
  return { rows: safeRows, total: count ?? 0, page, term, status, livemode };
}

export async function loadAdminPlanOptions() {
  await requirePlatformAdmin();
  const { data, error } = await createAdminClient().from("plans").select("id,name").eq("is_active", true).order("sort_order");
  if (error) throw new Error("Unable to load plans.");
  return data ?? [];
}
