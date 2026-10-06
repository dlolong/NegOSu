import type { SupabaseClient } from "@supabase/supabase-js";

/** Batch enrichment for existing report/view contracts; source RLS remains authoritative. */
export async function withProductPhotos<T extends { id: string }>(db: SupabaseClient, organizationId: string, rows: T[]): Promise<Array<T & { thumbnail_url: string | null }>> {
  const photos = new Map<string, string | null>();
  for (let offset = 0; offset < rows.length; offset += 200) {
    const { data } = await db.from("inventory_items").select("id,thumbnail_url").eq("organization_id", organizationId).in("id", rows.slice(offset, offset + 200).map(row => row.id));
    for (const row of data ?? []) photos.set(row.id, row.thumbnail_url);
  }
  return rows.map(row => ({ ...row, thumbnail_url: photos.get(row.id) ?? null }));
}
