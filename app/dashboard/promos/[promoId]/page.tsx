import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/operations";
import { PageHeader } from "@/components/page-patterns";
import { CatalogHistory } from "@/components/catalog-history";
import { ServiceThumbnail } from "@/components/service-thumbnail";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { PromoComponent } from "@/modules/core/commerce/promos";

export default async function Page({ params, searchParams }: { params: Promise<{ promoId: string }>; searchParams: Promise<{ q?: string; from?: string; to?: string; tab?: string; page?: string }> }) {
  const [{ promoId }, query, { activeMembership: m }, db] = await Promise.all([params, searchParams, getDashboardContext(), createClient()]);
  if (!z.uuid().safeParse(promoId).success || !["owner", "manager"].includes(m.role) || !["automotive", "salon", "pet_care", "hospitality"].includes(m.industry)) notFound();
  const { data: promo, error } = await db.from("commerce_promos").select("id,name,description,image_url,is_public,price_centavos,currency,status,version,valid_from,valid_through,components").eq("organization_id", m.organizationId).eq("branch_id", m.branchId).eq("id", promoId).maybeSingle();
  const back = <Button asChild variant="ghost"><Link id="promo-detail-back" href="/dashboard/promos">Back to Promos</Link></Button>;
  if (error) return <main><PageHeader id="promo-detail-error-header" title="Promo details" back={back}/><p role="alert">Promo details could not be loaded. Please try again.</p></main>;
  if (!promo) notFound();
  const components = promo.components as PromoComponent[];
  const serviceIds = components.filter(c => c.kind === "service" && c.referenceId).map(c => c.referenceId!);
  const productIds = components.filter(c => ["product", "supply"].includes(c.kind) && c.referenceId).map(c => c.referenceId!);
  const [services, products, branch] = await Promise.all([
    serviceIds.length ? db.from("services").select("id,name").eq("organization_id", m.organizationId).in("id", serviceIds) : Promise.resolve({ data: [], error: null }),
    productIds.length ? db.from("inventory_items").select("id,name").eq("organization_id", m.organizationId).eq("branch_id", m.branchId).in("id", productIds) : Promise.resolve({ data: [], error: null }),
    db.from("branches").select("timezone").eq("organization_id", m.organizationId).eq("id", m.branchId).maybeSingle(),
  ]);
  const names = new Map([...(services.data ?? []), ...(products.data ?? [])].map(row => [row.id, row.name]));
  return <main id="promo-detail-page" className="mx-auto min-w-0 max-w-5xl [overflow-wrap:anywhere]">
    <PageHeader id="promo-detail-header" title={promo.name} description={m.branchName} back={back} action={<Button asChild variant="secondary"><Link id="promo-detail-edit" href={`/dashboard/promos?dialog=edit&id=${promo.id}`}>Edit promo</Link></Button>}/>
    <Card id="promo-details" className="mt-4 grid gap-4 p-4 sm:grid-cols-2">
      <ServiceThumbnail id="promo-detail-photo" name={promo.name} url={promo.image_url} subject="promo"/>
      <div><dl className="grid gap-3 text-sm">{[["Price", formatMoney(promo.price_centavos, promo.currency)], ["Status", promo.status], ["Website", promo.is_public ? "Public" : "Private"], ["Version", String(promo.version)], ["Valid from", promo.valid_from ?? "No start date"], ["Valid through", promo.valid_through ?? "No end date"]].map(([label, value]) => <div key={label}><dt className="text-admin-text-secondary">{label}</dt><dd className="font-medium">{value}</dd></div>)}</dl><p className="mt-4 whitespace-pre-wrap text-sm">{promo.description || "No description."}</p></div>
    </Card>
    <Card id="promo-components" className="mt-4 p-4"><h2 className="font-medium">Included services and products</h2>{services.error || products.error ? <p role="alert">Some component names could not be loaded.</p> : null}<ul className="mt-3 space-y-2 text-sm">{components.map((component, index) => <li key={`${component.kind}-${index}`}><span className="capitalize">{component.kind}</span> · {component.kind === "accommodation" ? "Agreed accommodation" : names.get(component.referenceId!) ?? "Unavailable component"} · {component.quantity} {component.unit}</li>)}</ul></Card>
    {m.industry === "hospitality" ? <p className="mt-4 text-sm">Stay bookings do not currently record promo selections, so promo history is not available for accommodation offers.</p> : <CatalogHistory db={db} scope={m} kind="promo" recordId={promoId} query={query} timezone={branch.data?.timezone ?? m.timezone}/>}
  </main>;
}
