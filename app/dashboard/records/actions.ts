"use server";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {z} from "zod";
import {getDashboardContext} from "@/lib/auth/context";
import {createClient} from "@/lib/supabase/server";
export async function removeRecord(_state:{error?:string;message?:string},form:FormData):Promise<{error?:string;message?:string}> {
 const parsed=z.object({id:z.uuid(),kind:z.enum(["product","promo","staff","room","service","resource"])}).safeParse(Object.fromEntries(form));
 if(!parsed.success)return {error:"Invalid record. Reload and try again."};
 const {activeMembership:m}=await getDashboardContext();
 if(!["owner","manager"].includes(m.role))return {error:"Management access is required."};
 const db=await createClient();
 const {data,error}=await db.rpc("remove_business_record",{p_org:m.organizationId,p_branch:m.branchId,p_kind:parsed.data.kind,p_id:parsed.data.id});
 if(error)return {error:error.code==="PGRST202"?"Removal needs database setup. Apply migration 0113.":error.code==="42501"?"This record is unavailable or you do not have permission to remove it.":error.code==="22023"?"This record is protected or still in use. Check out occupied rooms first; owner and your own staff profiles cannot be removed.":"Unable to remove this record. Refresh and try again."};
 revalidatePath("/dashboard","layout"); revalidatePath("/shop/[slug]","layout");
 const destinations={product:"/dashboard/products",promo:"/dashboard/promos",staff:"/dashboard/settings/staff",room:"/dashboard/hospitality/rooms",service:"/dashboard/services",resource:"/dashboard/settings/resources"};
 const message=data==="archived"?"Archived. Existing history has been preserved.":"Deleted successfully.";
 redirect(`${destinations[parsed.data.kind]}?message=${encodeURIComponent(message)}`);
}
