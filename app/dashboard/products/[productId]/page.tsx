import { CatalogDetailPhoto } from "@/components/catalog-detail-photo";
import { FormDialog } from "@/components/management-ui";
import { RecordLink } from "@/components/record-item";
import { RecordTable } from "@/components/record-table";
import { ListingFilters } from "@/components/listing-filters";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/operations";
import { historyPage } from "@/modules/core/crm/client-reminders";
import { loadProductHistory, productHistoryTab, PRODUCT_HISTORY_SIZE, type ProductMovement, type ProductPurchase } from "@/modules/core/commerce/product-history";
import { PageHeader } from "@/components/page-patterns";
import { ListTabs } from "@/components/list-tabs";
import { HistoryNavigation } from "@/components/client-reminder-rows";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
type Query = { movement?: string; q?: string; from?: string; to?: string; tab?: string; page?: string };
export default async function Page({ params, searchParams }: { params: Promise<{ productId: string }>; searchParams: Promise<Query> }) {
  const [{ productId }, query, { activeMembership: m }, db] = await Promise.all([params, searchParams, getDashboardContext(), createClient()]);
  if (!z.uuid().safeParse(productId).success || !["owner", "manager"].includes(m.role) || !["automotive", "salon", "pet_care", "hospitality"].includes(m.industry)) notFound();
  const { data: product, error } = await db.from("inventory_items").select("id,name,sku,description,category,unit,sell_price_centavos,product_purpose,stock_tracked,is_active,is_public,thumbnail_url")
    .eq("organization_id", m.organizationId).eq("branch_id", m.branchId).eq("id", productId).maybeSingle();
  if (error) return <main className="mx-auto max-w-5xl"><PageHeader id="product-detail-error-header" title="Product details" back={<Link id="product-error-back" href="/dashboard/products">Back to Products</Link>}/><p role="alert">Product details could not be loaded. Please try again.</p></main>;
  if (!product) notFound();
  const tab = productHistoryTab(query.tab), page = historyPage(query.page), path = `/dashboard/products/${productId}`;
  const [history, stock, branch] = await Promise.all([
    loadProductHistory(db, m, productId, tab, page, query),
    db.from("inventory_stock").select("quantity_on_hand,reorder_level").eq("organization_id", m.organizationId).eq("branch_id", m.branchId).eq("id", productId).maybeSingle(),
    db.from("branches").select("timezone").eq("organization_id", m.organizationId).eq("id", m.branchId).maybeSingle(),
  ]);
  const timezone = branch.data?.timezone ?? m.timezone;
  const date = (value: string) => new Intl.DateTimeFormat("en-PH", { timeZone: timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  const rows = history.data ?? [];
  const historyQuery = new URLSearchParams({tab,page:String(page),q:query.q??"",from:query.from??"",to:query.to??""});
  const movement = tab !== "purchases" ? (rows as unknown as ProductMovement[]).find(row=>row.id===query.movement) : undefined;

  return <main id="product-detail-page" className="mx-auto min-w-0 max-w-5xl [overflow-wrap:anywhere]">
    
    <PageHeader back={<Button asChild variant="ghost" ><Link id="product-detail-back" href="/dashboard/products">Back to Products</Link></Button>} id="product-detail-header" title={product.name} description={`${product.category || "Uncategorized"}`} action={<Button asChild variant="secondary"><Link id="product-detail-edit" href={`/dashboard/products?dialog=edit&id=${product.id}`}>Edit product</Link></Button>}/>
    <Card id="product-details" className="mt-4 grid min-w-0 gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:p-5">
      <div className="min-w-0"><CatalogDetailPhoto key={product.thumbnail_url} id="product-detail-photo" recordId={product.id} name={product.name} url={product.thumbnail_url} subject="product"/></div>
      <div className="min-w-0"><dl className="grid gap-3 text-sm sm:grid-cols-2">{[
        ["Selling price", `${formatMoney(product.sell_price_centavos ?? 0, m.currency)} / ${product.unit}`],
        ["Product code", product.sku || "Not set"], ["Purpose", product.product_purpose],
        ["Status", product.is_active ? "Active" : "Inactive"],
        ["Website", product.is_public && product.is_active && product.product_purpose !== "internal" ? "Public" : "Private"],
        ["Stock on hand", !product.stock_tracked ? "Not tracked" : stock.error || !stock.data ? "Unavailable" : `${stock.data.quantity_on_hand} ${product.unit}`],
      ].map(([label,value]) => <div key={label}><dt className="text-admin-text-secondary">{label}</dt><dd className="font-medium">{value}</dd></div>)}</dl><p className="mt-4 whitespace-pre-wrap text-sm">{product.description || "No description."}</p></div>
    </Card>
    <ListTabs id="product-history-tabs" baseHref={path} query={{q:query.q,from:query.from,to:query.to}} parameter="tab" value={tab} options={[{ value: "usage", label: "Usage history" }, { value: "purchases", label: "Customer purchases" }, { value: "stock", label: "Stock purchases" }]}/>
    <ListingFilters id="product-history-filters" action={path} query={{...query,tab}} searchLabel={tab === "purchases" ? "Search customer name" : "Search movement notes"} dates/>
    {movement ? <FormDialog id="product-movement-details" title="Stock movement details" closeHref={`${path}?${historyQuery}`}><dl className="space-y-3 text-sm"><div><dt>Product</dt><dd>{product.name}</dd></div><div><dt>Movement</dt><dd>{movement.movement_type.replaceAll("_"," ")}</dd></div><div><dt>Quantity</dt><dd>{movement.quantity_delta} {product.unit}</dd></div><div><dt>Recorded</dt><dd>{date(movement.created_at)}</dd></div><div><dt>Notes</dt><dd>{movement.note || "No notes recorded."}</dd></div></dl></FormDialog> : null}
    <p className="mt-3 text-sm text-admin-text-secondary">{tab === "usage" ? "Recorded usage, consumption, waste, and returns. Quantities show stock added or deducted." : tab === "stock" ? "Recorded stock purchases received into inventory." : "Billed customer purchases and handed-over promo inclusions. Voided bills and returns remain labeled for reference."} Times shown in {timezone}.</p>
    {history.error ? <p id="product-history-error" role="alert" className="mt-4">History could not be loaded. Please try again.</p> : <>
      {tab === "purchases" ? <RecordTable id="product-history-list" className="mt-4" caption="Customer purchases" columns={[{key:"customer",label:"Customer"},{key:"quantity",label:"Quantity",secondary:true},{key:"date",label:"Date and time",secondary:true},{key:"status",label:"Status",secondary:true},{key:"amount",label:"Amount",align:"right"}]} rows={(rows as unknown as ProductPurchase[]).slice(0,PRODUCT_HISTORY_SIZE).map(row=>({id:`product-purchase-${row.id}`,cells:{customer:<RecordLink id={`product-purchase-checkout-${row.id}`} href={`/dashboard/checkout/${row.checkout_id}`} className="font-medium underline">{row.checkouts.customer_name}</RecordLink>,quantity:<>{row.included_key ? row.handed_over : row.quantity} {row.unit}<p className="text-xs">Handed over: {row.handed_over} · Returned: {row.returned}</p></>,date:date(row.invoices?.issued_at ?? row.created_at),status:row.included_key ? `Promo inclusion${row.promo_name ? ` · ${row.promo_name}` : ""}` : (row.invoices?.status ?? "Bill unavailable").replaceAll("_"," "),amount:row.included_key ? "Included" : row.invoices?.status === "void" ? "Voided" : formatMoney(row.line_total_centavos,m.currency)},mobile:<><p>{row.quantity} {row.unit} · Handed over {row.handed_over} · Returned {row.returned}</p><p>{date(row.invoices?.issued_at ?? row.created_at)} · {row.included_key ? "Promo inclusion" : row.invoices?.status}</p></>}))}/> : <RecordTable id="product-history-list" className="mt-4" caption="Stock movements" columns={[{key:"type",label:"Movement"},{key:"notes",label:"Notes",secondary:true},{key:"date",label:"Date and time",secondary:true},{key:"quantity",label:"Quantity",align:"right"}]} rows={(rows as unknown as ProductMovement[]).slice(0,PRODUCT_HISTORY_SIZE).map(row=>({id:`product-movement-${row.id}`,cells:{type:<RecordLink id={`product-movement-open-${row.id}`} href={`${path}?${historyQuery}&movement=${row.id}`}>{row.movement_type.replaceAll("_"," ")}</RecordLink>,notes:row.note || "No notes recorded.",date:date(row.created_at),quantity:`${Number(row.quantity_delta)>0 ? "+" : ""}${row.quantity_delta} ${product.unit}`},mobile:<><p>{row.note || "No notes recorded."}</p><p>{date(row.created_at)}</p></>}))}/>}

      {!rows.length ? <p id="product-history-empty" className="mt-5 text-sm text-admin-text-secondary">No {tab === "usage" ? "usage" : tab === "stock" ? "stock purchases" : "customer purchases"} recorded{page>1 ? " on this page" : " yet"}.</p> : null}
      <HistoryNavigation id="product-history-pagination" path={`${path}?${new URLSearchParams({tab,q:query.q??"",from:query.from??"",to:query.to??""})}`} parameter="page" page={page} hasMore={rows.length>PRODUCT_HISTORY_SIZE}/>
    </>}
  </main>;
}
