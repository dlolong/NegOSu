
import { RecordRow, RecordCard, RecordItem, RecordLink } from "@/components/record-item";
import Link from "next/link";
import { ArrowDownUp, ArrowLeft, ArrowRight, ArrowRightLeft, ClipboardList, History, Package, PackagePlus, Search, SlidersHorizontal, X } from "lucide-react";
import { FormDialog } from "@/components/management-ui";
import { InventoryForm } from "@/components/inventory-forms";
import { FormMessage } from "@/components/form-message";
import { PageHeader } from "@/components/page-patterns";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { quantityLabel } from "@/lib/inventory";
import { formatMoney } from "@/lib/operations";
import { filterInventory, inventoryHref, inventoryPage, stockStatus, stockStatusLabels, type InventoryStock, type InventoryMovement, type InventoryQuery } from "@/lib/inventory-workspace";

function StockBadge({ item }: { item: InventoryStock }) {
  const status = stockStatus(item);
  return <span className={`inline-flex max-w-full rounded-full px-2.5 py-1 text-xs font-medium ${status === "out" ? "bg-red-50 text-red-700" : status === "low" ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}>{stockStatusLabels[status]}</span>;
}
export function InventoryWorkspace({ stock, movements, branches, services, branchId, branchName, salon, canManage, query = {}, loadError, timezone = "Asia/Manila" }: {
  stock: InventoryStock[]; movements: InventoryMovement[]; branches: { id: string; name: string }[]; services: { id: string; name: string }[];
  branchId: string; branchName: string; salon: boolean; canManage: boolean; query?: InventoryQuery; loadError?: string; timezone?: string;
}) {
  const prefix = salon ? "salon-inventory" : "inventory", productPrefix = salon ? "salon-product" : "inventory-item";
  const branchStock = stock.filter(item => item.branch_id === branchId);
  const base = { q: query.q, category: query.category, status: query.status, view: query.view, page: query.page };
  const closeHref = inventoryHref(base);
  const href = (overrides: InventoryQuery) => inventoryHref({ ...base, ...overrides });
  const filtered = filterInventory(branchStock, query);
  const { rows, page, pages } = inventoryPage(filtered, query.page);
  const history = query.view === "history";
  const categories = [...new Set(branchStock.map(item => item.category).filter((value): value is string => Boolean(value)))].sort();
  const selected = branchStock.find(item => item.id === query.itemId);
  const mode = ["create", "movement", "transfer", "recipe"].includes(query.dialog ?? "") ? query.dialog as "create" | "movement" | "transfer" | "recipe" : undefined;
  const showDetails = query.dialog === "details" && !loadError;
  const showDialog = canManage && mode && !(mode === "recipe" && salon) && !loadError;
  const recordLink = (item: InventoryStock, suffix: string) => <Button asChild variant="secondary" size="sm"><Link id={`${productPrefix}-record-${suffix}-${item.id}`} href={href({ dialog: "movement", itemId: item.id })}><ArrowDownUp size={16} aria-hidden="true" className="shrink-0"/>Record movement</Link></Button>;
  return <main id={`${prefix}-page`} className="mx-auto min-w-0 max-w-7xl">
    <PageHeader id={`${prefix}-page-header`} eyebrow={branchName} title="Inventory" description="Keep stock organized and see what needs replenishing." action={canManage && !loadError ? <>
      <Button id={`${prefix}-transfer-open-button`} asChild variant="outline"><Link href={href({ dialog: "transfer" })}><ArrowRightLeft size={16} aria-hidden="true"/>Transfer stock</Link></Button>
      <Button id={`${productPrefix}-add-button`} asChild><Link href={href({ dialog: "create" })}><PackagePlus size={16} aria-hidden="true"/>Add product</Link></Button>
    </> : undefined}/>
    <FormMessage error={loadError ?? query.error} message={query.message}/>
    {!loadError ? <>
      <section id={`${prefix}-metrics`} aria-label="Inventory summary" className="mt-5 grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4">
        {[{ label: "Products", value: branchStock.length, status: "", id: "products" }, { label: "Low stock", value: branchStock.filter(item => stockStatus(item) === "low").length, status: "low", id: "low-stock" }, { label: "Out of stock", value: branchStock.filter(item => stockStatus(item) === "out").length, status: "out", id: "out-of-stock" }].map(metric => <Link key={metric.id} id={`${prefix}-${metric.id}`} href={inventoryHref({ status: metric.status })} className="min-w-0 rounded-xl border border-admin-border bg-white p-4 transition-colors hover:bg-admin-surface focus-visible:ring-2 focus-visible:ring-brand-primary"><span className="text-xs font-medium text-admin-text-muted">{metric.label}</span><strong className={`mt-2 block text-2xl font-semibold ${metric.status === "out" ? "text-red-700" : metric.status === "low" ? "text-amber-800" : ""}`}>{metric.value}</strong><span className="mt-1 inline-flex items-center gap-1 text-xs text-admin-text-muted">View products<ArrowRight aria-hidden="true" size={12}/></span></Link>)}
        <Card id={`${prefix}-valuation`} elevation="none" className="min-w-0 p-4"><p className="text-xs font-medium text-admin-text-muted">Stock value at cost</p><strong className="mt-2 block text-xl font-semibold [overflow-wrap:anywhere]">{formatMoney(branchStock.reduce((sum, item) => sum + Number(item.valuation_centavos), 0))}</strong><p className="mt-1 text-xs text-admin-text-muted">Based on stock on hand</p></Card>
      </section>
      <div className="my-5 flex min-w-0 flex-wrap items-center justify-between gap-3">
        <nav aria-label="Inventory views" className="flex max-w-full flex-wrap gap-2">
          <Button asChild variant={history ? "outline" : "secondary"}><Link id={`${prefix}-stock-tab`} href={href({ view: undefined, page: undefined })} aria-current={!history ? "page" : undefined}><Package size={16} aria-hidden="true"/>Stock</Link></Button>
          <Button asChild variant={history ? "secondary" : "outline"}><Link id={`${prefix}-history-tab`} href={href({ view: "history", page: undefined })} aria-current={history ? "page" : undefined}><History size={16} aria-hidden="true"/>Movement history</Link></Button>
        </nav>
        {canManage && !salon ? <Button asChild size="sm" variant="ghost"><Link id="inventory-recipe-open-button" href={href({ dialog: "recipe" })}><ClipboardList size={16} aria-hidden="true"/>Service recipes</Link></Button> : null}
      </div>
      {history ? <Card id={`${prefix}-history`} elevation="none" className="min-w-0 p-4 sm:p-5"><h2 className="font-semibold">Recent movements</h2><p className="mt-1 text-sm text-admin-text-muted">Latest 30 movements for {branchName}. Times shown in {timezone}.</p>
        <ul className="mt-4 divide-y divide-admin-border">{movements.map(movement => <RecordItem as="li" key={movement.id} className="flex min-w-0 flex-wrap justify-between gap-3 py-4">
          <div className="min-w-0 flex-1 basis-40 [overflow-wrap:anywhere]"><h3 className="text-sm font-semibold">{movement.itemId ? <RecordLink id={`${prefix}-movement-link-${movement.id}`} href={href({ dialog: "details", itemId: movement.itemId })}>{movement.name}</RecordLink> : movement.name}</h3><p className="mt-1 text-xs capitalize text-admin-text-muted">{movement.type.replaceAll("_", " ")} · <time dateTime={movement.createdAt}>{new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(movement.createdAt))}</time></p>{movement.note ? <p className="mt-2 text-sm text-admin-text-secondary">{movement.note}</p> : null}</div>
          <strong className={`text-sm [overflow-wrap:anywhere] ${Number(movement.quantity) < 0 ? "text-red-700" : "text-emerald-700"}`}>{Number(movement.quantity) > 0 ? "+" : ""}{quantityLabel(movement.quantity, movement.unit)}</strong>
        </RecordItem>)}</ul>{!movements.length ? <p className="py-10 text-center text-sm text-admin-text-muted">No movements yet. Recorded stock changes will appear here.</p> : null}
      </Card> : <>
        <Card elevation="none" className="min-w-0 p-4 sm:p-5">
          <form id={`${prefix}-filters`} method="get" action="/dashboard/inventory" className="grid min-w-0 items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
            <label className="min-w-0 text-xs font-medium">Search products<Input id={`${prefix}-search-input`} name="q" defaultValue={query.q} placeholder="Product name, SKU or category" className="mt-2"/></label>
            <label className="min-w-0 text-xs font-medium">Category<select id={`${prefix}-category-filter`} name="category" defaultValue={query.category ?? ""} className="mt-2 min-h-11 w-full min-w-0 max-w-full rounded-xl border border-admin-border bg-white px-3 text-sm"><option value="">All categories</option>{categories.map(category => <option key={category} value={category}>{category}</option>)}</select></label>
            <label className="min-w-0 text-xs font-medium">Stock status<select id={`${prefix}-status-filter`} name="status" defaultValue={query.status ?? ""} className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-admin-border bg-white px-3 text-sm"><option value="">All stock</option><option value="healthy">In stock</option><option value="low">Low stock</option><option value="out">Out of stock</option></select></label>
            <div className="flex flex-wrap justify-end gap-2"><Button id={`${prefix}-filter-button`} type="submit" variant="secondary"><Search size={16} aria-hidden="true"/>Search</Button>{query.q || query.category || query.status ? <Button asChild variant="ghost"><Link id={`${prefix}-clear-filters`} href={inventoryHref()}><X size={16} aria-hidden="true"/>Clear</Link></Button> : null}</div>
          </form>
        </Card>
        <div className="my-4 flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">Branch stock <span className="font-normal text-admin-text-muted">({filtered.length} of {branchStock.length} products)</span></h2><p className="text-xs text-admin-text-muted">On hand is your physical stock balance.</p></div>
        {!rows.length ? <Card id={`${prefix}-empty-state`} elevation="none" className="p-8 text-center"><Package aria-hidden="true" className="mx-auto text-admin-text-muted"/><h3 className="mt-3 font-semibold">{branchStock.length ? "No matching products" : "Your inventory starts here"}</h3><p className="mt-2 text-sm text-admin-text-muted">{branchStock.length ? "Try a different search or clear the filters." : canManage ? "Add your first product, then record its opening stock." : "Your manager can add products to this branch."}</p>{branchStock.length ? <Button asChild className="mt-4" variant="outline"><Link href={inventoryHref()}><SlidersHorizontal size={16} aria-hidden="true"/>Clear filters</Link></Button> : null}</Card> : <>
          <div className="hidden min-w-0 rounded-xl border border-admin-border bg-white xl:block"><table id={`${prefix}-table`} className="w-full table-fixed text-left text-sm"><thead className="border-b border-admin-border bg-admin-surface text-xs text-admin-text-muted"><tr><th className="w-[32%] px-4 py-3">Product</th><th className="w-[19%] px-3 py-3">On hand / reorder level</th><th className="w-[15%] px-3 py-3">Status</th><th className="px-4 py-3 text-right">{canManage ? "Action" : "Stock value"}</th></tr></thead><tbody className="divide-y divide-admin-border">{rows.map(item => <RecordRow id={`${productPrefix}-row-${item.id}`} key={item.id}><td className="px-4 py-4 [overflow-wrap:anywhere]"><RecordLink id={`${productPrefix}-link-${item.id}`} href={href({ dialog: "details", itemId: item.id })}>{item.name}</RecordLink><p className="mt-1 text-xs text-admin-text-muted">{item.sku || "No SKU"} · {item.category || "Uncategorized"}</p></td><td className="px-3 py-4 [overflow-wrap:anywhere]"><strong className="font-semibold">{quantityLabel(item.quantity_on_hand, item.unit)}</strong><p className="mt-1 text-xs text-admin-text-muted">Reorder at {quantityLabel(item.reorder_level, item.unit)}</p></td><td className="px-3 py-4"><StockBadge item={item}/></td><td className="px-4 py-4 text-right [overflow-wrap:anywhere]">{canManage ? recordLink(item, "desktop") : formatMoney(Number(item.valuation_centavos))}</td></RecordRow>)}</tbody></table></div>
          <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:hidden">{rows.map(item => <RecordCard id={`${productPrefix}-card-${item.id}`} key={item.id} elevation="none" className="min-w-0 p-4"><div className="flex min-w-0 flex-wrap items-start justify-between gap-2"><h3 className="min-w-0 flex-1 basis-36 text-sm font-semibold [overflow-wrap:anywhere]"><RecordLink id={`${productPrefix}-link-mobile-${item.id}`} href={href({ dialog: "details", itemId: item.id })}>{item.name}</RecordLink></h3><StockBadge item={item}/></div><p className="mt-2 text-xs text-admin-text-muted [overflow-wrap:anywhere]">{item.sku || "No SKU"} · {item.category || "Uncategorized"}</p><div className="mt-4 min-w-0 [overflow-wrap:anywhere]"><strong className="text-lg font-semibold">{quantityLabel(item.quantity_on_hand, item.unit)}</strong><p className="mt-1 text-xs text-admin-text-muted">Reorder at {quantityLabel(item.reorder_level, item.unit)}</p></div>{canManage ? <div className="mt-4 flex justify-end border-t border-admin-border pt-3">{recordLink(item, "mobile")}</div> : null}</RecordCard>)}</div>
          {pages > 1 ? <nav aria-label="Stock pagination" className="mt-4 flex flex-wrap items-center justify-end gap-2"><span className="mr-auto text-sm text-admin-text-muted">Page {page} of {pages}</span>{page > 1 ? <Button asChild variant="outline"><Link href={href({ page: String(page - 1) })}><ArrowLeft size={16} aria-hidden="true"/>Previous</Link></Button> : null}{page < pages ? <Button asChild variant="outline"><Link href={href({ page: String(page + 1) })}>Next<ArrowRight size={16} aria-hidden="true"/></Link></Button> : null}</nav> : null}
        </>}
      </>}
    </> : <Button asChild variant="outline" className="mt-4"><Link href={closeHref}><History size={16} aria-hidden="true"/>Try again</Link></Button>}
    {showDetails ? <FormDialog id={`${prefix}-details-dialog`} title={selected?.name ?? "Product details"} closeHref={closeHref} size="md">
      {selected ? <div id={`${productPrefix}-details`} className="min-w-0 space-y-5">
        <StockBadge item={selected}/>
        <dl className="grid min-w-0 grid-cols-2 gap-4 text-sm">{[["SKU", selected.sku || "No SKU"], ["Category", selected.category || "Uncategorized"], ["On hand", quantityLabel(selected.quantity_on_hand, selected.unit)], ["Reorder level", quantityLabel(selected.reorder_level, selected.unit)], ["Stock value at cost", formatMoney(Number(selected.valuation_centavos))], ["Lot / batch", selected.lot_number || "Not provided"], ["Expiry date", selected.expires_on || "Not provided"]].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-admin-text-muted">{label}</dt><dd className="mt-1 font-medium [overflow-wrap:anywhere]">{value}</dd></div>)}</dl>
        <p className="whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">{selected.description || "No description."}</p>
        {canManage ? <div className="flex justify-end border-t border-admin-border pt-4">{recordLink(selected, "details")}</div> : null}
      </div> : <FormMessage error="This product is not available in the selected branch."/>}
    </FormDialog> : null}
    {showDialog ? <FormDialog id={`${prefix}-${mode}-dialog`} title={{ create: "Add product", movement: "Record movement", transfer: "Transfer stock", recipe: "Service consumable recipe" }[mode]} closeHref={closeHref} size={mode === "create" ? "lg" : "md"}>
      {mode === "movement" && !selected ? <FormMessage error="This product is not available in the selected branch. Close this dialog and choose another product."/> : <InventoryForm mode={mode} salon={salon} stock={mode === "recipe" ? branchStock : stock} item={selected} branches={branches} services={services} returnHref={closeHref} idempotencyKey={crypto.randomUUID()}/>}
    </FormDialog> : null}
  </main>;
}
