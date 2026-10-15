/** Explicit sections keep existing overview/revenue/team and hospitality links usable. */
export function resolveReportsView(query: Record<string, string | string[] | undefined>): "clients" | "overview" {
  if (query.view === "clients") return "clients";
  return query.view === "overview" || typeof query.section === "string" ? "overview" : "clients";
}
