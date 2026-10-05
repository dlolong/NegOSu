import { z } from "zod";
export type ClientDetailTab = "history" | "products" | "reminders";
export function clientDetailTab(query: { tab?: string; productsPage?: string; remindersPage?: string; q?: string; from?: string; to?: string }): ClientDetailTab {
  if (query.tab === "history" || query.tab === "products" || query.tab === "reminders") return query.tab;
  if (query.tab) return "history";
  // Keep previously shared history links working.
  if (query.productsPage || query.q || query.from || query.to) return "products";
  if (query.remindersPage) return "reminders";
  return "history";
}

export function reminderReturnPath(origin: unknown, customerId: unknown) {
  return origin === "client" && z.uuid().safeParse(customerId).success
    ? `/dashboard/customers/${customerId}?tab=reminders`
    : "/dashboard/customers/reminders";
}
