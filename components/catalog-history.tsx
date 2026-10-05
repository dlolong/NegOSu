import Link from "next/link";
import { WorkContributors } from "@/components/work-contributors";
import { groupWorkContributors, loadWorkParticipation, type WorkContributor } from "@/modules/core/staff/work-history";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ListTabs } from "@/components/list-tabs";
import { HistoryNavigation } from "@/components/client-reminder-rows";
import { RecordTable } from "@/components/record-table";
import { ListingFilters } from "@/components/listing-filters";
import { formatMoney } from "@/lib/operations";
import { historyPage } from "@/modules/core/crm/client-reminders";
import { catalogHistoryTab, loadCatalogHistory, CATALOG_HISTORY_SIZE, type CatalogHistoryKind } from "@/modules/core/commerce/catalog-history";

type Appointment = { id: string; starts_at: string | null; created_at: string; status: string; customers: { full_name: string } | null };
type Payment = { id: string; amount_centavos: number; currency: string; paid_at: string | null; created_at: string; status: string; appointments: Appointment };
type PromoInvoice = { id: string; job_order_id: string | null; customer_name_snapshot: string; total_centavos: number; status: string; issued_at: string | null; created_at: string };
type Purchase = { id: string; invoice_id: string; description_snapshot: string; line_total_centavos: number; invoices: { job_order_id: string | null; customer_name_snapshot: string; status: string; issued_at: string | null; created_at: string } };
export async function CatalogHistory({ db, scope, kind, recordId, query, timezone }: {
  db: SupabaseClient; scope: { organizationId: string; branchId: string; industry: string; currency: string; role?: string }; kind: CatalogHistoryKind; recordId: string; query: { tab?: string; page?: string; q?: string; from?: string; to?: string }; timezone: string;
}) {
  const tab = catalogHistoryTab(query.tab), page = historyPage(query.page), path = `/dashboard/${kind === "promo" ? "promos" : "services"}/${recordId}`;
  const { data, error } = await loadCatalogHistory(db, scope, kind, recordId, tab, page, query);
  const rows = (data ?? []) as unknown as (Appointment | Payment | Purchase | PromoInvoice)[];
  const visibleRows = rows.slice(0, CATALOG_HISTORY_SIZE);
  const workKey = (row: typeof rows[number]) => "invoices" in row ? row.invoices.job_order_id : "total_centavos" in row ? row.job_order_id : "appointments" in row ? row.appointments.id : row.id;
  const attributionKey = tab === "purchases" && scope.industry === "automotive" ? "target_id" : "appointment_id";
  const participation = error ? { data: [], error: null } : await loadWorkParticipation(db, scope, attributionKey, visibleRows.map(workKey).filter((id): id is string => Boolean(id)));
  let participationRows = participation.data;
  let staffError = Boolean(participation.error);
  if (kind === "promo" && participationRows.some(row => row.source === "service_assignment")) {
    const appointmentIds = [...new Set(participationRows.map(row => row.appointment_id).filter((id): id is string => Boolean(id)))];
    const snapshots = await db.from("appointment_promo_snapshots").select("appointment_id,service_id")
      .eq("organization_id", scope.organizationId).eq("branch_id", scope.branchId).eq("promo_id", recordId).in("appointment_id", appointmentIds);
    staffError ||= Boolean(snapshots.error);
    const included = new Set((snapshots.data ?? []).map(row => `${row.appointment_id}:${row.service_id}`));
    participationRows = participationRows.filter(row => row.source !== "service_assignment" || included.has(`${row.appointment_id}:${row.service_id}`));
  }
  const contributors = groupWorkContributors(participationRows, attributionKey, kind === "service" ? new Set([recordId]) : undefined);
  const date = (value: string) => new Intl.DateTimeFormat("en-PH", { timeZone: timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  const appointmentHref = (id: string) => `/dashboard/${scope.industry === "pet_care" ? "pet-care/" : ""}appointments/${id}`;
  return <section id={`${kind}-history`} className="mt-6 min-w-0">
    <h2 className="text-lg font-medium">History</h2>
    <ListTabs id={`${kind}-history-tabs`} baseHref={path} query={{ q: query.q, from: query.from, to: query.to }} parameter="tab" value={tab} options={[{ value: "usage", label: "Appointment history" }, { value: "purchases", label: "Purchase history" }]}/>
    <ListingFilters id={`${kind}-history-filters`} action={path} query={{ ...query, tab }} searchLabel="Search customer name" dates/>
    <p className="mt-3 text-sm text-admin-text-secondary">{tab === "usage" ? "Appointments containing this item, including upcoming, cancelled, and completed visits." : scope.industry === "automotive" && kind === "service" ? "Billed service lines. Voided bills remain labeled." : scope.industry === "automotive" ? "Invoices for visits containing this promo. Totals cover the whole job, including other items; they are not revenue attributed to this promo." : "Recorded payments for visits containing this item. Amounts cover the whole visit, including other items; they are not revenue attributed to this item. Unpaid bookings appear under Appointment history."} Times shown in {timezone}. Staff labels distinguish service assignments from the whole visit or job team; a shared team is not a per-service completion record.</p>
    {error ? <p id={`${kind}-history-error`} role="alert" className="mt-4">History could not be loaded. Please try again.</p> : <>
      <RecordTable id={`${kind}-history-table`} className="mt-4" caption="History records" columns={[{key:"customer",label:"Customer"},{key:"detail",label:"Details",secondary:true},{key:"staff",label:"Staff / team",secondary:true},{key:"date",label:"Date and time",secondary:true},{key:"status",label:"Status"}]} rows={visibleRows.map(row => {
        let href: string, name: string, when: string, status: string, detail: string;
        if ("invoices" in row) { href = `/dashboard/invoices/${row.invoice_id}`; name = row.invoices.customer_name_snapshot; when = row.invoices.issued_at ?? row.invoices.created_at; status = row.invoices.status; detail = `${row.description_snapshot} · ${formatMoney(row.line_total_centavos, scope.currency)}`; }
        else if ("total_centavos" in row) { href = `/dashboard/invoices/${row.id}`; name = row.customer_name_snapshot; when = row.issued_at ?? row.created_at; status = row.status; detail = `Whole job invoice · ${formatMoney(row.total_centavos, scope.currency)}`; }
        else if ("appointments" in row) { href = appointmentHref(row.appointments.id); name = row.appointments.customers?.full_name ?? "Customer unavailable"; when = row.paid_at ?? row.created_at; status = row.status; detail = `Visit payment · ${formatMoney(row.amount_centavos, row.currency)}`; }
        else { href = appointmentHref(row.id); name = row.customers?.full_name ?? "Customer unavailable"; when = row.starts_at ?? row.created_at; status = row.status; detail = row.starts_at ? "Appointment time" : "Recorded (unscheduled)"; }
        const people: WorkContributor[] = contributors.get(workKey(row) ?? "") ?? [];
        const staff = <WorkContributors people={people} canOpenStaff={scope.role === "owner"} error={staffError}/>;
        return { id: `${kind}-history-${row.id}`, cells: { customer: <Link id={`${kind}-history-open-${row.id}`} href={href} className="font-medium underline">{name}</Link>, detail, staff, date: date(when), status: status.replaceAll("_", " ") }, mobile: <><p>{detail}</p>{staff}<p>{date(when)}</p></> };
      })}/>

      {!rows.length ? <p id={`${kind}-history-empty`} className="mt-4 text-sm">No {tab === "usage" ? "appointments" : "purchases"} recorded{page > 1 ? " on this page" : " yet"}.</p> : null}
      <HistoryNavigation id={`${kind}-history-pagination`} path={`${path}?${new URLSearchParams({tab, q: query.q ?? "", from: query.from ?? "", to: query.to ?? ""})}`} parameter="page" page={page} hasMore={rows.length > CATALOG_HISTORY_SIZE}/>
    </>}
  </section>;
}
