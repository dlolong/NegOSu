import Link from "next/link";
import { notFound } from "next/navigation";
import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/operations";
import { historyPage } from "@/modules/core/crm/client-reminders";
import { quantityAmountCentavos } from "@/modules/core/commerce/quantity";
import { resolvePublicProductOrder } from "./actions";
import { HistoryNavigation } from "@/components/client-reminder-rows";
import { PageHeader } from "@/components/page-patterns";
import { ListTabs } from "@/components/list-tabs";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { RecordTable } from "@/components/record-table";
import { ListingFilters } from "@/components/listing-filters";
import { listingOrSearch, listingDate, listingDateEnd } from "@/lib/listing-query";
import { Button } from "@/components/ui/button";
type Params = { q?: string; from?: string; to?: string; status?: string; page?: string; error?: string; message?: string };
export default async function Page({ searchParams }: { searchParams: Promise<Params> }) {
  const [p, { activeMembership: m }, db] = await Promise.all([searchParams, getDashboardContext(), createClient()]);
  if (!["owner", "manager", "cashier"].includes(m.role)) notFound();
  const status = ["confirmed", "declined"].includes(p.status ?? "") ? p.status! : "requested", page = historyPage(p.page);
  let request = db.from("public_product_orders").select("id,product_name,unit,quantity,unit_price_centavos,currency,customer_name,phone,email,note,status,created_at,resolved_at,checkout_id").eq("organization_id", m.organizationId).eq("branch_id", m.branchId).eq("status", status);
  if (p.q) request = request.or(listingOrSearch(["customer_name", "product_name", "phone"], p.q));
  if (listingDate(p.from)) request = request.gte("created_at", `${listingDate(p.from)}T00:00:00Z`);
  if (listingDateEnd(p.to)) request = request.lt("created_at", listingDateEnd(p.to)!);
  const [orders, branch] = await Promise.all([
    request.order("created_at", { ascending: status === "requested" }).order("id").range((page-1)*20,page*20),
    db.from("branches").select("timezone").eq("id", m.branchId).eq("organization_id", m.organizationId).maybeSingle(),
  ]);
  const format = new Intl.DateTimeFormat("en-PH", { timeZone: branch.data?.timezone ?? m.timezone, dateStyle: "medium", timeStyle: "short" });
  return <main id="public-product-orders-page" className="mx-auto min-w-0 max-w-5xl">
    <PageHeader id="public-product-orders-header" title="Public product orders" description={`${m.branchName} · Review orders submitted on your public website.`} back={<Button asChild variant="secondary"><Link id="public-orders-back" href={m.role === "cashier" ? "/dashboard/payments" : "/dashboard/products"}>Back</Link></Button>}/>
    <FormMessage message={p.message} error={p.error ?? (orders.error ? "Orders could not be loaded. Please try again." : undefined)}/>
    <ListTabs id="public-product-order-tabs" baseHref="/dashboard/products/orders" query={{ q: p.q, from: p.from, to: p.to }} value={status} options={[{ value: "requested", label: "Pending" }, { value: "confirmed", label: "Confirmed" }, { value: "declined", label: "Declined" }]}/>
    <ListingFilters id="public-orders-filters" action="/dashboard/products/orders" query={{...p,status}} searchLabel="Search customer, product or phone" dates/>
    <p className="mt-3 text-sm text-admin-text-secondary">Confirm the customer’s contact and pickup details before accepting. Confirmation checks stock and the submitted price, then opens Checkout for payment and handover. No customer message is sent automatically.</p>
    {!orders.error ? <><RecordTable id="public-orders-table" className="mt-4" caption="Public product orders" columns={[{key:"customer",label:"Customer"},{key:"product",label:"Order",secondary:true},{key:"date",label:"Submitted",secondary:true},{key:"actions",label:"Actions",align:"right"}]} rows={(orders.data ?? []).slice(0,20).map(order => ({id:`public-order-${order.id}`,cells:{customer:<><strong>{order.customer_name}</strong><p className="text-xs">{order.phone}{order.email ? ` · ${order.email}` : ""}</p>{order.note ? <details className="mt-1"><summary className="cursor-pointer text-xs">Notes & reference</summary><p className="whitespace-pre-wrap">{order.note}</p><p className="text-xs">{order.id}</p></details> : null}</>, product:<>{order.product_name}<p>{order.quantity} {order.unit} · {formatMoney(quantityAmountCentavos(String(order.quantity), BigInt(order.unit_price_centavos)), order.currency)}</p></>,date:<>{format.format(new Date(order.created_at))}{order.resolved_at ? <p className="text-xs">{order.status} {format.format(new Date(order.resolved_at))}</p> : null}</>,actions:order.status === "requested" ? <div className="flex flex-wrap gap-2"><form action={resolvePublicProductOrder}><input type="hidden" name="id" value={order.id}/><input type="hidden" name="action" value="confirm"/><SubmitButton id={`public-order-confirm-${order.id}`} pendingText="Confirming…">Confirm & open Checkout</SubmitButton></form><form action={resolvePublicProductOrder}><input type="hidden" name="id" value={order.id}/><input type="hidden" name="action" value="decline"/><SubmitButton id={`public-order-decline-${order.id}`} variant="secondary" pendingText="Declining…">Decline</SubmitButton></form></div> : order.checkout_id ? <Button asChild variant="secondary"><Link id={`public-order-checkout-${order.id}`} href={`/dashboard/checkout/${order.checkout_id}`}>Open Checkout</Link></Button> : null},mobile:<><p>{order.product_name} · {order.quantity} {order.unit} · {formatMoney(quantityAmountCentavos(String(order.quantity), BigInt(order.unit_price_centavos)), order.currency)}</p><p>{format.format(new Date(order.created_at))}</p></>}))}/><HistoryNavigation id="public-orders-pagination" path={`/dashboard/products/orders?${new URLSearchParams({status,q:p.q??"",from:p.from??"",to:p.to??""})}`} parameter="page" page={page} hasMore={(orders.data?.length ?? 0)>20}/></> : null}
  </main>;
}
