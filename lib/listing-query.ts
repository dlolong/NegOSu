/** Literal ILIKE search: wildcard and PostgREST filter syntax must not expand user input. */
export function listingSearch(value?: string) { return (value ?? "").trim().slice(0, 120); }
export function listingPattern(value?: string) { return `%${listingSearch(value).replace(/[\\%_]/g, "\\$&")}%`; }
export function listingDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0,10) === value ? value : undefined;
}
export function listingDateEnd(value?: string) {
  const date = listingDate(value);
  return date ? new Date(Date.parse(`${date}T00:00:00Z`) + 86400000).toISOString() : undefined;
}
export function listingOrSearch(columns: readonly string[], value?: string) {
  return columns.filter(column => /^[a-z_][a-z0-9_]*$/.test(column)).map(column => `${column}.ilike.${JSON.stringify(listingPattern(value))}`).join(",");
}
