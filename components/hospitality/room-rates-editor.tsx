"use client";
import { useState } from "react";
import { chargeCentavos, stayPackages, type RoomRate } from "@/modules/hospitality/contracts";
import { fieldClass } from "./shared";

export function RoomRatesEditor({ rates, version, ids, currency = "PHP" }: { rates: RoomRate[]; version: number; ids: string[]; currency?: string }) {
  const [rows, setRows] = useState(() => stayPackages.map((period, i) => {
    const rate = rates.find(r => r.durationMinutes === period.durationMinutes);
    return { ...period, id: rate?.id ?? ids[i], enabled: Boolean(rate) || (!rates.length && i === 0), extension: rate?.extensionHourlyCentavos ? (rate.extensionHourlyCentavos / 100).toFixed(2) : "", amount: rate ? (rate.priceCentavos / 100).toFixed(2) : "" };
  }));
  const payload = rows.filter(r => r.enabled).map(({ id, label, durationMinutes, amount, extension }) => {
    let priceCentavos = 0; try { priceCentavos = chargeCentavos(amount) ?? 0; } catch { /* Server validation rejects malformed prices. */ }
    let extensionHourlyCentavos = 0; try { extensionHourlyCentavos = chargeCentavos(extension, true) ?? 0; } catch { extensionHourlyCentavos = -1; }
    return { id, label, durationMinutes, priceCentavos, extensionHourlyCentavos };
  });
  return <fieldset id="hospitality-room-rates" className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
    <legend className="px-1 text-sm">Room & extension rates ({currency})</legend>
    <input type="hidden" name="ratesVersion" value={version}/><input type="hidden" name="rates" value={JSON.stringify(payload)}/>
    <p className="mb-3 text-xs leading-5 text-slate-500">Enable the stay periods offered for this room. One day is 24 hours; weekly is 7 days; monthly is 30 days. Cashiers can record discounts. An optional hourly price enables extensions. Existing stays retain their agreed rates.</p>
    <div className="space-y-3">{rows.map((row, i) => <div key={row.durationMinutes} className="grid grid-cols-2 items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-3">
      <label className="col-span-2 flex min-h-11 items-center gap-2 text-sm sm:col-span-1"><input id={`hospitality-rate-${row.durationMinutes}-enabled`} type="checkbox" checked={row.enabled} onChange={e => setRows(rows.map((r, n) => n === i ? { ...r, enabled: e.target.checked } : r))}/>{row.label}</label>
      <label className="text-xs text-slate-600">Package price<input id={`hospitality-rate-${row.durationMinutes}-price`} aria-label={`${row.label} price in ${currency}`} className={fieldClass} inputMode="decimal" required={row.enabled} disabled={!row.enabled} value={row.amount} placeholder="Price" onChange={e => setRows(rows.map((r, n) => n === i ? { ...r, amount: e.target.value } : r))}/></label>
      <label className="text-xs text-slate-600">Per extra hour<input id={`hospitality-rate-${row.durationMinutes}-extension`} aria-label={`${row.label} extension per hour in ${currency}`} className={fieldClass} inputMode="decimal" disabled={!row.enabled} value={row.extension} placeholder="Not offered" onChange={e => setRows(rows.map((r, n) => n === i ? { ...r, extension: e.target.value } : r))}/></label>
    </div>)}</div>
  </fieldset>;
}
