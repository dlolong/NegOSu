import { z } from "zod";
export const basketSchema=z.array(z.object({productId:z.uuid(),quantity:z.string().max(20),branchId:z.uuid()})).max(20);
export type BasketItem=z.infer<typeof basketSchema>[number];
export const basketKey=(slug:string)=>`negosu-basket:${slug}`;
export function readBasket(slug:string):BasketItem[]{
 try {return basketSchema.parse(JSON.parse(localStorage.getItem(basketKey(slug))??"[]"));}catch{return [];}
}
export function writeBasket(slug:string,items:BasketItem[]){
 localStorage.setItem(basketKey(slug),JSON.stringify(items));
 window.dispatchEvent(new Event("negosu-basket-change"));
}
