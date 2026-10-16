/** Bounded, memory-only choices for one mounted control and authorization scope. */
export function createLookupCache<T>(ttlMs = 30_000, maxEntries = 20, now = Date.now) {
  const entries = new Map<string, { value: T; expires: number }>();
  return {
    get(key: string): T | undefined {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (entry.expires <= now()) { entries.delete(key); return undefined; }
      return entry.value;
    },
    set(key: string, value: T) {
      entries.delete(key);
      entries.set(key, { value, expires: now() + ttlMs });
      if (entries.size > maxEntries) entries.delete(entries.keys().next().value!);
    },
  };
}
