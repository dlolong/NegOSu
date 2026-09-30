import { CompactFilters } from "@/components/compact-filters";
import { RecordTable } from "@/components/record-table";
import { ListTabs } from "@/components/list-tabs";
import { listHref } from "@/lib/list-navigation";
import { PageHeader } from "@/components/page-patterns";
import { Search } from "lucide-react";
import { SearchableSelect } from "@/components/searchable-select";
import { RecordLink } from "@/components/record-item";
import { FormDialog } from "@/components/management-ui";

import { Check as CheckIcon, RefreshCw as RefreshCwIcon, X as XIcon } from "lucide-react";

import Link from "next/link";

import { inputDateTimeInZone } from "@/lib/operations";
import { reviewBooking, proposeAlternative } from "@/app/dashboard/bookings/actions";
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
  const [pets,staff,resources,alternatives] = await Promise.all([
    petCare ? supabase.from("pet_profiles").select("id,name,customers(full_name)").eq("organization_id",activeMembership.organizationId).eq("is_active",true).order("name") : Promise.resolve(null),
    supabase.from("organization_staff_profiles").select("id,full_name,staff_profile_branch_assignments(branch_id)").eq("organization_id",activeMembership.organizationId).eq("is_active",true).order("full_name"),
    petCare ? supabase.from("scheduling_resources").select("id,name").eq("organization_id",activeMembership.organizationId).eq("branch_id",activeMembership.branchId).eq("is_active",true).order("name") : Promise.resolve(null),
    requests?.length ? supabase.from("public_booking_alternatives").select("booking_request_id,version,starts_at,staff_id,staff_name,resource_id,message,status").in("booking_request_id",requests.map(r=>r.id)).order("version",{ascending:false}) : Promise.resolve({data:[],error:null}),
  ]);
  const availableStaff=(staff.data??[]).filter(s=>!s.staff_profile_branch_assignments.length||s.staff_profile_branch_assignments.some(a=>a.branch_id===activeMembership.branchId));
  const offerFor=(id:string)=>alternatives.data?.find(offer=>offer.booking_request_id===id);
  const requestStatus=(request:BookingRequest)=>request.status==="requested" && offerFor(request.id)?.status==="pending"?"Awaiting client":request.status==="requested" && offerFor(request.id)?.status==="accepted"?"Client accepted":request.status==="requested"?"Pending":request.status;
  const bookingRequests = (requests ?? []) as BookingRequest[];
  const selected = bookingRequests.find(request => request.id === params.requestId);

  const status = ["requested","awaiting_client","accepted","confirmed","declined","all"].includes(params.status??"") ? params.status! : "requested";
  const search=(params.q??"").trim().toLowerCase();
  const filtered=bookingRequests.filter(request=>(status==="all"||request.status===status||(status==="awaiting_client"&&requestStatus(request)==="Awaiting client")||(status==="accepted"&&requestStatus(request)==="Client accepted"))&&(!search||[request.customer_name,request.public_reference,request.phone,request.email,petDetails(request)?.pet_name,...request.public_booking_services.map(service=>service.service_name_snapshot)].some(value=>value?.toLowerCase().includes(search))));
  const closeHref=listHref("/dashboard/bookings",params);
  const reviewForm = (request: BookingRequest) => (
    request.status === "requested" && roleHasPermission(activeMembership.role, "appointments.manage") ? (
      <section id="booking-request-review" aria-label="Review booking request" className="mt-6 space-y-5 border-t border-admin-border pt-5">
        {offerFor(request.id)?.status!=="pending"?<form id={`booking-request-confirm-form-${request.id}`} action={reviewBooking} className="min-w-0 space-y-4">
          <div>
            <h3 className="text-sm font-medium">Confirm appointment</h3>
            <p className="mt-1 text-sm text-admin-text-secondary">Confirm the agreed time and staff, or approve the original request when no alternative was proposed.</p>
          </div>
          {petCare && offerFor(request.id)?.status!=="accepted" ? (
            <div className="grid min-w-0 gap-4 rounded-ui-md border border-admin-border bg-admin-surface-muted p-4 sm:grid-cols-2">
              <div className="min-w-0 sm:col-span-2">
                <label htmlFor={`pet-request-pet-${request.id}`} className="mb-1.5 block text-sm font-medium">Pet record</label>
                <SearchableSelect id={`pet-request-pet-${request.id}`} name="petId" options={(pets?.data ?? []).map(p => ({ id: p.id, name: `${p.name} · ${(Array.isArray(p.customers) ? p.customers[0] : p.customers)?.full_name ?? "Pet owner"}` }))} placeholder="Create pet and owner from request" />
                <p className="mt-2 text-xs leading-relaxed text-admin-text-secondary">Choose an existing pet only when the name, species, and owner contact match. Otherwise, a new pet and owner will be created.</p>
              </div>
              <div className="min-w-0">
                <label htmlFor={`pet-request-staff-${request.id}`} className="mb-1.5 block text-sm font-medium">Groomer</label>
                <SearchableSelect id={`pet-request-staff-${request.id}`} name="staffId" required options={availableStaff.map(s => ({ id: s.id, name: s.full_name }))} placeholder="Search groomer" />
              </div>
              <div className="min-w-0">
                <label htmlFor={`pet-request-resource-${request.id}`} className="mb-1.5 block text-sm font-medium">Resource</label>
                <SearchableSelect id={`pet-request-resource-${request.id}`} name="resourceId" required options={resources?.data ?? []} placeholder="Search resource" />
              </div>
              {[pets, staff, resources].some(result => result?.error) ? <p role="alert" className="text-sm text-status-danger sm:col-span-2">Assignment options could not be loaded. Refresh before confirming.</p> : null}
            </div>
          ) : null}
          <input type="hidden" name="id" value={request.id} />
          <input type="hidden" name="action" value="confirm" />
          {offerFor(request.id)?.status==="accepted"?<input type="hidden" name="alternativeVersion" value={offerFor(request.id)?.version}/>:null}
          <div className="flex justify-end">
            <SubmitButton id={`booking-request-confirm-button-${request.id}`} className="w-full sm:w-auto" pendingText="Confirming…">
              <CheckIcon aria-hidden="true" size={16} className="shrink-0" />
              Confirm and create appointment
            </SubmitButton>
          </div>
        </form>:<p role="status" className="text-sm">Waiting for the client to accept or cancel. You can revise the suggestion below.</p>}
        {offerFor(request.id)?<div id="booking-request-alternative-summary" className="rounded-ui-md border border-admin-border p-4 text-sm"><p className="font-medium">{requestStatus(request)}</p><p className="mt-1">{new Intl.DateTimeFormat("en-PH",{dateStyle:"medium",timeStyle:"short",timeZone:activeMembership.timezone}).format(new Date(offerFor(request.id)!.starts_at))}</p>{offerFor(request.id)?.staff_name?<p>Staff: {offerFor(request.id)?.staff_name}</p>:null}<p className="mt-2 whitespace-pre-wrap">{offerFor(request.id)?.message}</p></div>:null}
        {alternatives.error?<p role="alert" className="text-sm text-status-danger">Alternative offers could not be loaded. Check that migration 0108 is installed, then refresh.</p>:<form id="booking-request-propose-form" action={proposeAlternative} className="space-y-4 rounded-ui-md border border-admin-border p-4">
          <h3 className="font-medium">Suggest an alternative</h3>
          <p className="text-sm text-admin-text-secondary">Offer another date or staff member instead of declining. The client can accept or cancel from their private booking link. Acceptance returns here for final confirmation; no time is held yet.</p>
          <input type="hidden" name="id" value={request.id}/><input type="hidden" name="version" value={offerFor(request.id)?.version??0}/>
          <label className="block text-sm font-medium">Proposed date and time ({activeMembership.timezone})<input id="booking-alternative-start" type="datetime-local" name="startsAt" required defaultValue={inputDateTimeInZone(offerFor(request.id)?.starts_at??request.preferred_at,activeMembership.timezone)} className="mt-2 min-h-11 w-full min-w-0 rounded-ui-md border border-admin-border bg-white px-3"/></label>
          <label htmlFor="booking-alternative-staff" className="block text-sm font-medium">{petCare?"Suggested groomer":"Suggested staff (optional)"}</label>
          <SearchableSelect id="booking-alternative-staff" name="staffId" required={petCare} options={availableStaff.map(s=>({id:s.id,name:s.full_name}))} placeholder="Choose the requested staff or suggest another"/>
          {petCare?<><label htmlFor="booking-alternative-resource" className="block text-sm font-medium">Resource</label><SearchableSelect id="booking-alternative-resource" name="resourceId" required options={resources?.data??[]} placeholder="Choose resource"/></>:null}
          <label className="block text-sm font-medium">Message to the client (optional)<textarea id="booking-alternative-message" name="message" maxLength={1000} placeholder="Explain the suggested time or staff member." className="mt-2 min-h-24 w-full rounded-ui-md border border-admin-border bg-white p-3"/></label>
          {staff.error||resources?.error?<p role="alert" className="text-sm text-status-danger">Staff or resource options could not be loaded. Refresh before proposing.</p>:null}
          <SubmitButton id="booking-alternative-propose" pendingText="Publishing…" disabled={Boolean(staff.error||resources?.error)}>{offerFor(request.id)?"Update suggestion":"Propose alternative"}</SubmitButton>
          <p className="text-xs text-admin-text-secondary">Published on the client&apos;s booking status page. No email or SMS is sent.</p>
        </form>}
        <form id={`booking-request-decline-form-${request.id}`} action={reviewBooking} className="min-w-0 border-t border-admin-border pt-5">
          <input type="hidden" name="id" value={request.id} />
          <input type="hidden" name="action" value="decline" />
          <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div className="min-w-0">
              <label className="mb-1.5 block text-sm font-medium" htmlFor={`booking-request-decline-reason-${request.id}`}>
                Decline reason <span className="font-normal text-admin-text-secondary">(optional)</span>
              </label>
              <input id={`booking-request-decline-reason-${request.id}`} name="reason" maxLength={1000} placeholder="Why can’t this request be accepted?" className="min-h-11 w-full min-w-0 rounded-ui-md border border-admin-border bg-admin-surface px-3 text-sm text-admin-text placeholder:text-admin-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary" />
            </div>
            <SubmitButton id={`booking-request-decline-button-${request.id}`} className="w-full sm:w-auto" pendingText="Declining…" variant="destructive">
              <XIcon aria-hidden="true" size={16} className="shrink-0" />Decline
            </SubmitButton>
          </div>
        </form>
      </section>
    ) : null
  );

  return (
    <main id="booking-requests-page" className="mx-auto w-full min-w-0 max-w-6xl">
      <PageHeader id="booking-requests-page-header" eyebrow={activeMembership.branchName} title="Booking requests" description="Review requests from your public page and confirm appointments."/>

      <FormMessage {...params} />

      <ListTabs id="booking-requests-tabs" baseHref="/dashboard/bookings" query={params} value={status} options={[{value:"requested",label:"Pending",count:bookingRequests.filter(r=>r.status==="requested").length},{value:"awaiting_client",label:"Awaiting client"},{value:"accepted",label:"Client accepted"},{value:"confirmed",label:"Confirmed"},{value:"declined",label:"Declined"},{value:"all",label:"All"}]}/>
      <CompactFilters id="booking-requests-search-form" searchLabel="Search booking requests" search={<input id="booking-requests-search" name="q" defaultValue={params.q} maxLength={120} placeholder="Customer, reference, or service" type="search" enterKeyHint="search" className="min-h-11 w-full min-w-0 rounded-ui-md border border-admin-border bg-admin-surface px-3 py-2 text-sm"/>} searchValue={params.q} hiddenFields={<><input type="hidden" name="status" value={status}/></>}><Button id="booking-requests-search-button" variant="secondary" type="submit"><Search size={16} aria-hidden="true"/>Search</Button></CompactFilters>
      {error ? <Card id="booking-requests-error" className="mt-5 p-6 text-center" role="alert"><h2 className="font-medium">Could not load booking requests</h2><Button id="booking-requests-retry-button" asChild className="mt-4" variant="secondary"><Link href={closeHref}><RefreshCwIcon size={16} aria-hidden="true"/>Try again</Link></Button></Card> : <section id="booking-requests-list" aria-label="Online booking requests">
        <RecordTable id="booking-requests-table" emptyId="booking-requests-empty-state" caption="Online booking requests" empty="No booking requests match this view." columns={[{key:"customer",label:"Customer / request"},{key:"services",label:"Services",secondary:true},{key:"schedule",label:"Requested time",secondary:true},{key:"status",label:"Status",align:"right"}]} rows={filtered.map(request=>({id:`booking-request-card-${request.id}`,cells:{
          customer:<><RecordLink id={`booking-request-link-${request.id}`} href={`${closeHref}${closeHref.includes("?")?"&":"?"}requestId=${request.id}`}>{petDetails(request)?.pet_name?`${petDetails(request)?.pet_name} · `:""}{request.customer_name}</RecordLink><p className="mt-1 text-xs text-admin-text-secondary">{request.public_reference} · {request.phone}</p>{activeMembership.industry==="automotive"&&<p className="mt-1 text-xs">{request.vehicle_make} {request.vehicle_model}</p>}</>,
          services:request.public_booking_services.map(service=>service.service_name_snapshot).join(", "),schedule:new Intl.DateTimeFormat("en-PH",{dateStyle:"medium",timeStyle:"short",timeZone:activeMembership.timezone}).format(new Date(request.preferred_at)),status:<span id={`booking-request-status-${request.id}`} className="inline-flex rounded-full bg-admin-surface-muted px-2 py-1 text-xs font-medium capitalize">{requestStatus(request)}</span>,
        },mobile:<><p>{request.public_booking_services.map(service=>service.service_name_snapshot).join(", ")}</p><p>{new Intl.DateTimeFormat("en-PH",{dateStyle:"medium",timeStyle:"short",timeZone:activeMembership.timezone}).format(new Date(request.preferred_at))}</p></>}))}/>
        <p className="mt-3 text-sm text-admin-text-secondary">{filtered.length} requests · Select a row to review its details.</p>
      </section>}
      {selected ? (
        <FormDialog id="booking-request-details-dialog" title={selected.customer_name} description="Booking request details" closeHref={closeHref} size="lg">
          <dl className="grid min-w-0 gap-x-6 gap-y-5 text-sm sm:grid-cols-2">
            {[
              ["Reference", selected.public_reference],
              ["Status", requestStatus(selected)],
              ["Requested time", new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: activeMembership.timezone }).format(new Date(selected.preferred_at))],
              ["Contact", [selected.phone, selected.email].filter(Boolean).join("\n")],
              ...(petCare ? [["Pet", [petDetails(selected)?.pet_name ?? "Pet name not provided", petDetails(selected)?.species, petDetails(selected)?.breed].filter(Boolean).join(" · ")]] : activeMembership.industry === "automotive" ? [["Vehicle", [selected.vehicle_make, selected.vehicle_model].filter(Boolean).join(" ") || "Not provided"]] : []),
              ["Services", selected.public_booking_services.map(service => service.service_name_snapshot).join(", ") || "No services listed"],
              ["Customer note", selected.customer_note || "No note provided"],
            ].map(([label, value]) => (
              <div key={label} className={`min-w-0 ${label === "Customer note" ? "rounded-ui-md border border-admin-border bg-admin-surface-muted p-4 sm:col-span-2" : ""}`}>
                <dt className="mb-1 text-xs font-medium text-admin-text-secondary">{label}</dt>
                <dd className={`whitespace-pre-wrap leading-relaxed [overflow-wrap:anywhere] ${label === "Status" ? "inline-flex rounded-full bg-admin-surface-muted px-2.5 py-1 text-xs font-medium capitalize" : ""}`}>{value}</dd>
              </div>
            ))}
          </dl>
          {reviewForm(selected)}
        </FormDialog>
      ) : null}
    </main>
  );
}
