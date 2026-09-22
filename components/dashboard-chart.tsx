import { chartMaximum, type ChartPoint } from "@/modules/platform/chart-data";

/** Values are always visible and available in a table; color is never the only label. */
export function DashboardChart({ id, title, description, points, currency }: {
  id: string; title: string; description: string; points: readonly ChartPoint[]; currency?: string;
}) {
  const maximum = chartMaximum(points);
  const format = (value: number) => currency
    ? new Intl.NumberFormat("en-PH", { style: "currency", currency, maximumFractionDigits: 2 }).format(value / 100)
    : value.toLocaleString("en-PH");
  const hasData = points.some(point => point.value > 0);
  return <section id={id} aria-labelledby={`${id}-title`} className="my-3 min-w-0 rounded-xl border border-admin-border bg-admin-surface p-4">
    <h2 id={`${id}-title`} className="font-medium text-admin-text">{title}</h2>
    <p className="mt-1 text-xs text-admin-text-secondary">{description}</p>
    {!hasData ? <p role="status" className="py-6 text-sm text-admin-text-secondary">No activity for this view yet.</p> : points.length > 10 ? <div className="mt-4">
      <svg viewBox="0 0 600 170" role="img" aria-label={`${title}. Daily values are available in View chart data.`} className="h-auto w-full overflow-visible">
        {[0, 1, 2, 3].map(tick => <line key={tick} x1="10" x2="590" y1={10 + tick * 50} y2={10 + tick * 50} stroke="currentColor" className="text-admin-border" strokeDasharray="4 4"/>)}
        <polyline fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" className="text-brand-primary" points={points.map((point, index) => `${10 + index / (points.length - 1) * 580},${160 - point.value / maximum * 150}`).join(" ")}/>
        {points.map((point, index) => <circle key={index} cx={10 + index / (points.length - 1) * 580} cy={160 - point.value / maximum * 150} r="3" fill="currentColor" className="text-brand-primary"><title>{point.label}: {format(point.value)}</title></circle>)}
      </svg>
      <div className="flex justify-between gap-2 text-[11px] text-admin-text-secondary"><span>{points[0].label}</span><span>Peak {format(maximum)}</span><span>{points.at(-1)?.label}</span></div>
    </div> : <div className="mt-4 space-y-3" role="list" aria-label={title}>
      {points.map((point, index) => <div key={`${point.label}-${index}`} role="listitem">
        <div className="mb-1 flex min-w-0 flex-wrap justify-between gap-x-3 text-xs"><span className="capitalize [overflow-wrap:anywhere]">{point.label}</span><strong className="tabular-nums">{format(point.value)}</strong></div>
        <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-primary" style={{ width: `${Math.max(0, point.value) / maximum * 100}%` }}/></div>
      </div>)}
    </div>}
    {points.length > 0 ? <details id={`${id}-data`} className="mt-3 text-xs text-admin-text-secondary"><summary id={`${id}-data-toggle`} className="w-fit cursor-pointer rounded py-2 focus-visible:outline-2">View chart data</summary><table className="mt-2 w-full text-left"><caption className="sr-only">{title}</caption><thead><tr><th scope="col">Category</th><th scope="col" className="text-right">{currency ?? "Count"}</th></tr></thead><tbody>{points.map((point, index) => <tr key={index}><th scope="row" className="py-1 font-normal capitalize">{point.label}</th><td className="text-right tabular-nums">{format(point.value)}</td></tr>)}</tbody></table></details> : null}
  </section>;
}
