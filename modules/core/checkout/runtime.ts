import "server-only";
import {notFound} from "next/navigation";
import {z} from "zod";
import {getDashboardContext} from "@/lib/auth/context";
import {createClient} from "@/lib/supabase/server";
import {checkoutRoles,checkoutLoadError,type Checkout} from "./contracts";
export async function loadCheckout(id:string){
 const {activeMembership:m}=await getDashboardContext();if(!checkoutRoles.includes(m.role)||!z.uuid().safeParse(id).success)notFound();
 const db=await createClient();const {data:scope}=await db.from("checkouts").select("id").eq("id",id).eq("organization_id",m.organizationId).eq("branch_id",m.branchId).maybeSingle();if(!scope)notFound();
 const {data,error}=await db.rpc("get_checkout",{p_checkout:id});
 if(error||!data){
  // Log the diagnostic code only: SQL details can contain customer data.
  console.error("[checkout] get_checkout failed", {code:error?.code??"EMPTY_RESPONSE"});
  throw new Error(checkoutLoadError(error?.code));
 }
 return {checkout:data as Checkout,m:{...m,timezone:(data as Checkout).timezone},db};
}
