import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, RefreshCw } from "lucide-react";
import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/operations";
import { PageHeader } from "@/components/page-patterns";
import { RecordTable } from "@/components/record-table";
import { RecordLink } from "@/components/record-item";
import { ListTabs } from "@/components/list-tabs";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
export default async function PaymentHistory({ searchParams }: { searchParams: Promise<{ tab?: string; page?: string; error?: string }> }) {
  const [{ activeMembership }, params, db] = await Promise.all([getDashboardContext(), searchParams, createClient()]);
  if (activeMembership.role !== "owner") notFound();
  const tab = ["open", "paid", "all"].includes(params.tab ?? "") ? params.tab! : "all";
  const page = Math.max(1, Math.min(10000, Number.parseInt(params.page ?? "1", 10) || 1));
  let query = db.from("billing_orders").select("id,plan_name,billing_interval,amount_centavos,status,created_at,livemode", { count: "exact" }).eq("organization_id", activeMembership.organizationId);
  if (tab === "open") query = query.in("status", ["creating", "pending", "review"]);
  if (tab === "paid") query = query.eq("status", "paid");
  const { data, count, error } = await query.order("created_at", { ascending: false }).range((page - 1) * 20, page * 20 - 1);
  const href = (number: number) => `/dashboard/settings/billing/history?tab=${tab}&page=${number}`;
  return <main id="billing-history-page" className="mx-auto w-full min-w-0 max-w-6xl"><PageHeader id="billing-history-header" eyebrow="Plans and billing" title="Plan payments" description="Track upgrades, renewals, and unfinished checkouts." action={<Button id="billing-history-plans" asChild variant="secondary"><Link href="/dashboard/settings/billing"><ArrowRight size={16} aria-hidden="true"/>View plans</Link></Button>}/><FormMessage error={params.error}/>
    <ListTabs id="billing-history-tabs" parameter="tab" baseHref="/dashboard/settings/billing/history" value={tab} query={{}} options={[{ value: "all", label: "All payments" }, { value: "open", label: "Needs attention" }, { value: "paid", label: "Paid" }]}/>
    {error ? <Card id="billing-history-error" role="alert" className="mt-5 p-5"><p>Payment history could not be loaded.</p><Button asChild id="billing-history-retry" variant="secondary" className="mt-3"><Link href={href(page)}><RefreshCw size={16} aria-hidden="true"/>Try again</Link></Button></Card> : <><RecordTable id="billing-history-table" caption="Account plan payments" columns={[{ key: "plan", label: "Plan" }, { key: "date", label: "Created", secondary: true }, { key: "amount", label: "Amount", align: "right" }, { key: "status", label: "Status", align: "right", secondary: true }]} empty="No plan payments in this view." emptyId="billing-history-empty" rows={(data ?? []).map(order => ({ id: `billing-order-${order.id}`, mobile: <span className="capitalize">{order.status === "creating" ? "Preparing checkout" : order.status === "review" ? "Needs review" : order.status}</span>, cells: { plan: <><RecordLink id={`billing-order-link-${order.id}`} href={`/dashboard/settings/billing/orders/${order.id}`}>{order.plan_name} · {order.billing_interval === "year" ? "Yearly" : "Monthly"}</RecordLink>{!order.livemode ? <p className="mt-1 text-xs text-admin-text-secondary">Test payment</p> : null}</>, date: new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: activeMembership.timezone }).format(new Date(order.created_at)), amount: formatMoney(order.amount_centavos), status: <span className="capitalize">{order.status === "creating" ? "Preparing checkout" : order.status === "review" ? "Needs review" : order.status}</span> } }))}/><div className="mt-4 flex flex-wrap items-center justify-end gap-3 text-sm"><span>{count ?? 0} payments · Page {page}</span>{page > 1 ? <Button id="billing-history-previous" asChild variant="secondary"><Link href={href(page - 1)}><ArrowRight className="rotate-180" size={16} aria-hidden="true"/>Previous</Link></Button> : null}{page * 20 < (count ?? 0) ? <Button id="billing-history-next" asChild variant="secondary"><Link href={href(page + 1)}>Next<ArrowRight size={16} aria-hidden="true"/></Link></Button> : null}</div></>}
  </main>;
}
