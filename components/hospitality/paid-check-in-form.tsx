"use client";
import type { ShiftPreferenceScope } from "@/modules/hospitality/shift-preferences";
import { useState } from "react";
import { checkIn } from "@/app/dashboard/hospitality/actions";
import { type Room } from "@/modules/hospitality/contracts";
import { formatMoney } from "@/lib/operations";
import { HospitalityActionForm } from "./action-form";
import { Field, fieldClass } from "./shared";
import { ShiftStaffFields } from "./shift-staff-fields";
import type { SelectOption } from "@/components/searchable-select";
import { SettlementFields } from "./settlement-fields";

export function PaidCheckInForm({ room, guestId = "", requestKey, currency, closeHref, staff, canManageStaff, staffScope }: { staffScope: ShiftPreferenceScope; room: Room; guestId?: string; requestKey: string; currency: string; closeHref: string; staff: SelectOption[]; canManageStaff: boolean }) {
  const [rateId, setRateId] = useState(room.rates[0]?.id ?? "");
  const rate = room.rates.find(r => r.id === rateId);
  return <HospitalityActionForm id="hospitality-check-in-form" action={checkIn}>
    <input type="hidden" name="roomId" value={room.id}/><input type="hidden" name="requestKey" value={requestKey}/><input type="hidden" name="ratesVersion" value={room.rates_version}/><input type="hidden" name="guestId" value={guestId}/>
    <h2 className="sm:col-span-2 text-sm font-semibold">1. Choose the stay</h2>
    <Field label="Stay period *" full><select id="hospitality-check-in-rate" name="rateId" required className={fieldClass} value={rateId} onChange={e => setRateId(e.target.value)}>{room.rates.map(r => <option key={r.id} value={r.id}>{r.label} · {formatMoney(r.priceCentavos, currency)}</option>)}</select></Field>
    <p className="sm:col-span-2 text-xs text-slate-500">The period starts when check-in is saved. {rate?.extensionHourlyCentavos ? `Extra hours: ${formatMoney(rate.extensionHourlyCentavos, currency)} per hour.` : ""}</p>
    {rate && staff.length ? <SettlementFields key={rate.id} prefix="hospitality-check-in" base={rate.priceCentavos} currency={currency} closeHref={closeHref} depositEnabled>
      <h2 className="sm:col-span-2 text-sm font-semibold">3. Confirm staff</h2>
      <ShiftStaffFields scope={staffScope} canManage={canManageStaff} options={staff} prefix="hospitality-check-in"/>
      <details id="hospitality-check-in-optional" className="sm:col-span-2"><summary className="cursor-pointer py-2 text-sm text-slate-600">Guest details & notes (optional)</summary><div className="mt-2 grid gap-3 sm:grid-cols-2"><Field label={`Occupants (up to ${room.capacity})`}><input id="hospitality-check-in-occupants" name="occupants" className={fieldClass} type="number" required min={1} max={room.capacity} defaultValue={1}/></Field>
<Field label="Guest name (optional)"><input id="hospitality-check-in-guest-name" name="guestName" maxLength={160} className={fieldClass} placeholder="Leave blank for a walk-in"/></Field><Field label="Notes"><textarea id="hospitality-check-in-notes" name="notes" maxLength={2000} className={fieldClass}/></Field></div></details>
    </SettlementFields> : <ShiftStaffFields scope={staffScope} canManage={canManageStaff} options={staff} prefix="hospitality-check-in"/>}
  </HospitalityActionForm>;
}
