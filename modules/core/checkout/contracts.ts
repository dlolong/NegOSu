import { z } from "zod";
import { quantityThousandths } from "@/modules/core/commerce/quantity";
export const checkoutRoles = ["owner", "manager", "cashier"];
export function checkoutLoadError(code?: string) {
 if (["42702", "42703", "42883", "42P01", "PGRST202", "PGRST205"].includes(code ?? "")) {
  return "Checkout needs a database update. Apply pending checkout migrations through 0111, then reopen Checkout.";
 }
 if (code === "42501") return "Checkout is unavailable in your branch, or you do not have permission.";
 return "Checkout could not be loaded. Try again; if this continues, ask your administrator to check the server logs.";
}
export const checkoutQuantity = z.string().refine(value=>{try{return quantityThousandths(value)<=999999000n;}catch{return false;}},"Use a positive quantity with up to three decimals.");
export type CheckoutProduct={id:string;inventory_item_id:string;name:string;unit:string;quantity:number;unit_price_centavos:number;line_total_centavos:number;stock_tracked:boolean;reservation_id:string|null;reserved:number;invoice_id:string|null;invoiceStatus:string|null;included_key:string|null;promo_name:string|null;handed_over:number;returned:number;version:number};
export type Checkout={id:string;customer:string;customerId:string|null;appointmentId:string|null;sourceInvoiceId:string|null;currency:string;timezone:string;createdAt:string;total:number;paid:number;balance:number;tax:number;discount:number;hasDraft:boolean;draftTotal:number;baseLines:Array<{name:string;quantity:number;unitPrice:number;amount:number}>;products:CheckoutProduct[];promos:Array<{id:string;name:string;services:string[];products:Array<{name:string;quantity:string;unit:string}>}>;invoices:Array<{id:string;number:string;status:string;total:number;paid:number;balance:number}>;payments:Array<{id:string;amount:number;currency:string;method:string;reference:string|null;date:string;status:string;invoiceId:string|null}>};
export type CheckoutCatalogProduct={thumbnail_url?:string|null;id:string;name:string;sku:string|null;category:string|null;unit:string;price:number;stock_tracked:boolean;available:number|null};
export function checkoutError(error:{code?:string;message?:string}|null){
 if(["PGRST202","PGRST205","42P01","42883"].includes(error?.code??""))return "Checkout needs database setup. Apply migration 0109, then try again.";
 if(error?.code==="42501")return "This product or checkout is unavailable in your branch, or you do not have permission.";
 if(error?.code==="40001")return "The checkout changed. Reload before continuing.";
 if(error?.message?.includes("stock")||error?.message?.includes("reserved quantity"))return "There is not enough available stock. Refresh quantities before trying again.";
 if(error?.message?.includes("Posted")||error?.message?.includes("handed-over"))return "This product is already posted or handed over. Use a return or separate financial adjustment.";
 if(error?.message?.includes("Request reused"))return "This action was already used with different details. Reload before making another change.";
 if(error?.message?.includes("remaining balance"))return "The payment exceeds the remaining balance. Refresh the order summary.";
 return "Unable to complete this action. Check the quantity, stock and transaction status, then refresh.";
}
