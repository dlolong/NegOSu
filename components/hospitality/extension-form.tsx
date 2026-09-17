"use client";
import { useState } from "react";
import { extendStay } from "@/app/dashboard/hospitality/actions";
import type { RoomRate } from "@/modules/hospitality/contracts";
import { formatMoney } from "@/lib/operations";
import { HospitalityActionForm } from "./action-form";
import { SettlementFields } from "./settlement-fields";
import { Field, fieldClass } from "./shared";
export function ExtensionForm({ stayId, expectedEnd, rates, version, snapshotHourly, currency, requestKey, closeHref }: { stayId: string; expectedEnd: string | null; rates: RoomRate[]; version: number; snapshotHourly: number; currency: string; requestKey: string; closeHref: string }) {
  const choices = rates.filter(r => (r.extensionHourlyCentavos ?? 0) > 0);
  const [rateId, setRateId] = useState(choices[0]?.id ?? ""), [hours, setHours] = useState("1");
  const hourly = snapshotHourly || choices.find(r => r.id === rateId)?.extensionHourlyCentavos || 0;
  const validHours = /^\d+$/.test(hours) && Number(hours) >= 1 && Number(hours) <= 720;
  return <HospitalityActionForm id="hospitality-extension-form" action={extendStay}>
    <input type="hidden" name="stayId" value={stayId}/><input type="hidden" name="expectedEnd" value={expectedEnd ?? ""}/><input type="hidden" name="ratesVersion" value={version}/><input type="hidden" name="requestKey" value={requestKey}/>
    {snapshotHourly ? <input type="hidden" name="rateId" value=""/> : <Field label="Extension rate *" full><select id="hospitality-extension-rate" name="rateId" required className={fieldClass} value={rateId} onChange={e => setRateId(e.target.value)}>{choices.map(r => <option key={r.id} value={r.id}>{r.label} · {formatMoney(r.extensionHourlyCentavos ?? 0, currency)} / hour</option>)}</select><p className="mt-1 text-xs text-slate-500">This stay has no saved hourly price. Select a current room rate agreed with the guest.</p></Field>}
    <Field label="Extra hours *" full><input id="hospitality-extension-hours" name="hours" type="number" required min={1} max={720} className={fieldClass} value={hours} onChange={e => setHours(e.target.value)}/></Field>
    <p className="sm:col-span-2 text-sm">{formatMoney(hourly, currency)} per hour. Hours are added to the current paid end time{expectedEnd ? "" : " starting now"}.</p>
    {hourly > 0 && validHours ? <SettlementFields key={`${hourly}-${hours}`} prefix="hospitality-extension" base={hourly * Number(hours)} currency={currency} closeHref={closeHref}/> : <p className="sm:col-span-2 text-sm text-slate-600">{hourly ? "Enter 1–720 whole hours." : "Ask a room administrator to configure an hourly extension price in Rooms."}</p>}
  </HospitalityActionForm>;
}
