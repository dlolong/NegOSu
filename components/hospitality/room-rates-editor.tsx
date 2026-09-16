"use client";
import { useState } from "react";
import { chargeCentavos, stayPackages, type RoomRate } from "@/modules/hospitality/contracts";
import { fieldClass } from "./shared";

export function RoomRatesEditor({ rates, version, ids }: { rates: RoomRate[]; version: number; ids: string[] }) {
  const [rows, setRows] = useState(() => stayPackages.map((period, i) => {
    const rate = rates.find(r => r.durationMinutes === period.durationMinutes);
    return { ...period, id: rate?.id ?? ids[i], enabled: Boolean(rate) || (!rates.length && i === 0), amount: rate ? (rate.priceCentavos / 100).toFixed(2) : "" };
  }));
  const payload = rows.filter(r => r.enabled).map(({ id, label, durationMinutes, amount }) => {
    let priceCentavos = 0; try { priceCentavos = chargeCentavos(amount) ?? 0; } catch { /* Server validation rejects malformed prices. */ }
    return { id, label, durationMinutes, priceCentavos };
  });
  return <fieldset id="hospitality-room-rates" className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
    <legend className="px-1 text-sm">Fixed room rates (PHP)</legend>
    <input type="hidden" name="ratesVersion" value={version}/><input type="hidden" name="rates" value={JSON.stringify(payload)}/>
    <p className="mb-3 text-xs leading-5 text-slate-500">Enable the stay periods offered for this room. Cashiers use these prices. Daily means 24 hours; weekly means 7 days. Changes apply only to new stays.</p>
    <div className="space-y-3">{rows.map((row, i) => <div key={row.durationMinutes} className="grid grid-cols-[1fr_8rem] items-center gap-3">
      <label className="flex min-h-11 items-center gap-2 text-sm"><input id={`hospitality-rate-${row.durationMinutes}-enabled`} type="checkbox" checked={row.enabled} onChange={e => setRows(rows.map((r, n) => n === i ? { ...r, enabled: e.target.checked } : r))}/>{row.label}</label>
      <input id={`hospitality-rate-${row.durationMinutes}-price`} aria-label={`${row.label} price in pesos`} className={fieldClass} inputMode="decimal" required={row.enabled} disabled={!row.enabled} value={row.amount} placeholder="Price" onChange={e => setRows(rows.map((r, n) => n === i ? { ...r, amount: e.target.value } : r))}/>
    </div>)}</div>
  </fieldset>;
}
