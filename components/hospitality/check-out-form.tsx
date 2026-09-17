import Link from "next/link";
import { CreditCard } from "lucide-react";
import { checkOut } from "@/app/dashboard/hospitality/actions";
import { HospitalityActionForm } from "./action-form";
import { ShiftStaffFields } from "./shift-staff-fields";
import { Field, fieldClass, SaveActions, LoadError } from "./shared";
import type { SelectOption } from "@/components/searchable-select";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/operations";
import { paymentMethods } from "@/modules/core/payments/payment.service";
import type { Deposit } from "@/modules/hospitality/contracts";
import type { ShiftPreferenceScope } from "@/modules/hospitality/shift-preferences";

export function CheckOutForm({ stayId, roomName, balance, deposit, currency, canWrite, canManageStaff, staff, staffError, staffScope, closeHref }: {
  stayId: string; roomName: string; balance: number | null; deposit: Deposit | null; currency: string;
  canWrite: boolean; canManageStaff: boolean; staff: SelectOption[]; staffError: boolean;
  staffScope: ShiftPreferenceScope; closeHref: string;
}) {
  const refund = deposit && !deposit.refunded_at ? deposit : null;
  return <HospitalityActionForm id="hospitality-check-out-form" action={checkOut}>
    <input type="hidden" name="stayId" value={stayId}/>
    <section id="hospitality-check-out-balance" className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h2 className="text-sm font-medium">1. Settle the stay</h2>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-sm">{balance === null ? "Ask the cashier to confirm the bill." : balance > 0 ? <>Balance to collect <strong>{formatMoney(balance, currency)}</strong></> : "No outstanding balance."}</p>
        {canWrite && balance !== null && balance > 0 ? <Button asChild variant="secondary" size="sm"><Link id="hospitality-check-out-payment-link" href={`${closeHref}?tab=charges&dialog=payment`}><CreditCard size={16}/>Record payment</Link></Button> : null}
      </div>
      {balance !== null && balance > 0 ? <label className="mt-3 flex items-start gap-3 text-sm"><input id="hospitality-check-out-debt" name="acknowledgeDebt" type="checkbox" required className="mt-1"/>Check out with this balance unpaid. It will remain due.</label> : null}
    </section>
    {refund ? <section id="hospitality-check-out-deposit" className="sm:col-span-2 space-y-3 rounded-xl border border-brand-border bg-brand-tint p-4">
      <h2 className="text-sm font-medium">Return deposit · {formatMoney(refund.amount_centavos, currency)}</h2>
      {canWrite ? <><div className="grid gap-3 sm:grid-cols-2"><Field label="Refund method"><select id="hospitality-deposit-refund-method" name="refundMethod" defaultValue={refund.method} className={fieldClass}>{paymentMethods.map(method => <option key={method} value={method}>{method.replaceAll("_", " ")}</option>)}</select></Field><Field label="Reference (optional)"><input id="hospitality-deposit-refund-reference" name="refundReference" maxLength={200} className={fieldClass}/></Field></div><label className="flex items-start gap-3 text-sm"><input id="hospitality-deposit-refund-confirm" name="confirmRefund" type="checkbox" required className="mt-1"/>I have returned the full deposit to the guest.</label></> : <p className="text-sm">A cashier, manager or owner must return the deposit and complete checkout.</p>}
    </section> : null}
    <h2 className="sm:col-span-2 text-sm font-medium">2. Confirm staff</h2>
    {staffError ? <LoadError>Staff could not be loaded. Close and reopen this form.</LoadError> : <ShiftStaffFields scope={staffScope} canManage={canManageStaff} options={staff} prefix="hospitality-check-out"/>}
    <p className="sm:col-span-2 text-sm text-slate-600">{roomName} will move to Cleaning. Mark it ready after housekeeping finishes.</p>
    {(!refund || canWrite) && !staffError && staff.length > 0 ? <SaveActions id="hospitality-check-out" label="Confirm checkout" closeHref={closeHref}/> : null}
  </HospitalityActionForm>;
}
