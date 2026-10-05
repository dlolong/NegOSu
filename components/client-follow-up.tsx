import { RecordTable } from "@/components/record-table";
import { ListingFilters } from "@/components/listing-filters";
import { listingDate, listingDateEnd } from "@/lib/listing-query";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { createReminder } from "@/app/dashboard/customers/reminder-actions";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/server";
import type { OrganizationMembership } from "@/lib/auth/context";

export { HistoryNavigation, ReminderRows, type ClientReminder } from "@/components/client-reminder-rows";
import { HistoryNavigation, ReminderRows, type ClientReminder } from "@/components/client-reminder-rows";
export async function ClientFollowUp({ customerId, membership, archived, page }: { customerId: string; membership: OrganizationMembership; archived: boolean; page: number }) {
  const db = await createClient();
  const [reminders, branch] = await Promise.all([
    db.from("client_reminders").select("id,customer_id,reason,due_at,status,resolved_at,customers(full_name,phone),branches(name,timezone)").eq("organization_id", membership.organizationId).eq("customer_id", customerId).order("due_at", { ascending: false }).order("id").range((page - 1) * 20, page * 20),
    db.from("branches").select("name,timezone").eq("organization_id", membership.organizationId).eq("id", membership.branchId).maybeSingle(),
  ]);
  const canWrite = ["owner", "manager", "advisor"].includes(membership.role);
  const timezone = branch.data?.timezone ?? membership.timezone;
  return <Card id="client-follow-up" className="mt-5 min-w-0 p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-medium">Client reminders</h2><Button asChild size="sm" variant="secondary"><Link id="client-all-reminders" href="/dashboard/customers/reminders">View clients to contact</Link></Button></div>
    <p className="mt-2 text-sm text-admin-text-secondary">Follow up by calling or texting manually, then mark contacted. No messages are sent automatically.</p>
    {canWrite && !archived && branch.data ? <details id="client-reminder-create" className="mt-4 rounded-xl border border-admin-border p-3"><summary id="client-reminder-add-button" className="cursor-pointer font-medium">Set reminder</summary>
      <form id="client-reminder-form" action={createReminder} className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
        <input type="hidden" name="id" value={randomUUID()}/><input type="hidden" name="customerId" value={customerId}/><input type="hidden" name="branchId" value={membership.branchId}/>
        <label className="min-w-0 text-sm sm:col-span-2">Reason<textarea id="client-reminder-reason" name="reason" required maxLength={500} placeholder="Facial follow-up, cleaning, next visit…" className="mt-1 min-h-20 w-full rounded-xl border border-admin-border p-3"/></label>
        <label className="min-w-0 text-sm">Remind on ({timezone})<Input id="client-reminder-due-at" name="dueAt" type="datetime-local" required/></label>
        <p className="self-center text-sm">Branch: {branch.data.name}</p>
        <div><SubmitButton id="client-reminder-save-button" pendingText="Saving…">Save reminder</SubmitButton></div>
      </form>
    </details> : null}
    {reminders.error ? <p role="alert" className="mt-3 text-sm">Reminders could not be loaded. Please try again.</p> : <><ReminderRows clientOrigin searchable now={new Date().toISOString()} rows={(reminders.data ?? []).slice(0,20) as unknown as ClientReminder[]} timezone={timezone} canWrite={canWrite}/>{!reminders.data?.length ? <p className="mt-3 text-sm text-admin-text-secondary">No reminders yet.</p> : null}<HistoryNavigation id="client-reminders-pagination" path={`/dashboard/customers/${customerId}?tab=reminders`} parameter="remindersPage" page={page} hasMore={(reminders.data?.length ?? 0) > 20}/></>}
  </Card>;
}
export async function ClientPurchases({ customerId, timezone, page, filters = {} }: { customerId: string; timezone: string; page: number; filters?: {q?:string;from?:string;to?:string} }) {
  const db = await createClient();
  const { data, error } = filters.q || filters.from || filters.to
    ? await db.rpc("client_product_history_filtered", { p_customer: customerId, p_offset: (page - 1) * 20, p_query: filters.q || null, p_from: listingDate(filters.from) ? `${listingDate(filters.from)}T00:00:00Z` : null, p_to: listingDateEnd(filters.to) ?? null })
    : await db.rpc("client_product_history", { p_customer: customerId, p_offset: (page - 1) * 20 });
  const rows = (data ?? []) as Array<{ id: string; name: string; quantity: number; unit: string; returned: number; purchased_at: string; branch_name: string; payment_status: string; promo_name: string | null }>;
  return <Card id="client-product-history" className="mt-5 min-w-0 p-5"><h2 className="font-medium">Products bought</h2><p className="mt-1 text-xs text-admin-text-secondary">Billed products and handed-over promo inclusions. Dates shown in {timezone}. Payment status and returns are shown separately.</p>
    <ListingFilters id="client-products-filters" action={`/dashboard/customers/${customerId}`} query={{...filters,tab:"products"}} clearHref={`/dashboard/customers/${customerId}?tab=products`} searchLabel="Search purchased product" dates/>
    {error ? <p role="alert" className="mt-3 text-sm">Product history could not be loaded.</p> : <><RecordTable id="client-purchases-table" className="mt-3" caption="Products bought" columns={[{key:"product",label:"Product"},{key:"quantity",label:"Quantity"},{key:"date",label:"Purchased",secondary:true},{key:"status",label:"Status",secondary:true}]} rows={rows.slice(0,20).map(r=>({id:`client-purchase-${r.id}`,cells:{product:<strong>{r.name}</strong>,quantity:<>{r.quantity} {r.unit}{Number(r.returned)>0 ? <p>Returned: {r.returned}</p> : null}</>,date:<>{new Intl.DateTimeFormat("en-PH",{timeZone:timezone,dateStyle:"medium",timeStyle:"short"}).format(new Date(r.purchased_at))}<p>{r.branch_name}</p></>,status:<>{r.payment_status.replaceAll("_"," ")}{r.promo_name ? ` · ${r.promo_name}` : ""}</>}}))}/>{!rows.length ? <p className="mt-3 text-sm text-admin-text-secondary">No product purchases recorded.</p> : null}<HistoryNavigation id="client-products-pagination" path={`/dashboard/customers/${customerId}?${new URLSearchParams({tab:"products",q:filters.q??"",from:filters.from??"",to:filters.to??""})}`} parameter="productsPage" page={page} hasMore={rows.length > 20}/></>}
  </Card>;
}
