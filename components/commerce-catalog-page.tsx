import { CatalogItemThumbnail } from "@/components/catalog-item-thumbnail";
import { colorStatusText } from "@/components/status-text";
import { RecordRow, RecordItem, RecordLink } from "@/components/record-item";
import {FormMessage} from "@/components/form-message";
import {RemoveRecordButton} from "@/components/remove-record-button";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/operations";
import { ListingFilters } from "@/components/listing-filters";
import { listingPattern } from "@/lib/listing-query";
import { FormDialog } from "@/components/management-ui";
import { PageHeader } from "@/components/page-patterns";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { ProductCatalogForm, PromoCatalogForm, type CatalogProduct, type CatalogPromo } from "@/components/commerce-catalog-forms";

export type CommerceCatalogQuery = { message?: string; q?: string; status?: string; page?: string; dialog?: string; id?: string };
export async function CommerceCatalogPage({ kind, query }: { kind: "products" | "promos"; query: CommerceCatalogQuery }) {
  const { activeMembership: m } = await getDashboardContext();
  if (!["owner", "manager"].includes(m.role) || !["automotive", "salon", "pet_care", "hospitality"].includes(m.industry)) notFound();
  const db = await createClient();
  const page = Math.min(10000, Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1));
  const href = `/dashboard/${kind}`;
  const columns = kind === "products" ? "id,name,sku,description,category,unit,sell_price_centavos,product_purpose,stock_tracked,is_active,is_public,thumbnail_url" : "id,name,description,image_url,is_public,price_centavos,status,version,valid_from,valid_through,components";
  let listing = db.from(kind === "products" ? "inventory_items" : "commerce_promos").select(columns, { count: "exact" }).eq("organization_id", m.organizationId).eq("branch_id", m.branchId);
  if (query.q) listing = listing.ilike("name", listingPattern(query.q));
  if (kind === "products" && ["active", "inactive"].includes(query.status ?? "")) listing = listing.eq("is_active", query.status === "active");
  if (kind === "promos" && ["draft", "active", "archived"].includes(query.status ?? "")) listing = listing.eq("status", query.status!);
  const result = await listing.order("name").order("id").range((page - 1) * 30, page * 30 - 1);
  const rows = (result.data ?? []) as unknown as (CatalogProduct & CatalogPromo)[];
  const selected = query.id ? await db.from(kind === "products" ? "inventory_items" : "commerce_promos").select(columns).eq("organization_id", m.organizationId).eq("branch_id", m.branchId).eq("id", query.id).maybeSingle() : null;
  const row = selected?.data as unknown as CatalogProduct & CatalogPromo | undefined;
  const open = !result.error && query.dialog === "edit" && (!query.id || Boolean(row));
  // Read all eligible choices: no silent first-page truncation of product/service selectors.
  const products: CatalogProduct[] = [], services: { id: string; name: string; thumbnail_url?: string | null }[] = [];
  let choicesError = false;
  if (open && kind === "promos") {
    for (const source of ["inventory_items", "services"] as const) {
      for (let offset = 0; ; offset += 1000) {
        let load = db.from(source).select(source === "services" ? "id,name,thumbnail_url" : "id,name,sku,description,category,unit,sell_price_centavos,product_purpose,stock_tracked,is_active,is_public,thumbnail_url").eq("organization_id", m.organizationId).eq("is_active", true);
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
    <PageHeader id={`${kind}-catalog-header`} title={kind === "products" ? "Products" : "Promos"} description={`${kind === "products" ? "Manage products and selling details. Stock movements stay in Inventory." : "Compose fixed-price offers from services and products."}`} action={!result.error ? <Button asChild><Link id={`${kind}-add`} href={`${href}?dialog=edit`}>Add {kind === "products" ? "product" : "promo"}</Link></Button> : undefined}/>
    <FormMessage message={query.message}/>
    {kind === "promos" ? <p id="promo-integration-status" className="my-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">Active service promos can be selected for new appointments. Enable “Show on public website” to let clients request them online. Booking includes the fixed promo price; product use or handover is recorded separately in Inventory. Walk-ins, maintenance bookings, job estimates, and stays do not yet support promo selection.</p> : null}
    <Tabs id="commerce-catalog-navigation" ariaLabel="Catalog and stock" items={[{ id: "commerce-products-tab", label: "Products", href: "/dashboard/products" }, { id: "commerce-promos-tab", label: "Promos", href: "/dashboard/promos" }, { id: "commerce-inventory-tab", label: "Inventory", href: "/dashboard/inventory" }]}/>
    {kind === "products" ? <Button asChild variant="secondary" className="my-3"><Link id="product-new-sale-button" href="/dashboard/checkout/new">New sale</Link></Button> : null}
    {kind === "products" ? <Button asChild variant="secondary" className="my-3 ml-2"><Link id="product-public-orders-button" href="/dashboard/products/orders">Public orders</Link></Button> : null}
    <ListingFilters searchId={`${kind}-search`} id={`${kind}-catalog-filters`} action={href} query={query} searchLabel={`Search ${kind}`} options={[{value:"all",label:"All statuses"}, ...(kind === "products" ? [{value:"active",label:"Active"},{value:"inactive",label:"Inactive"}] : [{value:"draft",label:"Draft"},{value:"active",label:"Active"},{value:"archived",label:"Archived"}])]}/>
    {result.error ? <p role="alert" className="mt-4 rounded-xl border p-4">Unable to load this catalog. Please try again after catalog setup is available.</p> : <>
      <div className="mt-4 hidden overflow-x-auto rounded-xl border border-admin-border md:block"><table className="w-full text-left text-sm"><thead><tr className="bg-admin-surface-muted"><th className="p-3">Name</th><th className="p-3">{kind === "products" ? "Purpose / counted by" : "Included components"}</th><th className="p-3">Price</th><th className="p-3">Status</th></tr></thead><tbody>{rows.map(item => <RecordRow id={`${kind}-row-${item.id}`} key={item.id} className="border-t border-admin-border"><td className="p-3"><div className="flex min-w-0 items-center gap-3"><CatalogItemThumbnail id={`${kind}-photo-${item.id}`} url={kind === "products" ? item.thumbnail_url : item.image_url} name={item.name} subject={kind === "products" ? "product" : "promo"}/><div className="min-w-0"><RecordLink id={`${kind}-open-${item.id}`} href={`${href}/${item.id}`}>{item.name}</RecordLink>{kind === "products" ? <small className="mt-1 block text-admin-text-secondary">{item.category || "Uncategorized"}</small> : null}</div></div></td><td className="p-3">{kind === "products" ? `${item.product_purpose} · ${item.unit}` : `${item.components.length} components · v${item.version}`}</td><td className="p-3">{formatMoney(kind === "products" ? item.sell_price_centavos ?? 0 : item.price_centavos, m.currency)}</td><td className="p-3">{colorStatusText(kind === "products" ? `${item.is_active ? "Active" : "Inactive"} · ${item.is_public && item.is_active && item.product_purpose !== "internal" ? "Public" : "Private"}` : item.status)}</td></RecordRow>)}</tbody></table></div>
      <div className="mt-4 grid gap-3 md:hidden">{rows.map(item => <RecordItem id={`${kind}-mobile-row-${item.id}`} key={item.id} className="min-w-0 rounded-xl border border-admin-border bg-white p-4"><div className="mb-3"><CatalogItemThumbnail id={`${kind}-mobile-photo-${item.id}`} url={kind === "products" ? item.thumbnail_url : item.image_url} name={item.name} subject={kind === "products" ? "product" : "promo"}/></div><h2 className="font-medium [overflow-wrap:anywhere]"><RecordLink id={`${kind}-mobile-open-${item.id}`} href={`${href}/${item.id}`}>{item.name}</RecordLink></h2>{kind === "products" ? <p className="text-xs text-admin-text-secondary">{item.category || "Uncategorized"}</p> : null}<p className="text-sm">{formatMoney(kind === "products" ? item.sell_price_centavos ?? 0 : item.price_centavos, m.currency)} · {colorStatusText(kind === "products" ? `${item.unit} · ${item.is_active ? "Active" : "Inactive"} · ${item.is_public && item.is_active && item.product_purpose !== "internal" ? "Public" : "Private"}` : item.status)}</p></RecordItem>)}</div>
      {!rows.length ? <p className="py-8 text-center text-sm">No {kind} found in this branch.</p> : null}
      <nav aria-label="Catalog pages" className="mt-4 flex items-center justify-between gap-3">{page > 1 ? <Link id={`${kind}-previous`} href={`${href}?page=${page - 1}&q=${encodeURIComponent(query.q ?? "")}&status=${encodeURIComponent(query.status ?? "all")}`}>Previous</Link> : <span/>}<span className="text-sm">Page {page}</span>{page * 30 < (result.count ?? 0) ? <Link id={`${kind}-next`} href={`${href}?page=${page + 1}&q=${encodeURIComponent(query.q ?? "")}&status=${encodeURIComponent(query.status ?? "all")}`}>Next</Link> : <span/>}</nav>
    </>}
    {open ? <FormDialog id={`${kind}-catalog-dialog`} title={`${row ? "Edit" : "Add"} ${kind === "products" ? "product" : "promo"}`} closeHref={href}>{choicesError ? <p role="alert">Unable to load components. Close and try again.</p> : kind === "products" ? <ProductCatalogForm requestKey={randomUUID()} product={row} currency={m.currency}/> : <PromoCatalogForm requestKey={randomUUID()} promo={row} products={products} services={services} hospitality={m.industry === "hospitality"} currency={m.currency}/>}{row?<RemoveRecordButton kind={kind === "products" ? "product" : "promo"} recordId={row.id} name={row.name}/>:null}</FormDialog> : null}
    {query.id && !row ? <p role="alert" className="mt-3">The selected record is unavailable in this branch.</p> : null}
  </main>;
}
