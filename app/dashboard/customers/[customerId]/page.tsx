import { RecordTable } from "@/components/record-table";
import { PageHeader } from "@/components/page-patterns";
import { Tabs } from "@/components/ui/tabs";
import { clientDetailTab } from "@/lib/client-detail-navigation";
import { z } from "zod";

import { Pencil as PencilIcon, Plus as PlusIcon, RefreshCw as RefreshCwIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ClientFollowUp, ClientPurchases, HistoryNavigation } from "@/components/client-follow-up";
import { historyPage } from "@/modules/core/crm/client-reminders";

import { archiveCustomer } from "@/app/dashboard/crm-actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDashboardContext } from "@/lib/auth/context";
import { displayPhone } from "@/lib/crm";
import { createClient } from "@/lib/supabase/server";

type CustomerRecord={id:string;full_name:string;phone:string|null;email:string|null;address_line:string|null;city:string|null;province:string|null;notes:string|null;is_archived:boolean;created_at:string;vehicles?:Array<{id:string;make:string|null;model:string|null;model_year:number|null;plate_number:string|null;is_archived:boolean}>};

export default async function Page({params,searchParams}:{params:Promise<{customerId:string}>;searchParams:Promise<{tab?:string;q?:string;from?:string;to?:string;message?:string;error?:string;historyPage?:string;productsPage?:string;remindersPage?:string}>}){
  const[{customerId},query,{activeMembership},supabase]=await Promise.all([params,searchParams,getDashboardContext(),createClient()]);
  if(activeMembership.industry === "hospitality") { const { HospitalityGuestDetail } = await import("@/components/hospitality/guests"); return <HospitalityGuestDetail guestId={customerId} query={query}/>; }
  if (!z.uuid().safeParse(customerId).success) notFound();
  const tab = clientDetailTab(query);
  const salon=activeMembership.industry!=="automotive";
  const projection=salon?"id,full_name,phone,email,address_line,city,province,notes,is_archived,created_at":"id,full_name,phone,email,address_line,city,province,notes,is_archived,created_at,vehicles(id,make,model,model_year,plate_number,is_archived)";
  const customerResult=await supabase.from("customers").select(projection).eq("id",customerId).eq("organization_id",activeMembership.organizationId).maybeSingle();
  const data=customerResult.data as unknown as CustomerRecord|null;
  if(customerResult.error) return <main className="mx-auto max-w-5xl"><PageHeader id="client-detail-error-header" title="Client details"/><p role="alert" className="mt-4">Client details could not be loaded. Please try again.</p></main>;
  if(!data)notFound();
  const page = historyPage(query.historyPage);
  const{data:appointments,error:historyError}=tab === "history"?await supabase.from("appointments").select("id,status,starts_at,created_at,branches(name,timezone),appointment_services(service_name_snapshot)").eq("organization_id",activeMembership.organizationId).eq("customer_id",customerId).order("starts_at",{ascending:false,nullsFirst:false}).order("id").range((page-1)*20,page*20):{data:[],error:null};
  const pets=tab === "history" && activeMembership.industry==="pet_care"?await supabase.from("pet_profiles").select("id,name,species,is_active").eq("organization_id",activeMembership.organizationId).eq("customer_id",customerId).order("name"):null;
  const canWrite=["owner","manager","advisor"].includes(activeMembership.role);
  return <main id={salon?"salon-client-detail-page":"customer-detail-page"} className="mx-auto min-w-0 max-w-5xl [overflow-wrap:anywhere]">
    <PageHeader id="client-detail-header" title={data.full_name} description={activeMembership.industry === "pet_care" ? "Pet owner profile" : salon ? "Client profile" : "Customer profile"}
      back={<Button asChild variant="ghost"><Link id="client-back-list" href="/dashboard/customers">Back to {salon ? "Clients" : "Customers"}</Link></Button>}
      action={canWrite ? <div className="flex flex-wrap gap-2"><Button asChild variant="secondary"><Link id="client-detail-edit" href={`/dashboard/customers?edit=${data.id}`}><PencilIcon aria-hidden="true" size={16}/>Edit</Link></Button>{!data.is_archived ? <Button asChild><Link id="customer-book-appointment-button" href={activeMembership.industry === "pet_care" ? `/dashboard/pet-care/appointments?dialog=create&customerId=${data.id}` : salon ? `/dashboard/appointments/new?customerId=${data.id}` : `/dashboard/vehicles/new?customerId=${data.id}`}><PlusIcon aria-hidden="true" size={16}/>{salon ? "Book appointment" : "Add vehicle"}</Link></Button> : null}</div> : undefined}/>
    <FormMessage {...query}/>
    <Card id="client-profile-details" className="mt-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-medium">Client details</h2><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${data.is_archived ? "bg-admin-surface-muted text-admin-text-secondary" : "bg-emerald-50 text-emerald-700"}`}>{data.is_archived ? "Archived" : "Active"}</span></div>
      <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div><dt className="text-admin-text-secondary">Phone</dt><dd className="mt-1 font-medium">{displayPhone(data.phone)}</dd></div>
        <div><dt className="text-admin-text-secondary">Email</dt><dd className="mt-1 font-medium">{data.email || "Not provided"}</dd></div>
        <div><dt className="text-admin-text-secondary">Client since</dt><dd className="mt-1 font-medium">{new Intl.DateTimeFormat("en-PH",{timeZone:activeMembership.timezone,dateStyle:"medium"}).format(new Date(data.created_at))}</dd></div>
        <div className="sm:col-span-2 lg:col-span-3"><dt className="text-admin-text-secondary">Address</dt><dd className="mt-1">{[data.address_line,data.city,data.province].filter(Boolean).join(", ") || "Not provided"}</dd></div>
      </dl>
      {data.notes ? <details id="client-profile-notes" className="mt-4 border-t border-admin-border pt-3"><summary className="cursor-pointer text-sm font-medium">Notes</summary><p className="mt-2 whitespace-pre-wrap text-sm">{data.notes}</p></details> : null}
      <details id="client-profile-options" className="mt-4 border-t border-admin-border pt-3"><summary className="cursor-pointer text-sm text-admin-text-secondary">More options</summary><div className="mt-3 flex flex-wrap items-center gap-3"><Button asChild variant="secondary" size="sm"><Link id="client-communication-preferences" href={`/dashboard/customers/${customerId}/preferences`}>Communication preferences</Link></Button>{canWrite ? <form action={archiveCustomer}><input type="hidden" name="id" value={data.id}/><input type="hidden" name="archived" value={String(!data.is_archived)}/><SubmitButton id="client-archive-button" size="sm" variant={data.is_archived ? "secondary" : "destructive"} pendingText="Updating…"><RefreshCwIcon aria-hidden="true" size={16}/>{data.is_archived ? "Restore client" : "Archive client"}</SubmitButton></form> : null}</div></details>
    </Card>
    <Tabs id="client-detail-tabs" ariaLabel="Client records" className="mt-5" items={[{id:"client-history-tab",label:"History",href:`/dashboard/customers/${customerId}?tab=history`,active:tab === "history"},{id:"client-products-tab",label:"Products bought",href:`/dashboard/customers/${customerId}?tab=products`,active:tab === "products"},{id:"client-reminders-tab",label:"Reminders",href:`/dashboard/customers/${customerId}?tab=reminders`,active:tab === "reminders"}]}/>
    <section id={`client-${tab}-panel`} aria-label={tab === "products" ? "Products bought" : tab === "reminders" ? "Reminders" : "History"}>
      {tab === "history" ? <><Card id="salon-client-appointments" className="mt-4 p-4 sm:p-5"><h2 className="font-medium">Appointment history</h2><RecordTable searchable id="client-appointments-table" className="mt-3" caption="Appointment history" columns={[{key:"services",label:"Services"},{key:"date",label:"Date and time",secondary:true},{key:"status",label:"Status"}]} rows={!historyError ? (appointments??[]).slice(0,20).map(appointment=>({id:`client-appointment-row-${appointment.id}`,cells:{services:<Link id={`salon-client-appointment-${appointment.id}`} href={activeMembership.industry === "pet_care" ? `/dashboard/pet-care/appointments/${appointment.id}?from=clients` : `/dashboard/appointments/${appointment.id}?from=clients`} className="font-medium underline">{appointment.appointment_services.map(item=>item.service_name_snapshot).join(", ") || "Appointment"}</Link>,date:<>{appointment.starts_at ? "" : "Walk-in · Recorded "}{new Intl.DateTimeFormat("en-PH",{dateStyle:"medium",timeStyle:"short",timeZone:(Array.isArray(appointment.branches)?appointment.branches[0]:appointment.branches)?.timezone??activeMembership.timezone}).format(new Date(appointment.starts_at ?? appointment.created_at))}</>,status:appointment.status.replaceAll("_"," ")}})) : []}/>{historyError?<p role="alert" className="mt-3 text-sm">Appointment history could not be loaded.</p>:<HistoryNavigation id="client-history-pagination" path={`/dashboard/customers/${customerId}?tab=history`} parameter="historyPage" page={page} hasMore={(appointments?.length??0)>20}/>}</Card>
    {pets?<Card id="customer-pets" className="mt-5 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-medium">Pets</h2>{canWrite&&!data.is_archived?<Button asChild variant="secondary"><Link id="customer-add-pet-button" href={`/dashboard/pet-care/pets?dialog=create&customerId=${data.id}`}><PlusIcon size={16} aria-hidden="true"/>Add pet</Link></Button>:null}</div>{pets.error?<p role="alert" className="mt-3 text-sm">Pet records could not be loaded.</p>:<div className="mt-3 grid gap-2">{pets.data?.map(pet=><Link id={`customer-pet-${pet.id}`} key={pet.id} href={`/dashboard/pet-care/pets/${pet.id}`} className="rounded-xl border p-3 text-sm [overflow-wrap:anywhere]">{pet.name} · {pet.species} · {pet.is_active?"Active":"Inactive"}</Link>)}{!pets.data?.length?<p className="text-sm">No pets registered for this owner yet.</p>:null}</div>}</Card>:null}
        {!salon ? <Card id="client-vehicles" className="mt-4 p-4 sm:p-5"><h2 className="font-medium">Vehicles</h2><RecordTable id="client-vehicles-table" className="mt-3" caption="Client vehicles" columns={[{key:"vehicle",label:"Vehicle"},{key:"plate",label:"Plate"}]} rows={(data.vehicles ?? []).filter(vehicle=>!vehicle.is_archived).map(vehicle=>({id:`client-vehicle-${vehicle.id}`,cells:{vehicle:<Link href={`/dashboard/vehicles/${vehicle.id}`} className="font-medium underline">{[vehicle.model_year,vehicle.make,vehicle.model].filter(Boolean).join(" ")}</Link>,plate:vehicle.plate_number || "Not recorded"}}))}/></Card> : null}
      </> : tab === "products" ? <ClientPurchases filters={{q:query.q,from:query.from,to:query.to}} customerId={customerId} timezone={activeMembership.timezone} page={historyPage(query.productsPage)}/> : <ClientFollowUp customerId={customerId} membership={activeMembership} archived={data.is_archived} page={historyPage(query.remindersPage)}/>}
    </section>
  </main>;
}
