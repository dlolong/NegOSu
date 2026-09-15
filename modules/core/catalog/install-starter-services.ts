import type { SupabaseClient } from "@supabase/supabase-js";
import { hasStarterCatalog, starterServices } from "./starter-services";

type CatalogActor = { organizationId: string; role: string };
export type StarterCatalogResult = { added: number; error?: string };

/** Additive, retry-safe catalog installation through existing tenant RLS and unique keys. */
export async function installStarterServices(db: SupabaseClient, actor: CatalogActor): Promise<StarterCatalogResult> {
  if (!["owner", "manager"].includes(actor.role)) return { added: 0, error: "Owner or manager access is required." };
  const organization = await db.from("organizations").select("industry,currency").eq("id", actor.organizationId).single();
  if (organization.error || !organization.data || !hasStarterCatalog(organization.data.industry)) return { added: 0, error: "This workspace does not have a starter catalog." };
  if (organization.data.currency !== "PHP") return { added: 0, error: "Starter prices are in PHP. Add services with your workspace's currency instead." };
  const templates = starterServices[organization.data.industry];
  const names = [...new Set(templates.map(service => service.category))];
  const categories = await db.from("service_categories").upsert(names.map(name => ({ organization_id: actor.organizationId, name, is_active: true })), { onConflict: "organization_id,name", ignoreDuplicates: true });
  if (categories.error) return { added: 0, error: "Unable to add service categories. Please try again." };
  const loaded = await db.from("service_categories").select("id,name,is_active").eq("organization_id", actor.organizationId).in("name", names);
  if (loaded.error) return { added: 0, error: "Unable to load service categories. Please try again." };
  const existing = await db.from("services").select("name").eq("organization_id", actor.organizationId);
  if (existing.error) return { added: 0, error: "Unable to load existing services. Please try again." };
  const normalize = (name: string) => name.trim().toLowerCase();
  const existingNames = new Set((existing.data ?? []).map(service => normalize(service.name)));
  const additions = templates.filter(service => !existingNames.has(normalize(service.name)));
  if (!additions.length) return { added: 0 };
  const result = await db.from("services").upsert(additions.map(service => ({
    organization_id: actor.organizationId, name: service.name,
    category_id: loaded.data?.find(category => category.name === service.category && category.is_active)?.id ?? null,
    duration_minutes: service.durationMinutes, base_price_centavos: service.priceCentavos,
    currency: "PHP", is_active: true, is_public: false, is_add_on: false,
    short_description: "Starter service — review pricing and duration before use.",
  })), { onConflict: "organization_id,name", ignoreDuplicates: true }).select("id");
  return result.error ? { added: 0, error: "Unable to add starter services. Please try again; existing services will be preserved." } : { added: result.data?.length ?? 0 };
}
