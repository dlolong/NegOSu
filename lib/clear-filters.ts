/** Remove only this form's filters; keep tabs and other navigation context. */
export function clearFiltersHref(url: string, names: string[]): string | null {
 const current = new URL(url, "http://localhost");
 const active = names.some(name => current.searchParams.getAll(name).some(value => value.trim() !== "" && value !== "all"));
 if (!active) return null;
 for (const name of names) current.searchParams.delete(name);
 current.searchParams.delete("page");
 return current.pathname + (current.searchParams.size ? `?${current.searchParams}` : "") + current.hash;
}
