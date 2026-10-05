import { CompactFilters } from "@/components/compact-filters";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CalendarDays, RefreshCw, Search, X } from "lucide-react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-patterns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RecordLink } from "@/components/record-item";
import { Tabs } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { RecordTable } from "@/components/record-table";
import { paymentView, paymentViewHref, paymentPageSize, type PaymentQuery } from "@/modules/core/payments/payment-view";
import { getDashboardContext } from "@/lib/auth/context";
import { roleHasPermission } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/operations";
import { loadPaymentWorkspace, summarizePayments, collectionsByCurrency, type PaymentDocument } from "@/modules/core/payments/payment-workspace";

export async function PaymentWorkspace({ query, legacyPet = false, allBills = false }: { query: PaymentQuery; legacyPet?: boolean; allBills?: boolean }) {
  const { activeMembership: membership } = await getDashboardContext();
  if (!roleHasPermission(membership.role, "payments.record")) notFound();
  const kind = ["automotive","hospitality"].includes(membership.industry) ? "invoice" : "appointment";
  const appointmentsHref = membership.industry === "pet_care" ? "/dashboard/pet-care/appointments" : "/dashboard/appointments";
  const baseHref = allBills ? "/dashboard/payments/ledger" : legacyPet ? "/dashboard/pet-care/payments" : "/dashboard/payments";
  let workspace: Awaited<ReturnType<typeof loadPaymentWorkspace>>;
  let timezone = membership.timezone;
  try {
    const db = await createClient();
    const branch = await db.from("branches").select("timezone").eq("organization_id", membership.organizationId).eq("id", membership.branchId).single();
    if (branch.error || !branch.data) throw new Error("Branch unavailable");
    timezone = branch.data.timezone;
    workspace = await loadPaymentWorkspace(db, membership.organizationId, membership.branchId, kind);
  } catch {
    return <main id={legacyPet ? "pet-payments-page" : "payments-page"} className="mx-auto min-w-0 max-w-6xl"><PageHeader id="payments-page-header" title="Payments"/><Card className="mt-4 p-5"><p id="payments-load-error" role="alert">Could not load payments. Try again.</p><Button asChild variant="secondary" className="mt-3"><Link id="payments-retry-button" href={baseHref}><RefreshCw size={16} aria-hidden="true"/>Retry</Link></Button></Card></main>;
  }
  const summary = summarizePayments(workspace.payments, workspace.documents, timezone);
  const collections = collectionsByCurrency(workspace.payments, timezone, membership.currency);
  const view = paymentView(workspace.payments, workspace.documents, query);
  const hrefFor = (document: Pick<PaymentDocument, "id" | "kind">) => document.kind === "invoice" ? `/dashboard/invoices/${document.id}` : `${appointmentsHref}/${document.id}`;
  const date = (value: string | null) => value ? new Intl.DateTimeFormat("en-PH", { timeZone: timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Date unavailable";
  const money = (value: number) => formatMoney(value, membership.currency);
  const isHistory = view.tab === "history";
  return <main id={legacyPet ? "pet-payments-page" : "payments-page"} className="mx-auto min-w-0 max-w-6xl">
    <PageHeader id="payments-page-header" eyebrow={membership.branchName} title="Payments" description="Track what has been paid and what is still due." action={<Button asChild variant="secondary"><Link id="payments-appointments-button" href={appointmentsHref}><CalendarDays size={16} aria-hidden="true"/>View appointments</Link></Button>}/>
    <Button asChild variant="secondary" className="mt-3"><Link id="payments-new-sale-button" href="/dashboard/checkout/new">New product sale</Link></Button>
    <section id="payments-metrics" aria-label="Branch payment summary" className="mt-4 grid grid-cols-2 gap-3">
      <Card id="payments-collected-today" elevation="none" className="min-w-0 p-3 sm:p-4"><p className="text-xs font-medium text-admin-text-secondary sm:text-sm">Collected today</p><strong className="mt-1 block text-lg tabular-nums text-admin-text [overflow-wrap:anywhere] sm:text-2xl">{collections.map(group => <span className="block" key={group.currency}>{formatMoney(group.collected, group.currency)}</span>)}</strong><p id="payments-count-today" className="mt-1 text-xs text-admin-text-muted">{summary.count} {summary.count === 1 ? "payment" : "payments"}</p></Card>
      <Card id="payments-outstanding-total" elevation="none" className="min-w-0 p-3 sm:p-4"><p className="text-xs font-medium text-admin-text-secondary sm:text-sm">To collect</p><strong className="mt-1 block text-lg tabular-nums text-admin-text [overflow-wrap:anywhere] sm:text-2xl">{money(summary.outstanding)}</strong><p className="mt-1 text-xs text-admin-text-muted">{view.outstandingCount} unpaid {kind === "invoice" ? "invoices" : "appointments"}</p></Card>
    </section>
    <Tabs id="payments-tabs" className="mt-5" ariaLabel="Payment views" items={[
      {id:"payments-tab-outstanding",label:"Outstanding",count:view.outstandingCount,href:paymentViewHref(baseHref,"outstanding",view.search),active:!isHistory},
      {id:"payments-tab-history",label:"History",count:view.historyCount,href:paymentViewHref(baseHref,"history",view.search),active:isHistory},
    ]}/>
    <section id={isHistory ? "payments-history-section" : "payments-outstanding-invoices"} aria-labelledby="payments-section-title" className="mt-4 min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div><h2 id="payments-section-title" className="text-base font-medium text-admin-text">{isHistory ? "Payment history" : "Outstanding balances"}</h2><p className="mt-1 text-sm text-admin-text-secondary">{isHistory ? "Select a payment to review its invoice or appointment." : "Select a row to review the balance and record payment."}</p></div>
        <CompactFilters id="payments-search-form" action={baseHref} searchLabel="Search payments" search={<input key={`${view.tab}-${view.search}`} id="payments-search-input"  name="q" defaultValue={view.search} maxLength={120} placeholder={isHistory ? "Customer, reference, method…" : `Customer or ${kind}…`} type="search" enterKeyHint="search" className="min-h-11 w-full min-w-0 rounded-ui-md border border-admin-border bg-admin-surface px-3 py-2 text-sm"/>} searchValue={view.search} clearAction={view.search && <Button asChild variant="ghost" size="icon"><Link id="payments-search-clear" href={paymentViewHref(baseHref,view.tab)} aria-label="Clear search"><X size={17} aria-hidden="true"/></Link></Button>} hiddenFields={<><input type="hidden" name="tab" value={view.tab}/></>}>


          <Button id="payments-search-button" type="submit" variant="secondary" size="icon" aria-label="Search"><Search size={17} aria-hidden="true"/></Button>

        </CompactFilters>
      </div>
      {view.search && <p id="payments-search-results" role="status" className="mb-3 break-words text-sm text-admin-text-secondary">{view.count} results for “{view.search}” · Branch totals above include all records.</p>}
      {isHistory ? <div id={legacyPet ? "pet-payments-list" : "payments-list"}><RecordTable id="payments-history-table" caption={`Recorded payments for ${membership.branchName}`} emptyId="payments-history-empty" empty={view.search ? "No matching records. Try another search." : "No recorded payments yet."} columns={[{key:"customer",label:"Customer / record"},{key:"date",label:"Paid on",secondary:true},{key:"method",label:"Method",secondary:true},{key:"reference",label:"Reference",secondary:true},{key:"status",label:"Status",secondary:true},{key:"amount",label:"Amount",align:"right"}]} rows={view.history.map(payment=>{
        const id = payment.invoice_id ?? payment.appointment_id, document = id ? view.documentById.get(id) : null;
        const href = id ? hrefFor({id,kind:payment.invoice_id ? "invoice" : "appointment"}) : null;
        return {id:`payment-${payment.id}`,cells:{customer:<>{href ? <RecordLink id={`payment-record-${payment.id}`} href={href}>{document?.customer ?? "Payment record"}</RecordLink> : <strong>Payment record</strong>}<p className="text-xs">{document?.label ?? (payment.invoice_id ? "Invoice" : "Appointment")}</p></>,date:date(payment.paid_at),method:methodLabel(payment.method),reference:payment.reference || "—",status:<PaymentStatus status={payment.status}/>,amount:formatMoney(payment.amount_centavos,payment.currency??membership.currency)},mobile:<><p>{date(payment.paid_at)} · {methodLabel(payment.method)}</p>{payment.reference ? <p>Ref: {payment.reference}</p> : null}<PaymentStatus status={payment.status}/></>};
      })}/></div> : <RecordTable id="payments-outstanding-table" caption="Outstanding balances" emptyId="payments-outstanding-empty" empty={view.search ? "No matching records. Try another search." : "You're all caught up. No outstanding balances."} columns={[{key:"customer",label:"Customer / record"},{key:"date",label:kind === "invoice" ? "Issued on" : "Appointment",secondary:true},{key:"total",label:"Total",secondary:true},{key:"paid",label:"Paid",secondary:true},{key:"balance",label:"Balance due",align:"right"}]} rows={view.outstanding.map(document=>({id:`payments-balance-${document.id}`,cells:{customer:<><RecordLink id={`payments-document-${document.id}`} href={hrefFor(document)}>{document.customer}</RecordLink><p className="text-xs">{document.label}</p></>,date:date(document.date),total:money(document.total),paid:money(Math.max(0,document.total-document.balance)),balance:money(document.balance)},mobile:<><p>{date(document.date)}</p><p>Total {money(document.total)} · Paid {money(Math.max(0,document.total-document.balance))}</p></>}))}/>}
      <nav id={isHistory ? "payments-history-pages" : "payments-outstanding-pages"} aria-label="Payment table pages" className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-admin-text-secondary"><span>{view.count ? `${view.offset+1}–${Math.min(view.offset+paymentPageSize,view.count)} of ${view.count}` : "0 records"} · Page {view.page} of {view.pages}</span><div className="flex gap-2">{view.page>1 && <Button asChild variant="secondary"><Link id="payments-previous" href={paymentViewHref(baseHref,view.tab,view.search,view.page-1)}><ChevronLeft size={16} aria-hidden="true"/>Previous</Link></Button>}{view.page<view.pages && <Button asChild variant="secondary"><Link id="payments-next" href={paymentViewHref(baseHref,view.tab,view.search,view.page+1)}>Next<ChevronRight size={16} aria-hidden="true"/></Link></Button>}</div></nav>
    </section>
    {isHistory && <details id="payments-by-method" className="mt-5 rounded-ui-lg border border-admin-border bg-admin-surface p-4"><summary className="min-h-11 content-center cursor-pointer text-sm font-medium text-admin-text-secondary">Today&apos;s collections by method</summary><dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">{collections.flatMap(group => group.byMethod.map(([method,amount]) => <div key={`${group.currency}-${method}`} className="flex justify-between gap-3"><dt>{methodLabel(method)}</dt><dd className="font-medium tabular-nums">{formatMoney(amount, group.currency)}</dd></div>))}{!summary.count && <div className="text-admin-text-muted"><dt>No payments today.</dt><dd className="sr-only">Zero collected</dd></div>}</dl></details>}
  </main>;
}

function methodLabel(method:string) {return ({cash:"Cash",gcash:"GCash",maya:"Maya",bank_transfer:"Bank transfer",card:"Card",other:"Other"} as Record<string,string>)[method] ?? method.replaceAll("_"," ");}
function PaymentStatus({status}:{status:string}) {return <Badge className="max-w-full px-2 [overflow-wrap:anywhere]" variant={status === "paid" ? "success" : status === "pending" ? "warning" : status === "failed" ? "danger" : "neutral"}>{({paid:"Paid",pending:"Pending",failed:"Failed",refunded:"Refunded",voided:"Voided"} as Record<string,string>)[status] ?? status}</Badge>;}
