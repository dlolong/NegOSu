"use client";
import { useActionState, useState, useRef, useEffect } from "react";
import { submitProductBasket } from "@/app/shop/[slug]/product-actions";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, MapPin, ShoppingBasket, Trash2, UserRound } from "lucide-react";
import { ServiceThumbnail } from "@/components/service-thumbnail";
import { Button } from "@/components/ui/button";
import { readBasket, writeBasket, type BasketItem } from "@/lib/public-basket";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { formatMoney } from "@/lib/operations";
import { quantityAmountCentavos } from "@/modules/core/commerce/quantity";
import type { PublicProduct } from "@/lib/public-booking";
import type { PublicProductOrderState } from "@/modules/core/commerce/public-product-orders";
export function PublicBasketForm({ slug, products, requestKey }: { slug: string; products: PublicProduct[]; requestKey: string }) {
  const submitting = useRef(false);
  const [state, action, pending] = useActionState(async (previous: PublicProductOrderState, data: FormData) => {
    try { const result=await submitProductBasket(previous, data); if(result.reference){try{writeBasket(slug,[]);}catch{/* Order is already saved. */}} return result; } finally { submitting.current = false; }
  }, {} as PublicProductOrderState);
  const [items,setItems]=useState<BasketItem[]|null>(null);
  const [storageError,setStorageError]=useState("");
  useEffect(()=>{const update=()=>setItems(readBasket(slug));update();window.addEventListener("storage",update);return()=>window.removeEventListener("storage",update);},[slug]);
  const [contact, setContact] = useState({ customerName: "", phone: "", email: "", note: "" });
  const selected=(items??[]).map(item=>({item,product:products.find(product=>product.id===item.productId)}));
  const available=selected.filter(row=>row.product);
  const product=available[0]?.product;
  const unavailable=selected.some(row=>!row.product);
  const mixed=available.some(row=>row.product!.branchId!==product?.branchId);
  let total:bigint|null=0n;
  try{for(const row of available) total+=quantityAmountCentavos(row.item.quantity,BigInt(row.product!.priceCentavos));}catch{total=null;}
  function update(next:BasketItem[]){setItems(next);try{writeBasket(slug,next);setStorageError("");}catch{setStorageError("Your basket could not be saved on this device.");}}
  const lines=available.map(({item,product})=>({productId:item.productId,quantity:item.quantity,expectedPrice:product!.priceCentavos,expectedCurrency:product!.currency,expectedUnit:product!.unit}));
  if (state.reference) return <div id="public-product-order-success" role="status" className="mx-auto max-w-2xl rounded-2xl border border-brand-border bg-white p-6 shadow-sm sm:p-10 [overflow-wrap:anywhere]"><CheckCircle2 aria-hidden="true" size={36} className="mb-4 text-emerald-700"/><h2 className="text-2xl font-medium">Thank you. Your order is submitted.</h2><p className="mt-2 text-sm">The business has your order and will contact you to confirm availability, pickup, and payment. No payment has been collected.</p><p className="mt-3 text-sm">Reference: <strong>{state.reference}</strong></p></div>;
  if(items===null) return <p role="status" className="rounded-2xl border border-admin-border bg-white p-8 text-admin-text-secondary">Loading your basket…</p>;
  if(!items.length) return <div id="public-basket-empty" className="rounded-2xl border border-admin-border bg-white px-6 py-14 text-center"><ShoppingBasket size={40} aria-hidden="true" className="mx-auto mb-4 text-brand-primary"/><h2 className="text-xl font-medium">Your basket is empty</h2><p className="mt-2 text-sm text-admin-text-secondary">Discover something you’ll love and add it here.</p><Link className="mt-3 inline-flex min-h-11 items-center underline" href={`/shop/${encodeURIComponent(slug)}#public-shop-products`}>Browse products</Link></div>;
  return <form id="public-product-order-form" action={action} aria-busy={pending} onSubmit={event => {
    if (submitting.current || pending) { event.preventDefault(); return; }
    submitting.current = true;
  }}>
    {state.error ? <p id="public-product-order-error" role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-status-danger mb-4">{state.error}</p> : null}
    <fieldset disabled={pending} className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
    <input type="hidden" name="slug" value={slug}/><input type="hidden" name="requestKey" value={requestKey}/><input type="hidden" name="lines" value={JSON.stringify(lines)}/>
    <div aria-hidden="true" className="hidden"><label>Website<input name="website" tabIndex={-1} autoComplete="off"/></label></div>
    <section aria-label="Basket items" className="min-w-0 rounded-2xl border border-admin-border bg-white p-4 shadow-sm sm:p-6 lg:col-start-1"><div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Your products</h2><span className="rounded-full bg-brand-tint px-3 py-1 text-xs font-medium text-brand-primary-strong">{items.length} {items.length===1?"product":"products"}</span></div><div className="divide-y divide-admin-border">
      {selected.map(({item,product})=><div id={`basket-item-${item.productId}`} key={item.productId} className="grid min-w-0 grid-cols-[5rem_minmax(0,1fr)] gap-4 py-5 first:pt-0 sm:grid-cols-[7rem_minmax(0,1fr)]">
        <div><ServiceThumbnail id={`basket-photo-${item.productId}`} url={product?.thumbnailUrl} name={product?.name??"Product"} subject="product"/></div><div className="min-w-0 [overflow-wrap:anywhere]">
        <h3 className="font-medium">{product?.name??"Unavailable product"}</h3>
        {product?<p className="mt-1 text-sm text-admin-text-secondary">{formatMoney(product.priceCentavos,product.currency)} / {product.unit} · {product?.branchName}</p>:<p className="text-sm text-red-700">This product is no longer available. Remove it to continue.</p>}
        <div className="mt-2 flex flex-wrap items-end gap-3"><label className="text-xs text-admin-text-secondary">Quantity {product?`(${product.unit})`:""}<Input id={`basket-quantity-${item.productId}`} className="mt-1 w-28 bg-admin-canvas" type="number" min="0.001" max="1000" step="0.001" required value={item.quantity} onChange={e=>update(items.map(row=>row.productId===item.productId?{...row,quantity:e.target.value}:row))}/></label><Button id={`basket-remove-${item.productId}`} variant="ghost" size="sm" onClick={()=>update(items.filter(row=>row.productId!==item.productId))}><Trash2 size={15} aria-hidden="true"/>Remove<span className="sr-only"> {product?.name??"product"}</span></Button></div>
      </div></div>)}
      </div><Link id="basket-continue-shopping" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-brand-primary-strong hover:underline" href={`/shop/${encodeURIComponent(slug)}#public-shop-products`}><ArrowLeft size={16} aria-hidden="true"/>Continue shopping</Link>
    </section>
    <section id="basket-contact-section" className="grid min-w-0 gap-4 rounded-2xl border border-admin-border bg-white p-4 shadow-sm sm:grid-cols-2 sm:p-6 lg:col-start-1">
    <div className="sm:col-span-2"><h2 className="flex items-center gap-2 text-lg font-semibold"><UserRound size={19} aria-hidden="true"/>Contact details</h2><p className="mt-1 text-sm text-admin-text-secondary">We’ll contact you to confirm your order and pickup.</p></div>
    <label className="min-w-0 text-sm">Full name<Input id="public-product-order-name" name="customerName" value={contact.customerName} onChange={e => setContact({ ...contact, customerName: e.target.value })} required minLength={2} maxLength={120} autoComplete="name"/></label>
    <label className="min-w-0 text-sm">Phone number<Input id="public-product-order-phone" name="phone" value={contact.phone} onChange={e => setContact({ ...contact, phone: e.target.value })} type="tel" required minLength={7} maxLength={30} autoComplete="tel"/></label>
    <label className="min-w-0 text-sm sm:col-span-2">Email (optional)<Input id="public-product-order-email" name="email" value={contact.email} onChange={e => setContact({ ...contact, email: e.target.value })} type="email" maxLength={254} autoComplete="email"/></label>
    <label className="min-w-0 text-sm sm:col-span-2">Notes (optional)<textarea id="public-product-order-note" name="note" value={contact.note} onChange={e => setContact({ ...contact, note: e.target.value })} maxLength={1000} className="mt-1 min-h-20 w-full rounded-xl border border-admin-border p-3"/></label>
    </section>
    <aside id="basket-order-summary" aria-labelledby="basket-summary-title" className="min-w-0 rounded-2xl border border-brand-border bg-white p-5 shadow-sm sm:p-6 lg:col-start-2 lg:row-start-1 lg:row-span-3">
      <h2 id="basket-summary-title" className="text-lg font-semibold">Order summary</h2>
      <p className="mt-4 flex justify-between gap-3 text-sm text-admin-text-secondary"><span>Products</span><span>{items.length}</span></p>
      <p id="public-product-order-total" className="mt-4 flex flex-wrap justify-between gap-2 border-t border-admin-border pt-4 text-xl font-semibold"><span>Total</span><span>{total===null||!product?"—":formatMoney(total,product.currency)}</span></p>
      <div className="mt-5 rounded-xl bg-brand-tint/50 p-3"><p className="flex items-center gap-2 text-sm font-medium"><MapPin size={16} aria-hidden="true"/>Pickup location</p><p className="mt-1 text-sm [overflow-wrap:anywhere]">{product?.branchName??"Select available products"}</p></div>
      {storageError?<p role="alert" className="mt-3 text-sm text-status-danger">{storageError}</p>:null}
      {mixed?<p role="alert" className="mt-3 text-sm text-status-danger">Choose products from one pickup branch per order.</p>:null}
      <SubmitButton className="mt-5 w-full" disabled={unavailable||mixed||total===null||!product} id="public-product-order-submit" pendingText="Submitting…">Submit order<ArrowRight size={16} aria-hidden="true"/></SubmitButton>
      <p className="mt-3 text-xs leading-5 text-admin-text-secondary">No payment is taken now. Staff will confirm availability and arrange payment. Products are not reserved until your order is confirmed.</p>
    </aside>
    </fieldset>
  </form>;
}
