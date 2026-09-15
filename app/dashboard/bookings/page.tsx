import { RecordTable } from "@/components/record-table";
import { ListTabs } from "@/components/list-tabs";
import { listHref } from "@/lib/list-navigation";
import { PageHeader } from "@/components/page-patterns";
import { Search } from "lucide-react";
import { SearchableSelect } from "@/components/searchable-select";
import { RecordLink } from "@/components/record-item";
import { FormDialog } from "@/components/management-ui";

import { Check as CheckIcon, RefreshCw as RefreshCwIcon, X as XIcon } from "lucide-react";

import { FormActions } from "@/components/form-actions";
import Link from "next/link";

import { reviewBooking } from "@/app/dashboard/bookings/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDashboardContext } from "@/lib/auth/context";
import { roleHasPermission } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";

type BookingRequest = {
  pet_booking_details?: { pet_name:string; species:string; breed:string|null } | { pet_name:string; species:string; breed:string|null }[];
  id: string;
  customer_name: string;
  vehicle_make: string | null;
  vehicle_model: string | null;
  phone: string;
  email: string | null;
  public_reference: string;
  status: string;
  preferred_at: string;
  customer_note: string | null;
  public_booking_services: Array<{ service_name_snapshot: string; price_centavos: number }>;
};

function petDetails(request: BookingRequest) { return Array.isArray(request.pet_booking_details) ? request.pet_booking_details[0] : request.pet_booking_details; }

export default async function Page({ searchParams }: { searchParams: Promise<{ message?: string; error?: string; requestId?: string; status?: string; q?: string }> }) {
  const [params, { activeMembership }, supabase] = await Promise.all([
    searchParams,
    getDashboardContext(),
    createClient(),
  ]);
  const { data: requests, error } = await supabase
    .from("public_booking_requests")
    .select("*,public_booking_services(service_name_snapshot,price_centavos),pet_booking_details(pet_name,species,breed)")
    .eq("organization_id", activeMembership.organizationId)
    .eq("branch_id", activeMembership.branchId)
    .order("created_at", { ascending: false });
  const petCare = activeMembership.industry === "pet_care";
  const [pets,staff,resources] = petCare ? await Promise.all([
    supabase.from("pet_profiles").select("id,name,customers(full_name)").eq("organization_id",activeMembership.organizationId).eq("is_active",true).order("name"),
    supabase.from("organization_staff_profiles").select("id,full_name").eq("organization_id",activeMembership.organizationId).eq("is_active",true).order("full_name"),
    supabase.from("scheduling_resources").select("id,name").eq("organization_id",activeMembership.organizationId).eq("branch_id",activeMembership.branchId).eq("is_active",true).order("name"),
  ]) : [null,null,null];
  const bookingRequests = (requests ?? []) as BookingRequest[];
  const selected = bookingRequests.find(request => request.id === params.requestId);

  const status = ["requested","confirmed","declined","all"].includes(params.status??"") ? params.status! : "requested";
  const search=(params.q??"").trim().toLowerCase();
  const filtered=bookingRequests.filter(request=>(status==="all"||request.status===status)&&(!search||[request.customer_name,request.public_reference,request.phone,request.email,petDetails(request)?.pet_name,...request.public_booking_services.map(service=>service.service_name_snapshot)].some(value=>value?.toLowerCase().includes(search))));
  const closeHref=listHref("/dashboard/bookings",params);
  const reviewForm=(request:BookingRequest)=>(
request.status === "requested" && roleHasPermission(activeMembership.role, "appointments.manage") ? (
                <div className="mt-4 grid gap-3 border-t border-zinc-100 pt-4 sm:flex sm:flex-wrap sm:items-end sm:justify-end">
                  <form id={`booking-request-confirm-form-${request.id}`} action={reviewBooking} className="grid min-w-0 gap-3">
                    {petCare ? <><p className="text-sm">{petDetails(request)?.species} · {petDetails(request)?.breed || "Breed not provided"}</p><label className="text-sm">Pet record<SearchableSelect id={`pet-request-pet-${request.id}`} name="petId" options={(pets?.data??[]).map(p=>({id:p.id,name:`${p.name} · ${(Array.isArray(p.customers)?p.customers[0]:p.customers)?.full_name??"Pet owner"}`}))} placeholder="Create pet and owner from request"/></label><p className="text-xs text-admin-text-secondary">Choose an existing pet only when the name, species, and owner contact match. New records can be reviewed after confirmation.</p><label className="text-sm">Groomer<SearchableSelect id={`pet-request-staff-${request.id}`} name="staffId" required options={(staff?.data??[]).map(s=>({id:s.id,name:s.full_name}))} placeholder="Search groomer"/></label><label className="text-sm">Resource<SearchableSelect id={`pet-request-resource-${request.id}`} name="resourceId" required options={resources?.data??[]} placeholder="Search resource"/></label>{[pets,staff,resources].some(result=>result?.error)?<p role="alert">Assignment options could not be loaded. Refresh before confirming.</p>:null}</> : null}
                    <input type="hidden" name="id" value={request.id} />
                    <input type="hidden" name="action" value="confirm" />
                    <SubmitButton id={`booking-request-confirm-button-${request.id}`} className="w-full sm:w-auto" pendingText="Confirming…"><CheckIcon aria-hidden="true" size={16} className="shrink-0"/>
                      Confirm and create appointment
                    </SubmitButton>
                  </form>
                  <form id={`booking-request-decline-form-${request.id}`} action={reviewBooking} className="grid min-w-0 gap-2 sm:flex sm:flex-1 sm:items-end">
                    <input type="hidden" name="id" value={request.id} />
                    <input type="hidden" name="action" value="decline" />
                    <label className="min-w-0 flex-1 text-xs font-medium text-zinc-600" htmlFor={`booking-request-decline-reason-${request.id}`}>
                      Decline reason <span className="font-normal">(optional)</span>
                      <input
                        id={`booking-request-decline-reason-${request.id}`}
                        className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-950"
                        name="reason"
                      />
                    </label>
                    <FormActions id={`booking-request-decline-actions-${request.id}`}><SubmitButton id={`booking-request-decline-button-${request.id}`} className="w-full sm:w-auto" pendingText="Declining…" variant="destructive"><XIcon aria-hidden="true" size={16} className="shrink-0"/>
                      Decline
                    </SubmitButton></FormActions>
                  </form>
                </div>
              ) : null
  );

  return (
    <main id="booking-requests-page" className="mx-auto w-full min-w-0 max-w-6xl">
      <PageHeader id="booking-requests-page-header" eyebrow={activeMembership.branchName} title="Booking requests" description="Review requests from your public page and confirm appointments."/>

      <FormMessage {...params} />

      <ListTabs id="booking-requests-tabs" baseHref="/dashboard/bookings" query={params} value={status} options={[{value:"requested",label:"Pending",count:bookingRequests.filter(r=>r.status==="requested").length},{value:"confirmed",label:"Confirmed"},{value:"declined",label:"Declined"},{value:"all",label:"All"}]}/>
      <form id="booking-requests-search-form" className="my-4 flex min-w-0 gap-2"><input type="hidden" name="status" value={status}/><label className="min-w-0 flex-1"><span className="sr-only">Search booking requests</span><input id="booking-requests-search" name="q" defaultValue={params.q} maxLength={120} placeholder="Customer, reference, or service" className="min-h-11 w-full min-w-0 rounded-ui-md border border-admin-border bg-admin-surface px-3 text-sm"/></label><Button id="booking-requests-search-button" variant="secondary" type="submit"><Search size={16} aria-hidden="true"/>Search</Button></form>
      {error ? <Card id="booking-requests-error" className="mt-5 p-6 text-center" role="alert"><h2 className="font-semibold">Could not load booking requests</h2><Button id="booking-requests-retry-button" asChild className="mt-4" variant="secondary"><Link href={closeHref}><RefreshCwIcon size={16} aria-hidden="true"/>Try again</Link></Button></Card> : <section id="booking-requests-list" aria-label="Online booking requests">
        <RecordTable id="booking-requests-table" emptyId="booking-requests-empty-state" caption="Online booking requests" empty="No booking requests match this view." columns={[{key:"customer",label:"Customer / request"},{key:"services",label:"Services",secondary:true},{key:"schedule",label:"Requested time",secondary:true},{key:"status",label:"Status",align:"right"}]} rows={filtered.map(request=>({id:`booking-request-card-${request.id}`,cells:{
          customer:<><RecordLink id={`booking-request-link-${request.id}`} href={`${closeHref}${closeHref.includes("?")?"&":"?"}requestId=${request.id}`}>{petDetails(request)?.pet_name?`${petDetails(request)?.pet_name} · `:""}{request.customer_name}</RecordLink><p className="mt-1 text-xs text-admin-text-secondary">{request.public_reference} · {request.phone}</p>{activeMembership.industry==="automotive"&&<p className="mt-1 text-xs">{request.vehicle_make} {request.vehicle_model}</p>}</>,
          services:request.public_booking_services.map(service=>service.service_name_snapshot).join(", "),schedule:new Intl.DateTimeFormat("en-PH",{dateStyle:"medium",timeStyle:"short",timeZone:activeMembership.timezone}).format(new Date(request.preferred_at)),status:<span id={`booking-request-status-${request.id}`} className="inline-flex rounded-full bg-admin-surface-muted px-2 py-1 text-xs font-medium capitalize">{request.status==="requested"?"Pending":request.status}</span>,
        },mobile:<><p>{request.public_booking_services.map(service=>service.service_name_snapshot).join(", ")}</p><p>{new Intl.DateTimeFormat("en-PH",{dateStyle:"medium",timeStyle:"short",timeZone:activeMembership.timezone}).format(new Date(request.preferred_at))}</p></>}))}/>
        <p className="mt-3 text-sm text-admin-text-secondary">{filtered.length} requests · Select a row to review its details.</p>
      </section>}
      {selected ? <FormDialog id="booking-request-details-dialog" title={selected.customer_name} closeHref={closeHref} size="lg"><dl className="space-y-4 text-sm">{[["Reference", selected.public_reference], ["Status", selected.status], ...(petCare?[["Pet",petDetails(selected)?.pet_name??"Pet name not provided"]]:activeMembership.industry==="automotive"?[["Vehicle",[selected.vehicle_make,selected.vehicle_model].filter(Boolean).join(" ")]]:[]), ["Contact", [selected.phone, selected.email].filter(Boolean).join(" · ")], ["Requested time", new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: activeMembership.timezone }).format(new Date(selected.preferred_at))], ["Services", selected.public_booking_services.map(service => service.service_name_snapshot).join(", ")], ["Customer note", selected.customer_note || "No note"]].map(([label,value])=><div key={label}><dt className="text-admin-text-muted">{label}</dt><dd className="whitespace-pre-wrap [overflow-wrap:anywhere]">{value}</dd></div>)}</dl>{reviewForm(selected)}</FormDialog> : null}
    </main>
  );
}
