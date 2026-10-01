import {loadCheckout} from "@/modules/core/checkout/runtime";
import type {CheckoutCatalogProduct} from "@/modules/core/checkout/contracts";
import {CheckoutWorkspace,type CheckoutQuery} from "@/components/checkout-workspace";
export default async function Page({params,searchParams}:{params:Promise<{checkoutId:string}>;searchParams:Promise<CheckoutQuery>}){
 const [{checkoutId},query]=await Promise.all([params,searchParams]);
 const {checkout,m,db}=await loadCheckout(checkoutId);
 const page=Math.max(1,Math.min(10000,Number(query.page)||1));
 const catalog=query.dialog==="products"?await db.rpc("search_checkout_products",{p_checkout:checkout.id,p_search:(query.q??"").slice(0,120),p_category:(query.category??"").slice(0,80),p_page:page}):null;
 return <CheckoutWorkspace checkout={checkout} branchName={m.branchName} industry={m.industry} query={query} products={(catalog?.data??[]) as CheckoutCatalogProduct[]} catalogError={Boolean(catalog?.error)}/>;
}
