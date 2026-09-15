import "server-only";
import { z } from "zod";
import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

export async function getVisitChoices(customerQ?:string, selected: {customerId?:string;vehicleId?:string;serviceIds?:string[]} = {}) {
  const[{activeMembership},supabase]=await Promise.all([getDashboardContext(),createClient()]);
  const q=customerQ?.trim().replace(/[,%()]/g," ").slice(0,100);
  let customerQuery=supabase.from("customers").select("id,full_name").eq("organization_id",activeMembership.organizationId).eq("is_archived",false).order("full_name").limit(q?50:25);
  if(q) customerQuery=customerQuery.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`);
  const vehicleQuery=activeMembership.industry==="automotive"?supabase.from("vehicles").select("id,customer_id,make,model,model_year,plate_number").eq("organization_id",activeMembership.organizationId).eq("is_archived",false).order("make").limit(250):Promise.resolve({data:[],error:null});
  const[{data:customers},{data:vehicles},{data:services},{data:staff},{data:resources}]=await Promise.all([customerQuery,vehicleQuery,supabase.from("services").select("id,name,base_price_centavos,duration_minutes").eq("organization_id",activeMembership.organizationId).eq("is_active",true).order("name").limit(250),supabase.from("staff_directory").select("staff_id,full_name,branch_ids").eq("organization_id",activeMembership.organizationId).eq("is_active",true),supabase.from("scheduling_resources").select("id,name,branch_id,capacity").eq("organization_id",activeMembership.organizationId).eq("is_active",true).order("name")]);
  // Keep preselected records visible even when they fall outside the first page.
  const uuid=(value?:string)=>z.uuid().safeParse(value).success;
  const [selectedCustomer,selectedVehicle,selectedServices]=await Promise.all([
    uuid(selected.customerId)?supabase.from("customers").select("id,full_name").eq("organization_id",activeMembership.organizationId).eq("id",selected.customerId!).eq("is_archived",false).maybeSingle():Promise.resolve({data:null}),
    activeMembership.industry==="automotive"&&uuid(selected.vehicleId)?supabase.from("vehicles").select("id,customer_id,make,model,model_year,plate_number").eq("organization_id",activeMembership.organizationId).eq("id",selected.vehicleId!).eq("is_archived",false).maybeSingle():Promise.resolve({data:null}),
    selected.serviceIds?.length?supabase.from("services").select("id,name,base_price_centavos,duration_minutes").eq("organization_id",activeMembership.organizationId).in("id",selected.serviceIds.filter(uuid)).eq("is_active",true):Promise.resolve({data:[]}),
  ]);
  if(selectedCustomer.data&&!customers?.some(row=>row.id===selectedCustomer.data!.id))customers?.push(selectedCustomer.data);
  const vehicleRows=[...(vehicles??[])];
  if(selectedVehicle.data&&!vehicleRows.some(row=>row.id===selectedVehicle.data!.id))vehicleRows.push(selectedVehicle.data);
  for(const row of selectedServices.data??[])if(!services?.some(service=>service.id===row.id))services?.push(row);
  let vehicleChoices:Array<{id:string;customer_id:string;label:string}>=[];
  if(activeMembership.industry==="automotive") {
    const {automotiveAppointmentVehicleLabel}=await import("@/modules/automotive/appointments");
    vehicleChoices=vehicleRows.map(vehicle=>({id:vehicle.id,customer_id:vehicle.customer_id,label:automotiveAppointmentVehicleLabel({make:vehicle.make,model:vehicle.model,plateNumber:vehicle.plate_number})}));
  }
  return {activeMembership,customers:(customers??[]).map(customer=>({id:customer.id,name:customer.full_name})),vehicles:vehicleChoices,services:services??[],staff:(staff??[]).map(member=>({id:member.staff_id,name:member.full_name??"Staff member",branchIds:member.branch_ids??[]})),resources:resources??[]};
}
