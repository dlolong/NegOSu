/** Keep list navigation local and omit transient dialog/action state. */
export function listHref(base: string, query: Record<string, string | undefined>, overrides: Record<string, string | undefined> = {}) {
  const params = new URLSearchParams();
  for (const [key,value] of Object.entries({...query,...overrides})) {
    if (value && !["message","error","warning","dialog","requestId","staffId","petId","itemId","resourceId","create","edit","invite","duplicateId"].includes(key)) params.set(key,value);
  }
  return `${base}${params.size ? `?${params}` : ""}`;
}
