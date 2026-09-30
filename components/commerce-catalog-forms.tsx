"use client";

import { useActionState, useState } from "react";
import { savePromo } from "@/app/dashboard/promos/actions";
import { saveProduct } from "@/app/dashboard/products/actions";
import { ImageUploadField } from "@/components/image-upload-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { FormActions } from "@/components/form-actions";
import type { PromoComponent } from "@/modules/core/commerce/promos";

export type CatalogProduct = { id: string; name: string; sku: string | null; description: string | null; category: string | null; unit: string; sell_price_centavos: number | null; product_purpose: string; stock_tracked: boolean; is_active: boolean };
export type CatalogPromo = { image_url?: string | null; is_public?: boolean; id: string; name: string; description: string; price_centavos: number; status: string; version: number; valid_from: string | null; valid_through: string | null; components: PromoComponent[] };
const selectClass = "block min-h-11 w-full min-w-0 rounded-xl border border-admin-border bg-white px-3 text-sm";

export function ProductCatalogForm({ product, currency, requestKey }: { product?: CatalogProduct; currency: string; requestKey: string }) {
  const [state, action] = useActionState(saveProduct, {});
  const [draft, setDraft] = useState({ name: product?.name ?? "", sku: product?.sku ?? "", category: product?.category ?? "", description: product?.description ?? "", unit: product?.unit ?? "piece", price: ((product?.sell_price_centavos ?? 0) / 100).toFixed(2), purpose: product?.product_purpose ?? "both", tracked: product?.stock_tracked ?? true, active: product?.is_active ?? true });
  const field = (name: "name" | "sku" | "category" | "description" | "unit" | "price" | "purpose") => ({ value: draft[name], onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setDraft(current => ({ ...current, [name]: event.target.value })) });
  return <form id="product-catalog-form" action={action} className="grid gap-4 sm:grid-cols-2">
    <input type="hidden" name="requestKey" value={requestKey}/><input type="hidden" name="id" value={product?.id ?? ""}/>
    {state.error ? <p role="alert" className="col-span-full text-sm text-red-700">{state.error}</p> : null}
    <label>Name<Input id="product-name" name="name" required maxLength={120} {...field("name")}/></label>
    <div><label htmlFor="product-sku">Product code (optional)</label><Input id="product-sku" name="sku" aria-describedby="product-code-help" maxLength={60} {...field("sku")}/><p id="product-code-help" className="mt-1 text-sm text-admin-text-secondary">Your own code to identify this product, such as PROD-001. Leave blank if you don’t use product codes.</p></div>
    <label>Category (optional)<Input id="product-category" name="category" maxLength={80} {...field("category")}/></label>
    <label>Price per item or measure ({currency})<Input id="product-price" name="price" required inputMode="decimal" {...field("price")}/></label>
    <label>How do you count this product?<Input id="product-unit" name="unit" aria-describedby="product-unit-help" list="product-unit-options" required maxLength={30} {...field("unit")}/><datalist id="product-unit-options"><option value="piece"/><option value="bottle"/><option value="pack"/><option value="ml"/><option value="liter"/><option value="gram"/><option value="kg"/></datalist><small id="product-unit-help" className="text-xs">Use piece for individual items, bottle for whole bottles, or ml / liter for liquids measured out. Stock quantities and the price above use this same measure.</small></label>
    <label>Purpose<select id="product-purpose" name="purpose" className={selectClass} {...field("purpose")}><option value="both">Retail and internal use</option><option value="retail">Retail / take-home</option><option value="internal">Internal supplies</option></select></label>
    <label className="col-span-full">Description (optional)<Input id="product-description" name="description" maxLength={1000} {...field("description")}/></label>
    <label className="flex items-center gap-2"><input id="product-stock-tracked" name="tracked" type="checkbox" checked={draft.tracked} onChange={event => setDraft(current => ({ ...current, tracked: event.target.checked }))}/>Track physical stock</label>
    <label className="flex items-center gap-2"><input id="product-active" name="active" type="checkbox" checked={draft.active} onChange={event => setDraft(current => ({ ...current, active: event.target.checked }))}/>Active</label>
    <p className="col-span-full text-sm text-admin-text-secondary">Stock balances are managed in Inventory. Saving this form never changes physical stock.</p>
    <FormActions id="product-catalog-actions" cancelHref="/dashboard/products"><SubmitButton id="product-save" pendingText="Saving…">Save product</SubmitButton></FormActions>
  </form>;
}

export function PromoCatalogForm({ promo, products, services, hospitality, currency, requestKey }: { promo?: CatalogPromo; products: CatalogProduct[]; services: { id: string; name: string }[]; hospitality: boolean; currency: string; requestKey: string }) {
  const [state, action] = useActionState(savePromo, {});
  const [isPublic,setIsPublic] = useState(promo?.is_public ?? false);
  const [draft, setDraft] = useState({ name: promo?.name ?? "", price: ((promo?.price_centavos ?? 0) / 100).toFixed(2), description: promo?.description ?? "", validFrom: promo?.valid_from ?? "", validThrough: promo?.valid_through ?? "", status: promo?.status ?? "draft" });
  const field = (name: keyof typeof draft) => ({ value: draft[name], onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setDraft(current => ({ ...current, [name]: event.target.value })) });
  const [components, setComponents] = useState<PromoComponent[]>(promo?.components ?? [{ kind: hospitality ? "accommodation" : "service", referenceId: null, quantity: "1", unit: "service" }, { kind: "product", referenceId: null, quantity: "1", unit: "piece" }]);
  function change(index: number, patch: Partial<PromoComponent>) { setComponents(rows => rows.map((row, i) => i === index ? { ...row, ...patch } : row)); }
  return <form id="promo-catalog-form" action={action} className="grid gap-4 sm:grid-cols-2">
    <input type="hidden" name="requestKey" value={requestKey}/><input type="hidden" name="id" value={promo?.id ?? ""}/><input type="hidden" name="version" value={promo?.version ?? 0}/><input type="hidden" name="components" value={JSON.stringify(components)}/>
    {state.error ? <p role="alert" className="col-span-full text-sm text-red-700">{state.error}</p> : null}
    <label>Promo name<Input id="promo-name" name="name" required maxLength={120} {...field("name")}/></label>
    <label>Fixed price ({currency})<Input id="promo-price" name="price" inputMode="decimal" required {...field("price")}/></label>
    <label className="col-span-full">Description<Input id="promo-description" name="description" maxLength={1000} {...field("description")}/></label>
    <div className="col-span-full"><ImageUploadField id="promo-image-url" name="imageUrl" label="Promo image (optional)" value={promo?.image_url}/><p className="mt-2 text-sm text-admin-text-secondary">Paste an image URL on any plan, or upload a photo if your plan includes uploads.</p></div>
    {!hospitality?<label className="col-span-full flex min-h-11 items-center gap-2"><input id="promo-public" name="isPublic" type="checkbox" checked={isPublic} onChange={event=>setIsPublic(event.target.checked)}/>Show on public website</label>:null}
    {!hospitality?<p className="col-span-full text-sm text-admin-text-secondary">Public promos need Active status, a published service, and a branch accepting online bookings. Internal supplies stay private.</p>:null}
    <label>Valid from (optional)<Input id="promo-valid-from" type="date" name="validFrom" {...field("validFrom")}/></label>
    <label>Valid through (optional)<Input id="promo-valid-through" type="date" name="validThrough" {...field("validThrough")}/></label>
    <label>Status<select id="promo-status" name="status" className={selectClass} {...field("status")}><option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option></select></label>
    <p className="text-sm text-admin-text-secondary">This branch only. {hospitality ? "Eligibility uses the check-in date." : "Eligibility uses the scheduled service date."} Products do not add service time.</p>
    <fieldset className="col-span-full grid min-w-0 gap-3"><legend className="mb-2">Included components</legend><p id="promo-components-help" className="text-sm text-admin-text-secondary">{hospitality ? "Choose one accommodation and its included products or supplies." : "Choose services, products, or supplies for each component. You can bundle multiple services; their durations are added together and the fixed promo price is charged once."}</p>{components.map((component, index) => <div key={index} className="grid min-w-0 gap-2 rounded-xl border border-admin-border p-3 sm:grid-cols-2">
      <label>Type<select id={`promo-component-${index}-kind`} aria-label={`Component ${index + 1} type`} className={selectClass} value={component.kind} onChange={event => change(index, { kind: event.target.value as PromoComponent["kind"], referenceId: null, quantity: "1", unit: ["service", "accommodation"].includes(event.target.value) ? "service" : "piece" })}>{hospitality ? <option value="accommodation">Agreed accommodation</option> : <option value="service">Service</option>}<option value="product">Take-home product</option><option value="supply">Internal supply</option></select></label>
      {component.kind === "accommodation" ? <p className="self-center text-sm">Covers the agreed stay charge; never a stocked room.</p> : <label>Component<select id={`promo-component-${index}-reference`} required className={selectClass} value={component.referenceId ?? ""} onChange={event => change(index, { referenceId: event.target.value || null, unit: component.kind === "service" ? "service" : products.find(p => p.id === event.target.value)?.unit ?? "piece" })}><option value="">Select…</option>{component.referenceId && !(component.kind === "service" ? services : products).some(row => row.id === component.referenceId) ? <option value={component.referenceId}>Unavailable component (kept for history)</option> : null}{(component.kind === "service" ? services : products.filter(p => p.is_active)).map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>}
      <label>Quantity ({component.unit})<Input id={`promo-component-${index}-quantity`} inputMode="decimal" required readOnly={["service", "accommodation"].includes(component.kind)} value={component.quantity} onChange={event => change(index, { quantity: event.target.value })}/></label>
      <Button id={`promo-component-${index}-remove`} type="button" variant="secondary" onClick={() => setComponents(rows => rows.filter((_, i) => i !== index))}>Remove component {index + 1}</Button>
    </div>)}<Button id="promo-component-add" type="button" variant="secondary" disabled={components.length >= 30} onClick={() => setComponents(rows => [...rows, { kind: "product", referenceId: null, unit: "piece", quantity: "1" }])}>Add component</Button></fieldset>
    <FormActions id="promo-catalog-actions" cancelHref="/dashboard/promos"><SubmitButton id="promo-save" pendingText="Saving…">Save promo</SubmitButton></FormActions>
  </form>;
}
