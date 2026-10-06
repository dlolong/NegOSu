import { CatalogItemThumbnail } from "@/components/catalog-item-thumbnail";
import { inventoryMonthlyConsumption, type InventoryReport } from "@/lib/inventory-report";

export function InventoryConsumptionCards({ report, start, end }: { report: InventoryReport; start: string; end: string }) {
  const format = (value: number) => new Intl.NumberFormat("en", { maximumFractionDigits: 3 }).format(value);
  return <section id="inventory-monthly-products" className="my-4">
    <h2 className="font-semibold">Monthly product consumption</h2>
    <p className="mt-1 text-sm text-admin-text-secondary">Consumption within {start} to {end}. Partial months include only the selected dates.</p>
    {!report.rows.length ? <p className="py-5">No products match these filters.</p> : report.product_daily === undefined ? <p role="alert">Product consumption is unavailable. Please try again.</p> : <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {inventoryMonthlyConsumption(report, start, end).map(({ product, months }) => <article id={`inventory-monthly-product-${product.id}`} key={product.id} className="min-w-0 rounded-xl border border-admin-border bg-white p-4 [overflow-wrap:anywhere]">
        <CatalogItemThumbnail id={`inventory-monthly-photo-${product.id}`} url={product.thumbnail_url} name={product.name} subject="product"/><h3 className="mt-2 font-semibold">{product.name}</h3>
        <p className="mt-1 text-xs text-admin-text-secondary">{product.category || "Uncategorized"} · {product.branch_name} · {product.unit}</p>
        {!product.stock_tracked ? <p className="mt-3 text-sm">Non-stock product · consumption not tracked</p> : <>
          <dl className="mt-3 divide-y divide-admin-border">{months.map(({ month, consumed }) => <div key={month} className="flex justify-between gap-3 py-2 text-sm"><dt>{new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`))}</dt><dd className="font-semibold tabular-nums">{format(consumed ?? 0)} {product.unit}</dd></div>)}</dl>
          <p className="mt-3 border-t border-admin-border pt-3 text-sm font-semibold">Period consumed: {format(product.consumed)} {product.unit}</p>
        </>}
      </article>)}
    </div>}
  </section>;
}
