import { randomUUID } from "node:crypto";
import { saveAppointmentWalkIn } from "@/app/dashboard/appointments/walk-in-actions";
import { notFound,redirect } from "next/navigation";

import { saveAppointment } from "@/app/dashboard/operations-actions";
import { VisitForm } from "@/components/operations-forms";
import { FormDialog } from "@/components/management-ui";
import { getDashboardContext } from "@/lib/auth/context";
import { getVisitChoices } from "@/lib/operations-data";
import { createClient } from "@/lib/supabase/server";
import { resolveIndustryConfig } from "@/modules/platform/industry";

type MaintenanceDefaults={id:string;branch_id:string;customer_id:string;customer_name:string;vehicle_id:string;service_id:string;appointment_id:string|null;appointment_status:string|null};

export default async function Page({searchParams}:{searchParams:Promise<{mode?:string;customerQ?:string;customerId?:string;vehicleId?:string;serviceId?:string;maintenanceDueId?:string;error?:string}>}){
  const query=await searchParams;
  const[{activeMembership},supabase]=await Promise.all([getDashboardContext(),createClient()]);
  if(activeMembership.industry==="pet_care") redirect(`/dashboard/pet-care/appointments?dialog=${query.mode==="walk-in"?"walk-in":"create"}${query.customerId?`&customerId=${encodeURIComponent(query.customerId)}`:""}`);
  let maintenance:MaintenanceDefaults|null=null;
  if(query.maintenanceDueId&&activeMembership.industry==="automotive"){
    const {isMaintenanceAppointmentActive}=await import("@/modules/automotive/maintenance/reminder-eligibility");
    const{data}=await supabase.from("vehicle_maintenance_directory").select("id,branch_id,customer_id,customer_name,vehicle_id,service_id,appointment_id,appointment_status")
      .eq("id",query.maintenanceDueId).eq("organization_id",activeMembership.organizationId).eq("lifecycle_status","active").maybeSingle();
    if(!data)notFound();
    maintenance=data as MaintenanceDefaults;
    if(maintenance.appointment_id&&isMaintenanceAppointmentActive(maintenance.appointment_status as Parameters<typeof isMaintenanceAppointmentActive>[0]))redirect(`/dashboard/appointments/${maintenance.appointment_id}?message=This+maintenance+already+has+an+active+appointment.`);
  }
  const choices=await getVisitChoices(query.customerQ??maintenance?.customer_name, {customerId:maintenance?.customer_id??query.customerId,vehicleId:maintenance?.vehicle_id??query.vehicleId,serviceIds:[maintenance?.service_id??query.serviceId??""].filter(Boolean)});
  const customerId=maintenance?.customer_id??(choices.customers.some(customer=>customer.id===query.customerId)?query.customerId:undefined);
  const requestedVehicleId=maintenance?.vehicle_id??query.vehicleId;
  const vehicle=choices.vehicles.find(candidate=>candidate.id===requestedVehicleId&&(!customerId||candidate.customer_id===customerId));
  const requestedServiceId=maintenance?.service_id??query.serviceId;
  const serviceId=choices.services.some(service=>service.id===requestedServiceId)?requestedServiceId:undefined;
  const branchId=maintenance?.branch_id??activeMembership.branchId;
  const config=resolveIndustryConfig(activeMembership.industry),salon=config.key==="salon";
  const walkIn=salon&&query.mode==="walk-in";
  const form=<VisitForm currency={activeMembership.currency} requestId={walkIn?randomUUID():undefined} canCreateCatalog={["owner","manager"].includes(activeMembership.role)} mode={walkIn?"walk_in":"appointment"} action={walkIn?saveAppointmentWalkIn:saveAppointment} requiresVehicle={!salon} customerLabel={config.terminology.customer} serviceLabel={config.terminology.service} resourceLabel={config.terminology.resource} idPrefix={salon?(walkIn?"salon-walk-in":"salon-appointment"):"appointment"} defaults={{customerId,vehicleId:vehicle?.id,serviceId,branchId,maintenanceDueId:maintenance?.id}} branches={activeMembership.branches.map(branch=>({id:branch.id,name:branch.name}))} customers={choices.customers} vehicles={choices.vehicles} services={choices.services} staff={choices.staff} resources={choices.resources} customerQ={query.customerQ} error={query.error}/>;
  if(salon) return <main id="salon-appointment-create-page"><FormDialog id="salon-appointment-create-dialog" title={walkIn?"Add walk-in":"New appointment"} description={walkIn?"Register an arriving client and check them in in one step.":"Choose a client, treatment, staff member, and station."} closeHref="/dashboard/appointments" size="xl">{form}</FormDialog></main>;
  return <main id="appointment-create-page" className="mx-auto max-w-3xl"><p className="text-sm font-medium text-brand-primary">Appointments</p><h1 className="mt-1 text-3xl font-medium">Book appointment</h1><p className="mt-2 text-zinc-600">{maintenance?"This appointment will be linked to the selected maintenance requirement.":"Availability, duration, and pricing are validated before saving."}</p><div className="mt-6">{form}</div></main>;
}
