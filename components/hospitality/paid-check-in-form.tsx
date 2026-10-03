"use client";
import { SettingsFormSection } from "@/components/settings-form-section";
import type { ShiftPreferenceScope } from "@/modules/hospitality/shift-preferences";
import { useState } from "react";
import { checkIn } from "@/app/dashboard/hospitality/actions";
import { type Room } from "@/modules/hospitality/contracts";
import { formatMoney } from "@/lib/operations";
import { HospitalityActionForm } from "./action-form";
import { Field, fieldClass } from "./shared";
import { ShiftStaffFields } from "./shift-staff-fields";
import { SearchableSelect, type SelectOption } from "@/components/searchable-select";
import { SettlementFields } from "./settlement-fields";

export function PaidCheckInForm({ room, guestId = "", requestKey, currency, closeHref, staff, canManageStaff, staffScope, timezone, manual = false }: { manual?: boolean; timezone: string; staffScope: ShiftPreferenceScope; room: Room; guestId?: string; requestKey: string; currency: string; closeHref: string; staff: SelectOption[]; canManageStaff: boolean }) {
  const [rateId, setRateId] = useState(room.rates[0]?.id ?? "");
  const [alreadyCheckedOut, setAlreadyCheckedOut] = useState(false);
  const rate = room.rates.find(r => r.id === rateId);
  return <HospitalityActionForm id="hospitality-check-in-form" action={checkIn}>
    <input type="hidden" name="roomId" value={room.id}/><input type="hidden" name="requestKey" value={requestKey}/><input type="hidden" name="ratesVersion" value={room.rates_version}/><input type="hidden" name="guestId" value={guestId}/>
    <SettingsFormSection id="hospitality-check-in-stay-section" title="Stay details">
    {manual ? <><input type="hidden" name="bookingMode" value="past"/><Field label={`Check-in date and time (${timezone}) *`} full><input id="hospitality-check-in-date-time" name="checkedInLocal" type="datetime-local" required className={fieldClass}/></Field>
    <label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2"><input id="hospitality-past-booking-checked-out" type="checkbox" name="alreadyCheckedOut" checked={alreadyCheckedOut} onChange={event => setAlreadyCheckedOut(event.target.checked)}/>Guest already checked out</label>
    {alreadyCheckedOut ? <Field label={`Checkout date and time (${timezone}) *`} full><input id="hospitality-past-booking-checkout-time" name="checkedOutLocal" type="datetime-local" required className={fieldClass}/></Field> : null}</> : null}
    <Field label="Stay period *" full><select id="hospitality-check-in-rate" name="rateId" required className={fieldClass} value={rateId} onChange={e => setRateId(e.target.value)}>{room.rates.map(r => <option key={r.id} value={r.id}>{r.label} · {formatMoney(r.priceCentavos, currency)}</option>)}</select></Field>
    <p className="sm:col-span-2 text-xs text-slate-500">{manual ? "Record a previous stay missed during an emergency. Dates must be in the past and cannot overlap recorded stays. Completed stays do not change the room’s current status. Payment and staff audit records use the time this entry is saved." : "The period starts when check-in is saved."} {rate?.extensionHourlyCentavos ? `Extra hours: ${formatMoney(rate.extensionHourlyCentavos, currency)} per hour.` : ""}</p>
    </SettingsFormSection>
    {rate && staff.length ? <SettlementFields key={rate.id} prefix="hospitality-check-in" base={rate.priceCentavos} currency={currency} closeHref={closeHref} depositEnabled recording={manual} submitLabel={manual ? "Save previous booking" : undefined}>
      <ShiftStaffFields scope={staffScope} canManage={canManageStaff} options={staff} prefix="hospitality-check-in"/>
      {manual && alreadyCheckedOut ? <fieldset id="hospitality-past-booking-checkout-details" className="sm:col-span-2 rounded-xl border border-slate-200 p-4"><legend className="px-1 text-sm font-medium">Checkout details</legend><div className="grid gap-3 sm:grid-cols-2">
        <Field label="Cashier at checkout *"><SearchableSelect id="hospitality-past-checkout-cashier" name="checkoutCashierStaffId" options={staff} required placeholder="Select cashier…"/></Field>
        <Field label="Housekeeper at checkout *"><SearchableSelect id="hospitality-past-checkout-housekeeper" name="checkoutHousekeeperStaffId" options={staff} required placeholder="Select housekeeper…"/></Field>
        <label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2"><input id="hospitality-past-deposit-returned" name="confirmPastRefund" type="checkbox"/>Any refundable deposit collected was returned in full</label>
        <Field label="Deposit return method"><select id="hospitality-past-refund-method" name="pastRefundMethod" className={fieldClass} defaultValue="cash"><option value="cash">Cash</option><option value="gcash">GCash</option><option value="maya">Maya</option><option value="bank_transfer">Bank transfer</option><option value="card">Card</option><option value="other">Other</option></select></Field>
        <Field label="Deposit return reference"><input id="hospitality-past-refund-reference" name="pastRefundReference" maxLength={200} className={fieldClass}/></Field>
        <p className="text-xs text-slate-500 sm:col-span-2">Deposit return confirmation is required only when a deposit was collected. This records a past return; it does not send money.</p>
      </div></fieldset> : null}
      <details id="hospitality-check-in-optional" className="sm:col-span-2"><summary className="cursor-pointer py-2 text-sm text-slate-600">Guest details & notes (optional)</summary><div className="mt-2 grid gap-3 sm:grid-cols-2"><Field label={`Occupants (up to ${room.capacity})`}><input id="hospitality-check-in-occupants" name="occupants" className={fieldClass} type="number" required min={1} max={room.capacity} defaultValue={1}/></Field>
<Field label="Guest name (optional)"><input id="hospitality-check-in-guest-name" name="guestName" maxLength={160} className={fieldClass} placeholder="Leave blank for a walk-in"/></Field><Field label="Notes"><textarea id="hospitality-check-in-notes" name="notes" maxLength={2000} className={fieldClass}/></Field></div></details>
    </SettlementFields> : <ShiftStaffFields scope={staffScope} canManage={canManageStaff} options={staff} prefix="hospitality-check-in"/>}
  </HospitalityActionForm>;
}
