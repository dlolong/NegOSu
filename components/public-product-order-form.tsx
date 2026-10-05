"use client";
import { useActionState, useState, useRef } from "react";
import { submitProductOrder } from "@/app/shop/[slug]/product-actions";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { formatMoney } from "@/lib/operations";
import { quantityAmountCentavos } from "@/modules/core/commerce/quantity";
import type { PublicProduct } from "@/lib/public-booking";
import type { PublicProductOrderState } from "@/modules/core/commerce/public-product-orders";
export function PublicProductOrderForm({ slug, product, requestKey }: { slug: string; product: PublicProduct; requestKey: string }) {
  const submitting = useRef(false);
  const [state, action, pending] = useActionState(async (previous: PublicProductOrderState, data: FormData) => {
    try { return await submitProductOrder(previous, data); } finally { submitting.current = false; }
  }, {} as PublicProductOrderState);
  const [quantity, setQuantity] = useState("1");
  const [contact, setContact] = useState({ customerName: "", phone: "", email: "", note: "" });
  let total: bigint | null = null;
  try { total = quantityAmountCentavos(quantity, BigInt(product.priceCentavos)); } catch { /* Invalid quantity is explained by form validation. */ }
  if (state.reference) return <div id="public-product-order-success" role="status" className="rounded-xl border border-brand-border bg-brand-tint p-5 [overflow-wrap:anywhere]"><h2 className="font-medium">Order submitted</h2><p className="mt-2 text-sm">The business has your order and will contact you to confirm availability, pickup, and payment. No payment has been collected.</p><p className="mt-3 text-sm">Reference: <strong>{state.reference}</strong></p></div>;
  return <form id="public-product-order-form" action={action} aria-busy={pending} onSubmit={event => {
    if (submitting.current || pending) { event.preventDefault(); return; }
    submitting.current = true;
  }}>
    <fieldset disabled={pending} className="grid min-w-0 gap-4 sm:grid-cols-2">
    <input type="hidden" name="slug" value={slug}/><input type="hidden" name="productId" value={product.id}/><input type="hidden" name="requestKey" value={requestKey}/><input type="hidden" name="expectedPrice" value={product.priceCentavos}/><input type="hidden" name="expectedCurrency" value={product.currency}/><input type="hidden" name="expectedUnit" value={product.unit}/>
    <div aria-hidden="true" className="hidden"><label>Website<input name="website" tabIndex={-1} autoComplete="off"/></label></div>
    {state.error ? <p id="public-product-order-error" role="alert" className="text-sm text-status-danger sm:col-span-2">{state.error}</p> : null}
    <label className="min-w-0 text-sm">Quantity ({product.unit})<Input id="public-product-order-quantity" name="quantity" type="number" min="0.001" max="1000" step="0.001" required value={quantity} onChange={e => setQuantity(e.target.value)}/></label>
    <p id="public-product-order-total" className="self-center font-medium">Total: {total === null ? "—" : formatMoney(total, product.currency)}</p>
    <label className="min-w-0 text-sm">Full name<Input id="public-product-order-name" name="customerName" value={contact.customerName} onChange={e => setContact({ ...contact, customerName: e.target.value })} required minLength={2} maxLength={120} autoComplete="name"/></label>
    <label className="min-w-0 text-sm">Phone number<Input id="public-product-order-phone" name="phone" value={contact.phone} onChange={e => setContact({ ...contact, phone: e.target.value })} type="tel" required minLength={7} maxLength={30} autoComplete="tel"/></label>
    <label className="min-w-0 text-sm sm:col-span-2">Email (optional)<Input id="public-product-order-email" name="email" value={contact.email} onChange={e => setContact({ ...contact, email: e.target.value })} type="email" maxLength={254} autoComplete="email"/></label>
    <label className="min-w-0 text-sm sm:col-span-2">Notes (optional)<textarea id="public-product-order-note" name="note" value={contact.note} onChange={e => setContact({ ...contact, note: e.target.value })} maxLength={1000} className="mt-1 min-h-20 w-full rounded-xl border border-admin-border p-3"/></label>
    <p className="text-sm text-admin-text-secondary sm:col-span-2">Order for pickup at {product.branchName}. Staff will confirm stock and arrange payment with you. Submitting does not reserve stock or charge you.</p>
    <div className="sm:col-span-2"><SubmitButton id="public-product-order-submit" pendingText="Submitting…">Submit order</SubmitButton></div>
    </fieldset>
  </form>;
}
