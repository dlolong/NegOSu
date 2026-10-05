import { PageTitle } from "@/components/page-title";
import {CheckoutPrintButton} from "@/components/checkout-print-button";
import Link from "next/link";
import {ArrowLeft, FileText} from "lucide-react";
import {Button} from "@/components/ui/button";
import {loadCheckout} from "@/modules/core/checkout/runtime";
import {CheckoutOrder,CheckoutSummary} from "@/components/checkout-summary";
import {FormMessage} from "@/components/form-message";
import {formatMoney} from "@/lib/operations";
export default async function Page({params,searchParams}:{params:Promise<{checkoutId:string}>;searchParams:Promise<{message?:string}>}){
 const [{checkoutId},q]=await Promise.all([params,searchParams]);const {checkout:c,m}=await loadCheckout(checkoutId);
 return <main id="checkout-receipt" className="mx-auto min-w-0 max-w-3xl"><div className="space-y-4 print:hidden">
  <nav aria-label="Receipt actions" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">

   <Button asChild variant="secondary" className="w-full sm:w-auto"><Link id="receipt-back-transaction" href={c.appointmentId?`/dashboard/${m.industry==="pet_care"?"pet-care/":""}appointments/${c.appointmentId}`:c.sourceInvoiceId?`/dashboard/invoices/${c.sourceInvoiceId}`:"/dashboard/checkout/new"}><FileText className="size-4 shrink-0" aria-hidden="true"/>View transaction</Link></Button>
   <CheckoutPrintButton/>
  </nav>
  <FormMessage message={q.message}/>
 </div><header className="my-5"><PageTitle back={<Button asChild variant="secondary" className=""><Link id="receipt-back-checkout" href={`/dashboard/checkout/${c.id}`}><ArrowLeft className="size-4 shrink-0" aria-hidden="true"/>Back to checkout</Link></Button>} className="text-2xl">{m.organizationName}</PageTitle><p>{m.branchName}</p><h2 className="mt-4 text-xl">{c.hasDraft||c.balance>0?"Order statement":"Payment receipt"}</h2><p>{c.customer}</p><p className="text-sm">{new Intl.DateTimeFormat("en-PH",{timeZone:m.timezone,dateStyle:"medium",timeStyle:"short"}).format(new Date(c.createdAt))}</p><p className="text-sm">{c.invoices.map(i=>i.number).join(" · ")}</p></header><div className="space-y-4"><CheckoutOrder checkout={c}/><CheckoutSummary checkout={c}/><section className="rounded-xl border border-admin-border bg-white p-4"><h2>Payments</h2>{c.payments.map(p=><div key={p.id} className="flex flex-wrap justify-between gap-2 border-b py-3 text-sm"><span>{new Intl.DateTimeFormat("en-PH",{timeZone:m.timezone,dateStyle:"medium"}).format(new Date(p.date))} · {p.method.replaceAll("_"," ")} · {p.status}{p.reference?` · ${p.reference}`:""}</span><span>{formatMoney(p.amount,p.currency)}</span></div>)}{!c.payments.length?<p className="mt-3 text-sm">No payments recorded.</p>:null}</section></div><p className="mt-4 text-sm">Payment does not confirm product handover or complete a visit, vehicle release, pet collection or room checkout.</p></main>;
}
