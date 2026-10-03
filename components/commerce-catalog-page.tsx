import {FormMessage} from "@/components/form-message";
import {RemoveRecordButton} from "@/components/remove-record-button";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/operations";
import { CompactFilters } from "@/components/compact-filters";
import { FormDialog } from "@/components/management-ui";
import { PageHeader } from "@/components/page-patterns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { ProductCatalogForm, PromoCatalogForm, type CatalogProduct, type CatalogPromo } from "@/components/commerce-catalog-forms";

export type CommerceCatalogQuery = { message?: string; q?: string; page?: string; dialog?: string; id?: string };
export async function CommerceCatalogPage({ kind, query }: { kind: "products" | "promos"; query: CommerceCatalogQuery }) {
  const { activeMembership: m } = await getDashboardContext();
  if (!["owner", "manager"].includes(m.role) || !["automotive", "salon", "pet_care", "hospitality"].includes(m.industry)) notFound();
  const db = await createClient();
  const page = Math.min(10000, Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1));
  const href = `/dashboard/${kind}`;
  const columns = kind === "products" ? "id,name,sku,description,category,unit,sell_price_centavos,product_purpose,stock_tracked,is_active,is_public,thumbnail_url" : "id,name,description,image_url,is_public,price_centavos,status,version,valid_from,valid_through,components";
  let listing = db.from(kind === "products" ? "inventory_items" : "commerce_promos").select(columns, { count: "exact" }).eq("organization_id", m.organizationId).eq("branch_id", m.branchId);
  if (query.q) listing = listing.ilike("name", `%${query.q.slice(0, 120)}%`);
  const result = await listing.order("name").order("id").range((page - 1) * 30, page * 30 - 1);
  const rows = (result.data ?? []) as unknown as (CatalogProduct & CatalogPromo)[];
  const selected = query.id ? await db.from(kind === "products" ? "inventory_items" : "commerce_promos").select(columns).eq("organization_id", m.organizationId).eq("branch_id", m.branchId).eq("id", query.id).maybeSingle() : null;
  const row = selected?.data as unknown as CatalogProduct & CatalogPromo | undefined;
  const open = !result.error && query.dialog === "edit" && (!query.id || Boolean(row));
  // Read all eligible choices: no silent first-page truncation of product/service selectors.
  const products: CatalogProduct[] = [], services: { id: string; name: string }[] = [];
  let choicesError = false;
  if (open && kind === "promos") {
    for (const source of ["inventory_items", "services"] as const) {
      for (let offset = 0; ; offset += 1000) {
        let load = db.from(source).select(source === "services" ? "id,name" : "id,name,sku,description,category,unit,sell_price_centavos,product_purpose,stock_tracked,is_active,is_public,thumbnail_url").eq("organization_id", m.organizationId).eq("is_active", true);
        if (source === "inventory_items") load = load.eq("branch_id", m.branchId);
        const values = await load.order("id").range(offset, offset + 999);
        if (values.error) { choicesError = true; break; }
        if (source === "services") services.push(...values.data as unknown as typeof services);
        else products.push(...values.data as unknown as CatalogProduct[]);
        if (values.data.length < 1000) break;
      }
    }
  }
  return <main id={`${kind}-catalog-page`} className="mx-auto min-w-0 max-w-6xl">
    <PageHeader id={`${kind}-catalog-header`} title={kind === "products" ? "Products" : "Promos"} description={`${m.branchName} · ${kind === "products" ? "Manage products and selling details. Stock movements stay in Inventory." : "Compose fixed-price offers from services and products."}`} action={!result.error ? <Button asChild><Link id={`${kind}-add`} href={`${href}?dialog=edit`}>Add {kind === "products" ? "product" : "promo"}</Link></Button> : undefined}/>
    <FormMessage message={query.message}/>
    {kind === "promos" ? <p id="promo-integration-status" className="my-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">Active service promos can be selected for new appointments. Enable “Show on public website” to let clients request them online. Booking includes the fixed promo price; product use or handover is recorded separately in Inventory. Walk-ins, maintenance bookings, job estimates, and stays do not yet support promo selection.</p> : null}
    <Tabs id="commerce-catalog-navigation" ariaLabel="Catalog and stock" items={[{ id: "commerce-products-tab", label: "Products", href: "/dashboard/products" }, { id: "commerce-promos-tab", label: "Promos", href: "/dashboard/promos" }, { id: "commerce-inventory-tab", label: "Inventory", href: "/dashboard/inventory" }]}/>
    {kind === "products" ? <Button asChild variant="secondary" className="my-3"><Link id="product-new-sale-button" href="/dashboard/checkout/new">New sale</Link></Button> : null}
    <CompactFilters id={`${kind}-catalog-filters`} action={href} searchValue={query.q} searchLabel={`Search ${kind}`} search={<Input id={`${kind}-search`} name="q" defaultValue={query.q} placeholder={`Search ${kind}`} aria-label={`Search ${kind}`}/>}/>
    {result.error ? <p role="alert" className="mt-4 rounded-xl border p-4">Unable to load this catalog. Please try again after catalog setup is available.</p> : <>
      <div className="mt-4 hidden overflow-x-auto rounded-xl border border-admin-border md:block"><table className="w-full text-left text-sm"><thead><tr className="bg-admin-surface-muted"><th className="p-3">Name</th><th className="p-3">{kind === "products" ? "Purpose / counted by" : "Included components"}</th><th className="p-3">Price</th><th className="p-3">Status</th><th className="p-3">Action</th></tr></thead><tbody>{rows.map(item => <tr key={item.id} className="border-t border-admin-border"><td className="p-3">{item.name}</td><td className="p-3">{kind === "products" ? `${item.product_purpose} · ${item.unit}` : `${item.components.length} components · v${item.version}`}</td><td className="p-3">{formatMoney(kind === "products" ? item.sell_price_centavos ?? 0 : item.price_centavos, m.currency)}</td><td className="p-3">{kind === "products" ? `${item.is_active ? "Active" : "Inactive"} · ${item.is_public && item.is_active && item.product_purpose !== "internal" ? "Public" : "Private"}` : item.status}</td><td className="p-3"><Link id={`${kind}-desktop-edit-${item.id}`} className="inline-flex min-h-11 items-center text-brand-primary underline" href={`${href}?dialog=edit&id=${item.id}`}>Edit<span className="sr-only"> {item.name}</span></Link></td></tr>)}</tbody></table></div>
      <div className="mt-4 grid gap-3 md:hidden">{rows.map(item => <article key={item.id} className="min-w-0 rounded-xl border border-admin-border bg-white p-4"><h2 className="font-medium [overflow-wrap:anywhere]">{item.name}</h2><p className="text-sm">{formatMoney(kind === "products" ? item.sell_price_centavos ?? 0 : item.price_centavos, m.currency)} · {kind === "products" ? `${item.unit} · ${item.is_active ? "Active" : "Inactive"} · ${item.is_public && item.is_active && item.product_purpose !== "internal" ? "Public" : "Private"}` : item.status}</p><Link id={`${kind}-mobile-edit-${item.id}`} className="inline-flex min-h-11 items-center text-brand-primary underline" href={`${href}?dialog=edit&id=${item.id}`}>Edit<span className="sr-only"> {item.name}</span></Link></article>)}</div>
      {!rows.length ? <p className="py-8 text-center text-sm">No {kind} found in this branch.</p> : null}
      <nav aria-label="Catalog pages" className="mt-4 flex items-center justify-between gap-3">{page > 1 ? <Link id={`${kind}-previous`} href={`${href}?page=${page - 1}&q=${encodeURIComponent(query.q ?? "")}`}>Previous</Link> : <span/>}<span className="text-sm">Page {page}</span>{page * 30 < (result.count ?? 0) ? <Link id={`${kind}-next`} href={`${href}?page=${page + 1}&q=${encodeURIComponent(query.q ?? "")}`}>Next</Link> : <span/>}</nav>
    </>}
    {open ? <FormDialog id={`${kind}-catalog-dialog`} title={`${row ? "Edit" : "Add"} ${kind === "products" ? "product" : "promo"}`} closeHref={href}>{choicesError ? <p role="alert">Unable to load components. Close and try again.</p> : kind === "products" ? <ProductCatalogForm requestKey={randomUUID()} product={row} currency={m.currency}/> : <PromoCatalogForm requestKey={randomUUID()} promo={row} products={products} services={services} hospitality={m.industry === "hospitality"} currency={m.currency}/>}{row?<RemoveRecordButton kind={kind === "products" ? "product" : "promo"} recordId={row.id} name={row.name}/>:null}</FormDialog> : null}
    {query.id && !row ? <p role="alert" className="mt-3">The selected record is unavailable in this branch.</p> : null}
  </main>;
}
