import {loadCheckout} from "@/modules/core/checkout/runtime";
import {CheckoutPayment} from "@/components/checkout-payment";
export default async function Page({params,searchParams}:{params:Promise<{checkoutId:string}>;searchParams:Promise<{error?:string}>}){
 const [{checkoutId},query]=await Promise.all([params,searchParams]);
 const {checkout,m}=await loadCheckout(checkoutId);
 return <CheckoutPayment checkout={checkout} timezone={m.timezone} error={query.error}/>;
}
