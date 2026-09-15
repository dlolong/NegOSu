import Link from "next/link";
import { ChevronLeft, ChevronRight, CalendarDays, RefreshCw, Search, X } from "lucide-react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-patterns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RecordRow, RecordLink } from "@/components/record-item";
import { Tabs } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { TableFrame, Table, TableHeader, TableBody, TableHead, TableCell } from "@/components/ui/table";
import { paymentView, paymentViewHref, paymentPageSize, type PaymentQuery } from "@/modules/core/payments/payment-view";
import { getDashboardContext } from "@/lib/auth/context";
import { roleHasPermission } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/operations";
import { loadPaymentWorkspace, summarizePayments, type PaymentDocument } from "@/modules/core/payments/payment-workspace";

export async function PaymentWorkspace({ query, legacyPet = false }: { query: PaymentQuery; legacyPet?: boolean }) {
  const { activeMembership: membership } = await getDashboardContext();
  if (!roleHasPermission(membership.role, "payments.record")) notFound();
  const kind = membership.industry === "automotive" ? "invoice" : "appointment";
  const appointmentsHref = membership.industry === "pet_care" ? "/dashboard/pet-care/appointments" : "/dashboard/appointments";
  const baseHref = legacyPet ? "/dashboard/pet-care/payments" : "/dashboard/payments";
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
  const view = paymentView(workspace.payments, workspace.documents, query);
  const hrefFor = (document: Pick<PaymentDocument, "id" | "kind">) => document.kind === "invoice" ? `/dashboard/invoices/${document.id}` : `${appointmentsHref}/${document.id}`;
  const date = (value: string | null) => value ? new Intl.DateTimeFormat("en-PH", { timeZone: timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Date unavailable";
  const money = (value: number) => formatMoney(value, membership.currency);
  const isHistory = view.tab === "history";
  return <main id={legacyPet ? "pet-payments-page" : "payments-page"} className="mx-auto min-w-0 max-w-6xl">
    <PageHeader id="payments-page-header" eyebrow={membership.branchName} title="Payments" description="Track what has been paid and what is still due." action={<Button asChild variant="secondary"><Link id="payments-appointments-button" href={appointmentsHref}><CalendarDays size={16} aria-hidden="true"/>View appointments</Link></Button>}/>
    <section id="payments-metrics" aria-label="Branch payment summary" className="mt-4 grid grid-cols-2 gap-3">
      <Card id="payments-collected-today" elevation="none" className="min-w-0 p-3 sm:p-4"><p className="text-xs font-medium text-admin-text-secondary sm:text-sm">Collected today</p><strong className="mt-1 block text-lg tabular-nums text-admin-text [overflow-wrap:anywhere] sm:text-2xl">{money(summary.collected)}</strong><p id="payments-count-today" className="mt-1 text-xs text-admin-text-muted">{summary.count} {summary.count === 1 ? "payment" : "payments"}</p></Card>
      <Card id="payments-outstanding-total" elevation="none" className="min-w-0 p-3 sm:p-4"><p className="text-xs font-medium text-admin-text-secondary sm:text-sm">To collect</p><strong className="mt-1 block text-lg tabular-nums text-admin-text [overflow-wrap:anywhere] sm:text-2xl">{money(summary.outstanding)}</strong><p className="mt-1 text-xs text-admin-text-muted">{view.outstandingCount} unpaid {kind === "invoice" ? "invoices" : "appointments"}</p></Card>
    </section>
    <Tabs id="payments-tabs" className="mt-5" ariaLabel="Payment views" items={[
      {id:"payments-tab-outstanding",label:"Outstanding",count:view.outstandingCount,href:paymentViewHref(baseHref,"outstanding",view.search),active:!isHistory},
      {id:"payments-tab-history",label:"History",count:view.historyCount,href:paymentViewHref(baseHref,"history",view.search),active:isHistory},
    ]}/>
    <section id={isHistory ? "payments-history-section" : "payments-outstanding-invoices"} aria-labelledby="payments-section-title" className="mt-4 min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div><h2 id="payments-section-title" className="text-base font-semibold text-admin-text">{isHistory ? "Payment history" : "Outstanding balances"}</h2><p className="mt-1 text-sm text-admin-text-secondary">{isHistory ? "Select a payment to review its invoice or appointment." : "Select a row to review the balance and record payment."}</p></div>
        <form id="payments-search-form" action={baseHref} className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto">
          <input type="hidden" name="tab" value={view.tab}/>
          <label className="relative min-w-0 flex-1 sm:w-64"><span className="sr-only">{isHistory ? "Search payments" : "Search outstanding balances"}</span><Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 text-admin-text-muted"/><input key={`${view.tab}-${view.search}`} id="payments-search-input" type="search" name="q" defaultValue={view.search} maxLength={120} placeholder={isHistory ? "Customer, reference, method…" : `Customer or ${kind}…`} className="min-h-11 w-full min-w-0 rounded-ui-md border border-admin-border bg-admin-surface py-2 pl-9 pr-3 text-sm"/></label>
          <Button id="payments-search-button" type="submit" variant="secondary" size="icon" aria-label="Search"><Search size={17} aria-hidden="true"/></Button>
          {view.search && <Button asChild variant="ghost" size="icon"><Link id="payments-search-clear" href={paymentViewHref(baseHref,view.tab)} aria-label="Clear search"><X size={17} aria-hidden="true"/></Link></Button>}
        </form>
      </div>
      {view.search && <p id="payments-search-results" role="status" className="mb-3 break-words text-sm text-admin-text-secondary">{view.count} results for “{view.search}” · Branch totals above include all records.</p>}
      {isHistory ? <TableFrame id={legacyPet ? "pet-payments-list" : "payments-list"}>
        <Table id="payments-history-table" className="table-fixed"><caption className="sr-only">Recorded payments for {membership.branchName}</caption><TableHeader><tr>
          <TableHead scope="col">Customer / record</TableHead><TableHead scope="col" className="hidden w-40 sm:table-cell">Paid on</TableHead><TableHead scope="col" className="hidden w-28 lg:table-cell">Method</TableHead><TableHead scope="col" className="hidden w-36 xl:table-cell">Reference</TableHead><TableHead scope="col" className="w-28 text-right sm:w-32">Amount</TableHead><TableHead scope="col" className="hidden w-28 text-right md:table-cell">Status</TableHead>
        </tr></TableHeader><TableBody>{view.history.map(payment => {
          const id = payment.invoice_id ?? payment.appointment_id, document = id ? view.documentById.get(id) : null;
          const href = id ? hrefFor({id,kind:payment.invoice_id ? "invoice" : "appointment"}) : null;
          return <RecordRow id={`payment-${payment.id}`} key={payment.id}>
            <TableCell className="[overflow-wrap:anywhere]">{href ? <RecordLink id={`payment-record-${payment.id}`} href={href}>{document?.customer ?? "Payment record"}</RecordLink> : <span className="font-medium">Payment record</span>}<p className="mt-1 text-xs text-admin-text-secondary">{document?.label ?? (payment.invoice_id ? "Invoice" : "Appointment")}</p><p className="mt-1 text-xs text-admin-text-muted sm:hidden">{date(payment.paid_at)}</p><p className="mt-1 text-xs text-admin-text-secondary lg:hidden">{methodLabel(payment.method)}</p>{payment.reference && <p className="mt-1 text-xs text-admin-text-muted xl:hidden">Ref: {payment.reference}</p>}</TableCell>
            <TableCell className="hidden text-xs text-admin-text-secondary sm:table-cell">{date(payment.paid_at)}</TableCell><TableCell className="hidden lg:table-cell">{methodLabel(payment.method)}</TableCell><TableCell className="hidden text-admin-text-secondary [overflow-wrap:anywhere] xl:table-cell">{payment.reference || "—"}</TableCell><TableCell className="text-right"><strong className="tabular-nums [overflow-wrap:anywhere]">{money(payment.amount_centavos)}</strong><div className="mt-2 md:hidden"><PaymentStatus status={payment.status}/></div></TableCell><TableCell className="hidden text-right md:table-cell"><PaymentStatus status={payment.status}/></TableCell>
          </RecordRow>;
        })}</TableBody></Table>
        {!view.count && <EmptyPayments id="payments-history-empty" search={view.search} text="No recorded payments yet."/>}
      </TableFrame> : <TableFrame>
        <Table id="payments-outstanding-table" className="table-fixed"><caption className="sr-only">Outstanding {kind === "invoice" ? "invoices" : "appointments"} for {membership.branchName}</caption><TableHeader><tr>
          <TableHead scope="col">Customer / record</TableHead><TableHead scope="col" className="hidden w-40 sm:table-cell">{kind === "invoice" ? "Issued on" : "Appointment"}</TableHead><TableHead scope="col" className="hidden w-32 text-right lg:table-cell">Total</TableHead><TableHead scope="col" className="hidden w-32 text-right lg:table-cell">Paid</TableHead><TableHead scope="col" className="w-28 text-right sm:w-32">Balance due</TableHead>
        </tr></TableHeader><TableBody>{view.outstanding.map(document => <RecordRow key={document.id} id={`payments-balance-${document.id}`}>
          <TableCell className="[overflow-wrap:anywhere]"><RecordLink id={`payments-document-${document.id}`} href={hrefFor(document)}>{document.customer}</RecordLink><p className="mt-1 text-xs text-admin-text-secondary">{document.label}</p><p className="mt-1 text-xs text-admin-text-muted sm:hidden">{date(document.date)}</p></TableCell><TableCell className="hidden text-xs text-admin-text-secondary sm:table-cell">{date(document.date)}</TableCell><TableCell className="hidden text-right tabular-nums lg:table-cell">{money(document.total)}</TableCell><TableCell className="hidden text-right tabular-nums lg:table-cell">{money(Math.max(0,document.total-document.balance))}</TableCell><TableCell className="text-right font-semibold tabular-nums [overflow-wrap:anywhere]">{money(document.balance)}</TableCell>
        </RecordRow>)}</TableBody></Table>
        {!view.count && <EmptyPayments id="payments-outstanding-empty" search={view.search} text="You're all caught up. No outstanding balances."/>}
      </TableFrame>}
      <nav id={isHistory ? "payments-history-pages" : "payments-outstanding-pages"} aria-label="Payment table pages" className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-admin-text-secondary"><span>{view.count ? `${view.offset+1}–${Math.min(view.offset+paymentPageSize,view.count)} of ${view.count}` : "0 records"} · Page {view.page} of {view.pages}</span><div className="flex gap-2">{view.page>1 && <Button asChild variant="secondary"><Link id="payments-previous" href={paymentViewHref(baseHref,view.tab,view.search,view.page-1)}><ChevronLeft size={16} aria-hidden="true"/>Previous</Link></Button>}{view.page<view.pages && <Button asChild variant="secondary"><Link id="payments-next" href={paymentViewHref(baseHref,view.tab,view.search,view.page+1)}>Next<ChevronRight size={16} aria-hidden="true"/></Link></Button>}</div></nav>
    </section>
    {isHistory && <details id="payments-by-method" className="mt-5 rounded-ui-lg border border-admin-border bg-admin-surface p-4"><summary className="min-h-11 content-center cursor-pointer text-sm font-medium text-admin-text-secondary">Today&apos;s collections by method</summary><dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">{summary.byMethod.map(([method,amount]) => <div key={method} className="flex justify-between gap-3"><dt>{methodLabel(method)}</dt><dd className="font-semibold tabular-nums">{money(amount)}</dd></div>)}{!summary.count && <div className="text-admin-text-muted"><dt>No payments today.</dt><dd className="sr-only">Zero collected</dd></div>}</dl></details>}
  </main>;
}
function EmptyPayments({id,search,text}:{id:string;search:string;text:string}) {return <p id={id} role="status" className="px-4 py-10 text-center text-sm text-admin-text-muted">{search ? "No matching records. Try another search or clear the filter." : text}</p>;}
function methodLabel(method:string) {return ({cash:"Cash",gcash:"GCash",maya:"Maya",bank_transfer:"Bank transfer",card:"Card",other:"Other"} as Record<string,string>)[method] ?? method.replaceAll("_"," ");}
function PaymentStatus({status}:{status:string}) {return <Badge className="max-w-full px-2 [overflow-wrap:anywhere]" variant={status === "paid" ? "success" : status === "pending" ? "warning" : status === "failed" ? "danger" : "neutral"}>{({paid:"Paid",pending:"Pending",failed:"Failed",refunded:"Refunded",voided:"Voided"} as Record<string,string>)[status] ?? status}</Badge>;}
