import { PageTitle } from "@/components/page-title";
import Link from "next/link";
import {ShoppingBag, ArrowLeft, ArrowRight, Clock3, UserRound} from "lucide-react";
import {createClient} from "@/lib/supabase/server";
import {randomUUID} from "node:crypto";
import {notFound} from "next/navigation";
import {getDashboardContext} from "@/lib/auth/context";
import {checkoutRoles} from "@/modules/core/checkout/contracts";
import {openCheckout} from "../actions";
import {SearchableSelect} from "@/components/searchable-select";
import {Button} from "@/components/ui/button";
import {SubmitButton} from "@/components/submit-button";
import {FormMessage} from "@/components/form-message";

export default async function Page({searchParams}:{searchParams:Promise<{error?:string}>}) {
 const {activeMembership:m}=await getDashboardContext();
 if(!checkoutRoles.includes(m.role))notFound();
 const db=await createClient();
 const recent=await db.from("checkouts").select("id,customer_name,created_at").eq("organization_id",m.organizationId).eq("branch_id",m.branchId).order("created_at",{ascending:false}).limit(20);
 return <main id="product-new-sale-page" className="mx-auto max-w-5xl space-y-5">
  <header className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-sm text-admin-text-secondary">{m.branchName} · Product sales</p><PageTitle back={<Button asChild variant="secondary" className="shrink-0"><Link id="product-new-sale-back" href="/dashboard"><ArrowLeft size={16} aria-hidden="true"/>Back</Link></Button>} className="mt-1 text-2xl font-semibold">New product sale</PageTitle><p className="mt-2 text-sm text-admin-text-secondary">Choose products, review the order, and collect payment.</p></div></header>
  <FormMessage {...await searchParams}/>
  <div className="grid items-start gap-5 lg:grid-cols-2">
   <section className="rounded-xl border border-admin-border bg-admin-surface p-5 sm:p-6">
    <div className="flex items-center gap-3"><ShoppingBag className="size-6 text-brand-primary" aria-hidden="true"/><h2 className="text-lg font-medium">Start a sale</h2></div>
    <p className="mt-3 text-sm text-admin-text-secondary">No customer name or mobile number needed. Leave the customer blank for a walk-in purchase.</p>
    <form action={openCheckout} className="mt-5 space-y-5">
     <input type="hidden" name="request" value={randomUUID()}/>
     <div><label className="flex items-center gap-2 text-sm font-medium" htmlFor="checkout-customer-select"><UserRound className="size-4" aria-hidden="true"/>Customer <span className="font-normal text-admin-text-secondary">(optional)</span></label><SearchableSelect id="checkout-customer-select" name="customerId" lookup="customer" options={[]} placeholder="Search an existing customer"/><p className="mt-2 text-sm text-admin-text-secondary">Select a customer only if you want their name on the receipt.</p></div>
     <SubmitButton id="product-new-sale-button" className="w-full" pendingText="Opening sale…">Choose products<ArrowRight className="size-4" aria-hidden="true"/></SubmitButton>
    </form>
   </section>
   <section className="min-w-0 rounded-xl border border-admin-border bg-admin-surface p-5 sm:p-6">
    <h2 className="flex items-center gap-2 text-lg font-medium"><Clock3 className="size-5 text-brand-primary" aria-hidden="true"/>Recent checkouts</h2><p className="mt-2 text-sm text-admin-text-secondary">Resume an order or view its payments and receipt.</p>
    {recent.error?<p role="alert" className="mt-4 text-sm">Recent checkouts could not be loaded. Refresh to try again.</p>:recent.data?.length?<div className="mt-4 divide-y divide-admin-border">{recent.data.map(c=><Link key={c.id} id={`recent-checkout-${c.id}`} className="flex min-h-14 items-center gap-3 rounded-lg py-3 text-sm transition-colors hover:bg-admin-surface-muted focus-visible:outline-brand-primary" href={`/dashboard/checkout/${c.id}`}><span className="min-w-0 flex-1"><span className="block truncate font-medium">{c.customer_name}</span><span className="mt-1 block text-admin-text-secondary">{new Intl.DateTimeFormat("en-PH",{timeZone:m.timezone,dateStyle:"medium",timeStyle:"short"}).format(new Date(c.created_at))}</span></span><ArrowRight className="size-4 shrink-0" aria-hidden="true"/></Link>)}</div>:<p className="mt-5 rounded-lg bg-admin-surface-muted p-4 text-sm text-admin-text-secondary">No checkouts yet. Start your first product sale here.</p>}
   </section>
  </div>
 </main>;
}
