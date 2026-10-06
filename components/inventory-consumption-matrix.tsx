import { Fragment } from "react";
import { inventoryReportDays, type InventoryReport } from "@/lib/inventory-report";

export function InventoryConsumptionMatrix({ report, start, end }: { report: InventoryReport; start: string; end: string }) {
  const days = inventoryReportDays(start, end);
  const quantities = new Map(report.product_daily?.map(row => [`${row.inventory_item_id}:${row.day}`, row.consumed]));
  const format = (value: number) => new Intl.NumberFormat("en", { maximumFractionDigits: 3 }).format(value);
  return <section id="inventory-daily-consumption" className="mb-5 min-w-0">
    <h2 className="font-semibold">Daily consumption · {start} to {end}</h2>
    <p id="inventory-matrix-help" className="my-2 text-sm text-admin-text-secondary">Scroll to see all dates.</p>
    {report.product_daily === undefined ? <p role="status">Apply migration 0131_inventory_product_daily_consumption.sql to enable the product breakdown.</p> :
      <div id="inventory-consumption-scroll" role="region" aria-label="Daily product consumption" aria-describedby="inventory-matrix-help" tabIndex={0} className="max-w-full overflow-x-auto rounded-xl border border-admin-border focus-visible:outline-2 focus-visible:outline-brand-primary">
        <table id="inventory-consumption-matrix" className="w-full border-separate border-spacing-0 text-sm">
          <caption className="sr-only">Product consumption per day for {start} to {end}</caption>
          <thead><tr className="text-admin-text-secondary">
            <th scope="col" className="sticky left-0 z-20 min-w-32 max-w-32 border-b border-r border-admin-border bg-slate-50 px-3 py-3 text-left font-semibold sm:min-w-56 sm:max-w-56">Product</th>
            {days.map(day => <th key={day} scope="col" className="min-w-16 border-b border-admin-border bg-slate-50 px-3 py-3 text-right font-semibold"><abbr title={day} className="no-underline">{day.slice(5)}</abbr></th>)}
            <th scope="col" className="sticky right-0 z-20 min-w-20 border-b border-l border-admin-border bg-slate-50 px-3 py-3 text-right font-semibold">Total</th>
          </tr></thead>
          <tbody>{report.rows.map((row, index) => <Fragment key={row.id}>{(index === 0 || row.category !== report.rows[index - 1].category) ? <tr><th scope="rowgroup" colSpan={days.length + 2} className="border-b border-admin-border bg-slate-100 px-3 py-2 text-left font-semibold"><span className="sticky left-3">{row.category || "Uncategorized"}</span></th></tr> : null}<tr id={`inventory-consumption-product-${row.id}`}>
            <th scope="row" className="sticky left-0 z-10 min-w-32 max-w-32 border-b border-r border-admin-border bg-white px-3 py-3 text-left font-semibold [overflow-wrap:anywhere] sm:min-w-56 sm:max-w-56">{row.name}<small className="mt-1 block font-normal text-admin-text-secondary">{row.branch_name} · {row.unit}{!row.stock_tracked ? " · Non-stock" : ""}</small></th>
            {days.map(day => <td key={day} className={`border-b border-admin-border px-3 py-3 text-right tabular-nums ${row.stock_tracked && Number(quantities.get(`${row.id}:${day}`) ?? 0) !== 0 ? "bg-emerald-50 font-semibold text-emerald-800" : "bg-white text-admin-text-muted"}`}>{row.stock_tracked ? format(quantities.get(`${row.id}:${day}`) ?? 0) : "—"}</td>)}
            <td className={`sticky right-0 z-10 min-w-20 border-b border-l border-admin-border px-3 py-3 text-right font-semibold tabular-nums ${row.stock_tracked && Number(row.consumed) !== 0 ? "bg-emerald-100 text-emerald-900" : "bg-slate-50 text-admin-text-muted"}`}>{row.stock_tracked ? format(row.consumed) : "—"}</td>
          </tr></Fragment>)}</tbody>
        </table>
        {!report.rows.length ? <p className="p-4 text-sm">No products in this branch.</p> : null}
      </div>}
  </section>;
}
