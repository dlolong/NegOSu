import { Receipt as ReceiptIcon, Save as SaveIcon, Undo2 as Undo2Icon } from "lucide-react";

import { FormActions } from "@/components/form-actions";
import { notFound } from "next/navigation";
import { recordPayment, reversePayment, voidInvoice } from "@/app/dashboard/job-actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getDashboardContext } from "@/lib/auth/context";
import { formatMoney } from "@/lib/operations";
import { createClient } from "@/lib/supabase/server";
import { verticalBrands } from "@/modules/platform/brand";

export default async function Page({params,searchParams}:{params:Promise<{invoiceId:string}>;searchParams:Promise<{message?:string;error?:string}>}) {
  const [{invoiceId},query,{activeMembership},supabase]=await Promise.all([params,searchParams,getDashboardContext(),createClient()]);
  if (activeMembership.industry === "hospitality") {
    const { data: link } = await supabase.from("hospitality_stay_bills").select("stay_id").eq("organization_id", activeMembership.organizationId).eq("invoice_id", invoiceId).maybeSingle();
    if (!link) notFound();
    const { redirect } = await import("next/navigation"); redirect(`/dashboard/hospitality/stays/${link.stay_id}?tab=charges`);
  }
  const [{data:invoice},{data:payments}]=await Promise.all([
    supabase.from("invoices").select("*,invoice_items(*)").eq("id",invoiceId).eq("organization_id",activeMembership.organizationId).maybeSingle(),
    supabase.from("payments").select("id,currency,amount_centavos,method,status,reference,paid_at,notes").eq("invoice_id",invoiceId).order("paid_at"),
  ]);
  if(!invoice) notFound();
  const canPay=["owner","manager","cashier"].includes(activeMembership.role),canVoid=["owner","manager"].includes(activeMembership.role);
  return <div className="mx-auto max-w-3xl"><p className="text-sm font-medium text-brand-primary">Invoice</p><h1 className="text-3xl font-medium">{invoice.invoice_number}</h1><p className="text-zinc-600">{invoice.customer_name_snapshot} · {invoice.vehicle_snapshot}</p><FormMessage {...query}/>
    <Card className="mt-6 p-6"><div className="flex justify-between"><strong className="capitalize">{invoice.status.replaceAll("_"," ")}</strong><span>{invoice.issued_at?new Intl.DateTimeFormat("en-PH",{dateStyle:"medium"}).format(new Date(invoice.issued_at)):"Draft"}</span></div><div className="mt-5 space-y-2">{invoice.invoice_items.map((item:{id:string;description_snapshot:string;quantity:number;line_total_centavos:number})=><div key={item.id} className="flex justify-between border-b py-2"><span>{item.description_snapshot} × {item.quantity}</span><strong>{formatMoney(item.line_total_centavos, activeMembership.currency)}</strong></div>)}</div><dl className="ml-auto mt-5 grid max-w-xs grid-cols-2 gap-2 text-right"><dt>Total</dt><dd>{formatMoney(invoice.total_centavos, activeMembership.currency)}</dd><dt>Paid</dt><dd>{formatMoney(invoice.paid_centavos, activeMembership.currency)}</dd><dt className="font-medium">Balance</dt><dd className="font-medium">{formatMoney(invoice.balance_centavos, activeMembership.currency)}</dd></dl></Card>
    {canPay&&invoice.balance_centavos>0&&!['void'].includes(invoice.status)&&<Card className="mt-5 p-6 print:hidden"><h2 className="font-medium">Record manual payment</h2><p className="mt-1 text-xs text-zinc-500">GCash, Maya, bank, and card record externally received payments; {verticalBrands.automotive.displayName} does not initiate a gateway charge.</p><form action={recordPayment} className="mt-4 grid gap-3 sm:grid-cols-2"><input type="hidden" name="invoiceId" value={invoice.id}/><label>Amount ({activeMembership.currency})<Input required name="amount" inputMode="decimal" max={(invoice.balance_centavos/100).toFixed(2)}/></label><label>Method<select className="mt-2 min-h-11 w-full rounded-xl border bg-white px-3" name="method">{["cash","gcash","maya","bank_transfer","card","other"].map(method=><option key={method} value={method}>{method.replaceAll("_"," ")}</option>)}</select></label><label>Reference<Input name="reference"/></label><label>Notes<Input name="notes"/></label><FormActions id="record-payment-actions"><SubmitButton id="record-payment-save-button" pendingText="Recording…"><SaveIcon aria-hidden="true" size={16} className="shrink-0"/>Record payment</SubmitButton></FormActions></form></Card>}
    <Card className="mt-5 p-6"><h2 className="font-medium">Receipts and reversals</h2><div className="mt-3 space-y-3">{payments?.map(payment=><div className="rounded-xl border p-3 text-sm" key={payment.id}><div className="flex justify-between"><span className="capitalize">{payment.method.replaceAll("_"," ")} · {payment.status}{payment.reference&&` · ${payment.reference}`}</span><strong>{formatMoney(payment.amount_centavos, payment.currency)}</strong></div>{canPay&&payment.status==="paid"&&<form action={reversePayment} className="mt-3 grid gap-2 sm:grid-cols-[auto_1fr_auto]"><input type="hidden" name="invoiceId" value={invoice.id}/><input type="hidden" name="paymentId" value={payment.id}/><select className="min-h-11 rounded-xl border bg-white px-3" name="action"><option value="refund">Refund</option><option value="void">Void entry</option></select><Input required name="note" placeholder="Required reason"/><FormActions id={`invoice-payment-reversal-${payment.id}-actions`}><SubmitButton id={`invoice-payment-reversal-${payment.id}-save-button`} pendingText="Reversing…" variant="destructive"><Undo2Icon aria-hidden="true" size={16} className="shrink-0"/>Reverse</SubmitButton></FormActions></form>}</div>)}{!payments?.length&&<p className="text-sm text-zinc-500">No payments recorded.</p>}</div></Card>
    {canVoid&&invoice.paid_centavos===0&&['draft','issued'].includes(invoice.status)&&<Card className="mt-5 p-6 print:hidden"><h2 className="font-medium">Void invoice</h2><form action={voidInvoice} className="mt-3 grid gap-2"><input type="hidden" name="invoiceId" value={invoice.id}/><Input required name="reason" placeholder="Required void reason"/><FormActions id="void-invoice-actions"><SubmitButton id="void-invoice-save-button" pendingText="Voiding…" variant="destructive"><ReceiptIcon aria-hidden="true" size={16} className="shrink-0"/>Void invoice</SubmitButton></FormActions></form></Card>}
  </div>;
}
