"use server";
import {randomUUID} from "node:crypto";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {z} from "zod";
import {getDashboardContext} from "@/lib/auth/context";
import {createClient} from "@/lib/supabase/server";
import {parseCatalogPrice} from "@/modules/core/commerce/pricing";
import {checkoutError,checkoutQuantity,checkoutRoles} from "@/modules/core/checkout/contracts";
import {paymentMethods} from "@/modules/core/payments/payment.service";
const str=(data:FormData,key:string)=>String(data.get(key)??"");
async function context(){const {activeMembership:m}=await getDashboardContext();if(!checkoutRoles.includes(m.role))redirect("/dashboard?error=Checkout+access+required.");return {m,db:await createClient()};}
async function checkoutContext(id:string){const {m,db}=await context();if(!z.uuid().safeParse(id).success)redirect("/dashboard?error=Invalid+checkout.");const {data}=await db.from("checkouts").select("id").eq("id",id).eq("organization_id",m.organizationId).eq("branch_id",m.branchId).maybeSingle();if(!data)redirect("/dashboard?error=Checkout+unavailable+in+this+branch.");return {m,db};}
function refresh(id:string){revalidatePath(`/dashboard/checkout/${id}`);revalidatePath("/dashboard/payments");revalidatePath("/dashboard/inventory");revalidatePath("/dashboard/reports");}
export async function openCheckout(data:FormData){
 const {m,db}=await context();const parsed=z.object({appointmentId:z.uuid().nullable(),invoiceId:z.uuid().nullable(),customerId:z.uuid().nullable(),request:z.uuid()}).safeParse({appointmentId:str(data,"appointmentId")||null,invoiceId:str(data,"invoiceId")||null,customerId:str(data,"customerId")||null,request:str(data,"request")});
 if(!parsed.success)redirect("/dashboard/checkout/new?error=Choose+a+customer+or+transaction.");
 const p=parsed.data;const {data:id,error}=await db.rpc("open_checkout",{p_branch:m.branchId,p_appointment:p.appointmentId,p_invoice:p.invoiceId,p_customer:p.customerId,p_request:p.request});
 if(error||!id)redirect(`/dashboard/checkout/new?error=${encodeURIComponent(checkoutError(error))}`);
 redirect(`/dashboard/checkout/${id}`);
}
export async function saveCheckoutProduct(data:FormData){
 const id=str(data,"checkoutId"),{db}=await checkoutContext(id);const product=str(data,"productId"),request=str(data,"request"),line=str(data,"lineId");
 const quantity=str(data,"quantity");if(!z.uuid().safeParse(product).success||!z.uuid().safeParse(request).success||(line&&!z.uuid().safeParse(line).success)||(quantity!=="0"&&!checkoutQuantity.safeParse(quantity).success))redirect(`/dashboard/checkout/${id}?error=Enter+a+valid+product+and+quantity.`);
 const {error}=await db.rpc("save_checkout_product",{p_checkout:id,p_line:line||null,p_version:Number(str(data,"version")),p_product:product,p_quantity:quantity,p_request:request});
 if(error)redirect(`/dashboard/checkout/${id}?error=${encodeURIComponent(checkoutError(error))}`);refresh(id);redirect(`/dashboard/checkout/${id}?message=Product+updated.+Stock+is+reserved+until+handover.`);
}
export async function acceptCheckoutInclusions(data:FormData){const id=str(data,"checkoutId"),{db}=await checkoutContext(id);const {error}=await db.rpc("accept_checkout_inclusions",{p_checkout:id,p_request:randomUUID()});if(error)redirect(`/dashboard/checkout/${id}?error=${encodeURIComponent(checkoutError(error))}`);refresh(id);redirect(`/dashboard/checkout/${id}?message=Included+products+reserved.+No+extra+charge.`);}
export async function fulfillCheckoutProduct(data:FormData){
 const id=str(data,"checkoutId"),{db}=await checkoutContext(id);const parsed=z.object({line:z.uuid(),quantity:checkoutQuantity,action:z.enum(["handover","return"]),request:z.uuid()}).safeParse({line:str(data,"lineId"),quantity:str(data,"quantity"),action:str(data,"action"),request:str(data,"request")});
 if(!parsed.success)redirect(`/dashboard/checkout/${id}?error=Check+the+product+and+quantity.`);const p=parsed.data;
 const {error}=await db.rpc("fulfill_checkout_product",{p_checkout:id,p_line:p.line,p_quantity:p.quantity,p_action:p.action,p_request:p.request});if(error)redirect(`/dashboard/checkout/${id}?error=${encodeURIComponent(checkoutError(error))}`);refresh(id);redirect(`/dashboard/checkout/${id}?message=${p.action==="return"?"Return+recorded.+Refund+is+a+separate+financial+action.":"Handover+recorded.+Inventory+updated."}`);
}
export async function finalizeCheckout(data:FormData){const id=str(data,"checkoutId"),{db}=await checkoutContext(id),key=str(data,"request");if(!z.uuid().safeParse(key).success)redirect(`/dashboard/checkout/${id}?error=Reload+before+continuing.`);const {error}=await db.rpc("finalize_checkout",{p_checkout:id,p_request:key});if(error)redirect(`/dashboard/checkout/${id}?error=${encodeURIComponent(checkoutError(error))}`);refresh(id);redirect(`/dashboard/checkout/${id}/payment`);}
export async function payCheckout(data:FormData){
 const id=str(data,"checkoutId"),{db}=await checkoutContext(id);const amount=parseCatalogPrice(str(data,"amount"));const parsed=z.object({method:z.enum(paymentMethods),request:z.uuid(),date:z.iso.date(),reference:z.string().trim().max(100)}).safeParse({method:str(data,"method"),request:str(data,"request"),date:str(data,"date"),reference:str(data,"reference")});
 if(!parsed.success||amount===null||amount<=0)redirect(`/dashboard/checkout/${id}/payment?error=Check+payment+details.`);const p=parsed.data;
 const {error}=await db.rpc("record_checkout_payment",{p_checkout:id,p_amount:amount,p_method:p.method,p_reference:p.reference||null,p_date:p.date,p_request:p.request});if(error)redirect(`/dashboard/checkout/${id}/payment?error=${encodeURIComponent(checkoutError(error))}`);refresh(id);redirect(`/dashboard/checkout/${id}/receipt?message=Payment+recorded.`);
}
