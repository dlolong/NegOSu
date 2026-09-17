"use client";
import { useState } from "react";
import { CreditCard } from "lucide-react";
import { chargeCentavos, cashChange } from "@/modules/hospitality/contracts";
import { formatMoney } from "@/lib/operations";
import { paymentMethods } from "@/modules/core/payments/payment.service";
import { SubmitButton } from "@/components/submit-button";
import { FormActions } from "@/components/form-actions";
import { Field, fieldClass } from "./shared";

// Display preview only: database routines resolve prices and validate every total.
export function SettlementFields({ base, currency, prefix, closeHref, depositEnabled = false, children }: { base: number; currency: string; prefix: string; closeHref: string; depositEnabled?: boolean; children?: React.ReactNode }) {
  const [price, setPrice] = useState((base / 100).toFixed(2)), [kind, setKind] = useState("none"), [deposit, setDeposit] = useState("0"), [method, setMethod] = useState("cash"), [cash, setCash] = useState("");
  const amount = (value: string) => { try { return chargeCentavos(value); } catch { return null; } };
  const final = amount(price), held = amount(deposit), due = (final ?? 0) + (held ?? 0), tendered = method === "cash" ? amount(cash) : due;
  const ready = final !== null && final <= base && held !== null && tendered !== null && tendered >= due && (final === base || kind !== "none");
  const card = ["card", "pwd", "senior"].includes(kind);
  return <>
    <h2 className="sm:col-span-2 border-t border-slate-200 pt-4 text-sm font-semibold">{depositEnabled ? "2. Collect payment" : "Payment"}</h2>
    <Field label={`Final price (${currency}) *`}><input id={`${prefix}-final-price`} name="finalPrice" required inputMode="decimal" className={fieldClass} value={price} onChange={e => { setPrice(e.target.value); if (kind === "none") setKind("manual"); }}/><span className="mt-1 block text-xs text-slate-500">Room rate: {formatMoney(base, currency)}</span></Field>
    <Field label="Discount type"><select id={`${prefix}-discount-type`} name="discountType" className={fieldClass} value={kind} onChange={e => { setKind(e.target.value); if (e.target.value === "none") setPrice((base / 100).toFixed(2)); }}><option value="none">No discount</option><option value="manual">Other / discretionary</option><option value="card">Discount card</option><option value="pwd">PWD</option><option value="senior">Senior citizen</option></select></Field>
    {card ? <Field label="Card number *" full><input id={`${prefix}-discount-card`} name="discountCard" required maxLength={80} className={fieldClass} placeholder="Number only"/></Field> : <input type="hidden" name="discountCard" value=""/>}
    {depositEnabled ? <Field label={`Refundable deposit (${currency})`}><input id={`${prefix}-deposit`} name="deposit" required inputMode="decimal" className={fieldClass} value={deposit} onChange={e => setDeposit(e.target.value)}/></Field> : <input type="hidden" name="deposit" value="0"/>}
    <Field label="Payment method *"><select id={`${prefix}-method`} name="method" className={fieldClass} value={method} onChange={e => setMethod(e.target.value)}>{paymentMethods.map(m => <option key={m} value={m}>{m.replaceAll("_", " ")}</option>)}</select></Field>
    {method === "cash" ? <><Field label={`Cash received (${currency}) *`}><input id={`${prefix}-tendered`} name="tendered" required inputMode="decimal" className={fieldClass} value={cash} onChange={e => setCash(e.target.value)} placeholder="Amount handed over"/></Field><input type="hidden" name="reference" value=""/></> : <><input type="hidden" name="tendered" value={(due / 100).toFixed(2)}/><Field label="Payment reference"><input id={`${prefix}-reference`} name="reference" maxLength={200} className={fieldClass}/></Field></>}
    <section id={`${prefix}-payment-preview`} aria-live="polite" className="sm:col-span-2 grid grid-cols-2 gap-3 rounded-xl border border-brand-border bg-brand-tint p-4">
      {[["Total to collect", due], ...(method === "cash" ? [["Change to return", cashChange(due, tendered ?? 0)]] : [])].map(([label, value], i) => <div key={i} className="min-w-0"><p className="text-xs text-slate-600">{label}</p><p id={i === 1 ? `${prefix}-change` : undefined} className="mt-1 text-xl [overflow-wrap:anywhere]">{formatMoney(Number(value), currency)}</p></div>)}
      {final !== null && final > base ? <p className="col-span-2 text-sm text-red-700">Final price cannot exceed the configured rate.</p> : null}
      {tendered !== null && tendered < due ? <p className="col-span-2 text-sm text-red-700">Still needed: {formatMoney(due - tendered, currency)}</p> : null}
    </section>
    {children}
    <details id={`${prefix}-receipt-details`} className="sm:col-span-2"><summary className="cursor-pointer py-2 text-sm text-slate-600">Paper receipt (optional)</summary><div className="mt-2">
    <Field label="Receipt number (optional)"><input id={`${prefix}-receipt-number`} name="receiptNumber" maxLength={80} className={fieldClass} placeholder="From the paper receipt"/></Field>
    </div></details>
    <p className="sm:col-span-2 text-xs text-slate-500">Confirm only after receiving payment.{depositEnabled && held ? " Return the refundable deposit at checkout." : ""}</p>
    <FormActions id={`${prefix}-actions`} cancelHref={closeHref}><SubmitButton id={`${prefix}-submit`} disabled={!ready} pendingText="Saving payment…"><CreditCard size={16}/>{depositEnabled ? "Pay & check in" : "Pay & extend stay"}</SubmitButton></FormActions>
  </>;
}
