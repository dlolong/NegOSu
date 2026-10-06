"use client";
import {CatalogItemThumbnail} from "@/components/catalog-item-thumbnail";
import {useState} from "react";
import {saveCheckoutProduct} from "@/app/dashboard/checkout/actions";
import {Input} from "@/components/ui/input";
import {SubmitButton} from "@/components/submit-button";
import {formatMoney} from "@/lib/operations";
import {quantityAmountCentavos} from "@/modules/core/commerce/quantity";
import type {CheckoutCatalogProduct} from "@/modules/core/checkout/contracts";
export function CheckoutProductChoice({product:p,checkoutId,currency,request}:{product:CheckoutCatalogProduct;checkoutId:string;currency:string;request:string}){
 const [quantity,setQuantity]=useState("1");let amount:number|null=null;try{amount=Number(quantityAmountCentavos(quantity,BigInt(p.price)));}catch{}
 const unavailable=p.stock_tracked&&Number(p.available)<=0;
 return <form id={`checkout-product-row-${p.id}`} action={saveCheckoutProduct} className="min-w-0 rounded-xl border border-admin-border p-3"><input type="hidden" name="checkoutId" value={checkoutId}/><input type="hidden" name="productId" value={p.id}/><input type="hidden" name="request" value={request}/><CatalogItemThumbnail id={`checkout-product-photo-${p.id}`} url={p.thumbnail_url} name={p.name} subject="product"/><h3 className="mt-2 break-words">{p.name}</h3><p className="text-sm text-admin-text-secondary">{p.category||"Other products"}{p.sku?` · ${p.sku}`:""}</p><p className="mt-1 text-sm">{formatMoney(p.price,currency)} / {p.unit} · {p.stock_tracked?`Available: ${p.available} ${p.unit}`:"Stock not tracked"}</p><div className="mt-3 flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1 text-sm" htmlFor={`checkout-product-quantity-${p.id}`}>Quantity<Input id={`checkout-product-quantity-${p.id}`} name="quantity" inputMode="decimal" value={quantity} onChange={e=>setQuantity(e.target.value)} required/></label><SubmitButton id={`checkout-product-add-${p.id}`} disabled={unavailable||amount===null} pendingText="Adding…">{unavailable?"Out of stock":"Add product"}</SubmitButton></div><p className="mt-2 text-sm" aria-live="polite">Amount: {amount===null?"Enter a valid quantity":formatMoney(amount,currency)}</p></form>;
}
