"use client";
import { useState } from "react";
import { CreditCard } from "lucide-react";
import { checkIn } from "@/app/dashboard/hospitality/actions";
import { cashChange, chargeCentavos, type Room } from "@/modules/hospitality/contracts";
import { formatMoney } from "@/lib/operations";
import { paymentMethods } from "@/modules/core/payments/payment.service";
import { SubmitButton } from "@/components/submit-button";
import { FormActions } from "@/components/form-actions";
import { HospitalityActionForm } from "./action-form";
import { Field, fieldClass } from "./shared";

export function PaidCheckInForm({ room, guestId = "", requestKey, currency, closeHref }: { room: Room; guestId?: string; requestKey: string; currency: string; closeHref: string }) {
  const [rateId, setRateId] = useState(room.rates[0]?.id ?? "");
  const [method, setMethod] = useState("cash"), [cash, setCash] = useState("");
  const rate = room.rates.find(r => r.id === rateId);
  let cashAmount: number | null = null; try { cashAmount = chargeCentavos(cash); } catch { /* Keep input editable. */ }
  const tendered = method === "cash" ? cashAmount : rate?.priceCentavos ?? null;
  const ready = Boolean(rate && tendered !== null && tendered >= rate.priceCentavos);
  return <HospitalityActionForm id="hospitality-check-in-form" action={checkIn}>
    <input type="hidden" name="roomId" value={room.id}/><input type="hidden" name="requestKey" value={requestKey}/><input type="hidden" name="ratesVersion" value={room.rates_version}/><input type="hidden" name="guestId" value={guestId}/>
    <Field label="Stay period *" full><select id="hospitality-check-in-rate" name="rateId" required className={fieldClass} value={rateId} onChange={e => setRateId(e.target.value)}>{room.rates.map(r => <option key={r.id} value={r.id}>{r.label} · {formatMoney(r.priceCentavos, currency)}</option>)}</select></Field>
    <p className="sm:col-span-2 text-xs text-slate-500">The period starts when payment and check-in are saved. Room rates are fixed by your administrator.</p>
    <Field label="Payment method *"><select id="hospitality-check-in-method" name="method" className={fieldClass} value={method} onChange={e => setMethod(e.target.value)}>{paymentMethods.map(m => <option key={m} value={m}>{m.replaceAll("_", " ")}</option>)}</select></Field>
    {method === "cash" ? <Field label={`Cash received (${currency}) *`}><input id="hospitality-check-in-tendered" name="tendered" className={fieldClass} required inputMode="decimal" value={cash} onChange={e => setCash(e.target.value)} placeholder="Amount handed over"/></Field> : <><input type="hidden" name="tendered" value={rate ? (rate.priceCentavos / 100).toFixed(2) : ""}/><Field label="Payment reference"><input id="hospitality-check-in-reference" name="reference" className={fieldClass} maxLength={200}/></Field></>}
    {method === "cash" ? <input type="hidden" name="reference" value=""/> : null}
    <section id="hospitality-check-in-payment-preview" aria-live="polite" className="sm:col-span-2 grid grid-cols-2 gap-3 rounded-xl border border-brand-border bg-brand-tint p-4"><div className="min-w-0"><p className="text-xs text-slate-600">Room charge</p><p className="mt-1 text-xl [overflow-wrap:anywhere]">{formatMoney(rate?.priceCentavos ?? 0, currency)}</p></div><div className="min-w-0"><p className="text-xs text-slate-600">{method === "cash" ? "Change to return" : "Payment to record"}</p><p id="hospitality-check-in-change" className="mt-1 text-xl [overflow-wrap:anywhere]">{formatMoney(method === "cash" ? cashChange(rate?.priceCentavos ?? 0, cashAmount ?? 0) : rate?.priceCentavos ?? 0, currency)}</p></div>{cashAmount !== null && rate && method === "cash" && cashAmount < rate.priceCentavos ? <p className="col-span-2 text-sm text-red-700">Still needed: {formatMoney(rate.priceCentavos - cashAmount, currency)}</p> : null}</section>
    <Field label="Occupants *"><input id="hospitality-check-in-occupants" name="occupants" className={fieldClass} type="number" required min={1} max={room.capacity} defaultValue={1}/></Field>
    <details className="sm:col-span-2"><summary className="cursor-pointer py-2 text-sm text-slate-600">Optional guest name and notes</summary><div className="mt-2 space-y-3"><Field label="Guest name (optional)"><input id="hospitality-check-in-guest-name" name="guestName" maxLength={160} className={fieldClass} placeholder="Leave blank for a walk-in"/></Field><Field label="Notes"><textarea id="hospitality-check-in-notes" name="notes" maxLength={2000} className={fieldClass}/></Field></div></details>
    <p className="sm:col-span-2 text-xs text-slate-500">Save only after receiving payment. The room becomes occupied and stays occupied until you mark it checked out.</p>
    <FormActions id="hospitality-check-in-actions" cancelHref={closeHref}><SubmitButton id="hospitality-check-in-submit" disabled={!ready} pendingText="Saving payment…"><CreditCard size={16} aria-hidden="true"/>Pay & check in</SubmitButton></FormActions>
  </HospitalityActionForm>;
}
