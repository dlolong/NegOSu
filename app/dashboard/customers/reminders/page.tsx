import { ListingFilters } from "@/components/listing-filters";
import { listingPattern } from "@/lib/listing-query";
import Link from "next/link";
import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { historyPage, reminderAttentionCutoff } from "@/modules/core/crm/client-reminders";
import { HistoryNavigation, ReminderRows, type ClientReminder } from "@/components/client-follow-up";
import { PageHeader } from "@/components/page-patterns";
import { ListTabs } from "@/components/list-tabs";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";

type Params = { q?: string; status?: string; page?: string; message?: string; error?: string };
export default async function Page({ searchParams }: { searchParams: Promise<Params> }) {
  const [p, { activeMembership }, db] = await Promise.all([searchParams, getDashboardContext(), createClient()]);
  const status = ["scheduled", "attention", "upcoming", "contacted", "cancelled"].includes(p.status ?? "") ? p.status! : "due";
  const page = historyPage(p.page), now = new Date().toISOString();
  let query = db.from("client_reminders").select("id,customer_id,reason,due_at,status,resolved_at,customers!inner(full_name,phone),branches(name,timezone)").eq("organization_id", activeMembership.organizationId);
  if (p.q) query = query.ilike("customers.full_name", listingPattern(p.q));
  if (status === "due") query = query.eq("status", "pending").lte("due_at", now);
  else if (status === "scheduled") query = query.eq("status", "pending");
  else if (status === "attention") query = query.eq("status", "pending").lte("due_at", reminderAttentionCutoff(new Date(now)));
  else if (status === "upcoming") query = query.eq("status", "pending").gt("due_at", now);
  else query = query.eq("status", status);
  const { data, error } = await query.order("due_at").order("id").range((page - 1) * 20, page * 20);
  return <main id="client-reminders-page" className="mx-auto min-w-0 max-w-5xl">
    <PageHeader id="client-reminders-header" title="Reminders" description="All client reminders from branches you can access. The notification bell alerts owners, managers and advisors in the active branch 24 hours before a reminder is due and keeps overdue reminders visible until resolved." back={<Button asChild variant="secondary"><Link id="reminders-back-clients" href="/dashboard/customers">Back to Clients</Link></Button>}/>
    <FormMessage message={p.message} error={p.error ?? (error ? "Unable to load reminders. Please try again." : undefined)}/>
    <ListingFilters id="client-reminders-filters" action="/dashboard/customers/reminders" query={{q:p.q,status}} searchLabel="Search client name"/>
    <ListTabs id="client-reminders-tabs" baseHref="/dashboard/customers/reminders" query={{q:p.q}} value={status} options={[{ value: "scheduled", label: "All scheduled" }, { value: "attention", label: "Due within 24h / overdue" }, { value: "due", label: "Due now" }, { value: "upcoming", label: "Upcoming" }, { value: "contacted", label: "Contacted" }, { value: "cancelled", label: "Cancelled" }]}/>
    {!error ? <><ReminderRows now={now} rows={(data ?? []).slice(0,20) as unknown as ClientReminder[]} timezone={activeMembership.timezone} canWrite={["owner", "manager", "advisor"].includes(activeMembership.role)}/>{!data?.length ? <p id="client-reminders-empty" className="mt-5 text-sm text-admin-text-secondary">{status === "due" ? "No clients are due for a reminder right now." : "No reminders in this view."}</p> : null}<HistoryNavigation id="reminders-pagination" path={`/dashboard/customers/reminders?status=${status}&q=${encodeURIComponent(p.q ?? "")}`} parameter="page" page={page} hasMore={(data?.length ?? 0) > 20}/></> : null}
  </main>;
}
