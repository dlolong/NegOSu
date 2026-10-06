"use client";
import { SettingsFormSection } from "@/components/settings-form-section";

import { useActionState, useState } from "react";
import { savePromo } from "@/app/dashboard/promos/actions";
import { saveProduct } from "@/app/dashboard/products/actions";
import { CatalogPhotoField } from "@/components/catalog-photo-field";
import { ImageUploadField } from "@/components/image-upload-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { FormActions } from "@/components/form-actions";
import type { PromoComponent } from "@/modules/core/commerce/promos";

export type CatalogProduct = { thumbnail_url?: string | null; is_public?: boolean; id: string; name: string; sku: string | null; description: string | null; category: string | null; unit: string; sell_price_centavos: number | null; product_purpose: string; stock_tracked: boolean; is_active: boolean };
export type CatalogPromo = { image_url?: string | null; is_public?: boolean; id: string; name: string; description: string; price_centavos: number; status: string; version: number; valid_from: string | null; valid_through: string | null; components: PromoComponent[] };
const selectClass = "block min-h-11 w-full min-w-0 rounded-xl border border-admin-border bg-white px-3 text-sm";

export function ProductCatalogForm({ product, currency, requestKey }: { product?: CatalogProduct; currency: string; requestKey: string }) {
  const [state, action] = useActionState(saveProduct, {});
  const [draft, setDraft] = useState({ name: product?.name ?? "", sku: product?.sku ?? "", category: product?.category ?? "", description: product?.description ?? "", unit: product?.unit ?? "piece", price: ((product?.sell_price_centavos ?? 0) / 100).toFixed(2), purpose: product?.product_purpose ?? "both", tracked: product?.stock_tracked ?? true, active: product?.is_active ?? true, isPublic: product?.is_public ?? false });
  const field = (name: "name" | "sku" | "category" | "description" | "unit" | "price" | "purpose") => ({ value: draft[name], onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setDraft(current => ({ ...current, [name]: event.target.value })) });
  return <form id="product-catalog-form" action={action} className="grid min-w-0 gap-5 sm:grid-cols-2">
    <input type="hidden" name="requestKey" value={requestKey}/><input type="hidden" name="id" value={product?.id ?? ""}/>
    {state.error ? <p role="alert" className="col-span-full text-sm text-red-700">{state.error}</p> : null}
    <SettingsFormSection id="product-details-section" title="Product details">
    <label>Name<Input id="product-name" name="name" required maxLength={120} {...field("name")}/></label>
    <div><label htmlFor="product-sku">Product code (optional)</label><Input id="product-sku" name="sku" aria-describedby="product-code-help" maxLength={60} {...field("sku")}/><p id="product-code-help" className="mt-1 text-xs font-normal leading-5 text-admin-text-secondary">Optional reference, e.g. PROD-001.</p></div>
    <label>Category<Input id="product-category" name="category" required maxLength={80} {...field("category")}/></label>
    <label className="col-span-full">Description (optional)<Input id="product-description" name="description" maxLength={1000} {...field("description")}/></label>
    </SettingsFormSection>
    <SettingsFormSection id="product-pricing-section" title="Pricing & use">
    <label>Price per item or measure ({currency})<Input id="product-price" name="price" required inputMode="decimal" {...field("price")}/></label>
    <label>How do you count this product?<Input id="product-unit" name="unit" aria-describedby="product-unit-help" list="product-unit-options" required maxLength={30} {...field("unit")}/><datalist id="product-unit-options"><option value="piece"/><option value="bottle"/><option value="pack"/><option value="ml"/><option value="liter"/><option value="gram"/><option value="kg"/></datalist><small id="product-unit-help" className="mt-1 block text-xs font-normal text-admin-text-secondary">Use piece for individual items, or ml / liter for measured liquids. Price and stock use this unit.</small></label>
    <label>Purpose<select id="product-purpose" name="purpose" className={`${selectClass} mt-2`} {...field("purpose")}><option value="both">Retail and internal use</option><option value="retail">Retail / take-home</option><option value="internal">Internal supplies</option></select></label>
    </SettingsFormSection>
    <SettingsFormSection id="product-photo-section" title="Product photo">
    <CatalogPhotoField idPrefix="product-photo" initialUrl={product?.thumbnail_url} name={draft.name || "Product"} subject="product"/>
    </SettingsFormSection>
    <SettingsFormSection id="product-visibility-section" title="Stock & visibility">
    <label className="flex min-h-11 items-center gap-2"><input id="product-stock-tracked" name="tracked" type="checkbox" checked={draft.tracked} onChange={event => setDraft(current => ({ ...current, tracked: event.target.checked }))}/>Track physical stock</label>
    <label className="flex min-h-11 items-center gap-2"><input id="product-active" name="active" type="checkbox" checked={draft.active} onChange={event => setDraft(current => ({ ...current, active: event.target.checked }))}/>Active</label>
    <div className="col-span-full"><label className="flex min-h-11 items-center gap-2"><input id="product-public" name="isPublic" type="checkbox" checked={draft.isPublic && draft.purpose !== "internal"} disabled={draft.purpose === "internal"} onChange={event => setDraft(current => ({ ...current, isPublic: event.target.checked }))} aria-describedby="product-public-help"/>Show on public website</label><p id="product-public-help" className="text-xs font-normal leading-5 text-admin-text-secondary">Only active retail products appear publicly. Internal supplies stay private.</p></div>
    <p className="col-span-full text-xs font-normal leading-5 text-admin-text-secondary">Manage stock quantities in Inventory.</p>
    </SettingsFormSection>
    <FormActions id="product-catalog-actions" cancelHref="/dashboard/products"><SubmitButton id="product-save" pendingText="Saving…">Save product</SubmitButton></FormActions>
  </form>;
}

export function PromoCatalogForm({ promo, products, services, hospitality, currency, requestKey }: { promo?: CatalogPromo; products: CatalogProduct[]; services: { id: string; name: string }[]; hospitality: boolean; currency: string; requestKey: string }) {
  const [state, action] = useActionState(savePromo, {});
  const [draft, setDraft] = useState({ name: promo?.name ?? "", price: ((promo?.price_centavos ?? 0) / 100).toFixed(2), description: promo?.description ?? "", validFrom: promo?.valid_from ?? "", validThrough: promo?.valid_through ?? "", status: promo?.status ?? "draft" });
  const field = (name: keyof typeof draft) => ({ value: draft[name], onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setDraft(current => ({ ...current, [name]: event.target.value })) });
  const [components, setComponents] = useState<PromoComponent[]>(promo?.components ?? [{ kind: hospitality ? "accommodation" : "service", referenceId: null, quantity: "1", unit: "service" }]);
  function change(index: number, patch: Partial<PromoComponent>) { setComponents(rows => rows.map((row, i) => i === index ? { ...row, ...patch } : row)); }
  return <form id="promo-catalog-form" action={action} className="grid min-w-0 gap-5 sm:grid-cols-2">
    <input type="hidden" name="requestKey" value={requestKey}/><input type="hidden" name="id" value={promo?.id ?? ""}/><input type="hidden" name="version" value={promo?.version ?? 0}/><input type="hidden" name="components" value={JSON.stringify(components)}/>
    {state.error ? <p role="alert" className="col-span-full text-sm text-red-700">{state.error}</p> : null}
    <SettingsFormSection id="promo-details-section" title="Offer details">
    <label>Promo name<Input id="promo-name" name="name" required maxLength={120} {...field("name")}/></label>
    <label>Fixed price ({currency})<Input id="promo-price" name="price" inputMode="decimal" required {...field("price")}/></label>
    <label className="col-span-full">Description<Input id="promo-description" name="description" maxLength={1000} {...field("description")}/></label>
    </SettingsFormSection>
    <SettingsFormSection id="promo-presentation-section" title="Photo">
    <div className="col-span-full"><ImageUploadField id="promo-image-url" name="imageUrl" label="Promo image (optional)" value={promo?.image_url}/><p className="mt-2 text-sm text-admin-text-secondary">Image URLs work on any plan; uploads require an eligible plan.</p></div>
    {!hospitality?<p className="col-span-full text-xs font-normal leading-5 text-admin-text-secondary">Manage public visibility in Website and booking → Promos.</p>:null}
    </SettingsFormSection>
    <SettingsFormSection id="promo-availability-section" title="Dates & status">
    <label>Valid from (optional)<Input id="promo-valid-from" type="date" name="validFrom" {...field("validFrom")}/></label>
    <label>Valid through (optional)<Input id="promo-valid-through" type="date" name="validThrough" {...field("validThrough")}/></label>
    <label>Status<select id="promo-status" name="status" className={`${selectClass} mt-2`} {...field("status")}><option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option></select></label>
    <p className="self-center text-xs font-normal leading-5 text-admin-text-secondary">This branch only. {hospitality ? "Eligibility uses the check-in date." : "Eligibility uses the scheduled service date."} Products do not add service time.</p>
    </SettingsFormSection>
    <fieldset className="col-span-full grid min-w-0 gap-3 rounded-ui-lg border border-admin-border bg-white p-4 sm:p-5"><legend className="px-1 text-sm font-semibold">Included items</legend><p id="promo-components-help" className="text-sm text-admin-text-secondary">{hospitality ? "Combine accommodation, products or supplies as needed. Each item can appear only once." : "Combine services, products or supplies as needed. Each item can appear only once; increase its quantity instead of adding it again. Service quantities remain one."}</p>{components.map((component, index) => <div key={index} className="grid min-w-0 gap-2 rounded-xl border border-admin-border p-3 sm:grid-cols-2">
      <label>Type<select id={`promo-component-${index}-kind`} aria-label={`Component ${index + 1} type`} className={`${selectClass} mt-2`} value={component.kind} onChange={event => change(index, { kind: event.target.value as PromoComponent["kind"], referenceId: null, quantity: "1", unit: ["service", "accommodation"].includes(event.target.value) ? "service" : "piece" })}>{hospitality ? <option value="accommodation">Agreed accommodation</option> : <option value="service">Service</option>}<option value="product">Take-home product</option><option value="supply">Internal supply</option></select></label>
      {component.kind === "accommodation" ? <p className="self-center text-sm">Covers the agreed stay charge; never a stocked room.</p> : <label>Component<select id={`promo-component-${index}-reference`} required className={`${selectClass} mt-2`} value={component.referenceId ?? ""} onChange={event => change(index, { referenceId: event.target.value || null, unit: component.kind === "service" ? "service" : products.find(p => p.id === event.target.value)?.unit ?? "piece" })}><option value="">Select…</option>{component.referenceId && !(component.kind === "service" ? services : products).some(row => row.id === component.referenceId) ? <option value={component.referenceId}>Unavailable component (kept for history)</option> : null}{(component.kind === "service" ? services : products.filter(p => p.is_active && (component.kind === "product" ? p.product_purpose !== "internal" : p.product_purpose !== "retail"))).filter(row => !components.some((other, otherIndex) => otherIndex !== index && other.referenceId === row.id && (component.kind === "service" ? other.kind === "service" : ["product", "supply"].includes(other.kind)))).map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>}
      <label>Quantity ({component.unit})<Input id={`promo-component-${index}-quantity`} inputMode="decimal" required readOnly={["service", "accommodation"].includes(component.kind)} value={component.quantity} onChange={event => change(index, { quantity: event.target.value })}/></label>
      <Button id={`promo-component-${index}-remove`} type="button" variant="secondary" onClick={() => setComponents(rows => rows.filter((_, i) => i !== index))}>Remove component {index + 1}</Button>
    </div>)}<Button id="promo-component-add" type="button" variant="secondary" disabled={components.length >= 30} onClick={() => setComponents(rows => [...rows, { kind: "product", referenceId: null, unit: "piece", quantity: "1" }])}>Add component</Button></fieldset>
    <FormActions id="promo-catalog-actions" cancelHref="/dashboard/promos"><SubmitButton id="promo-save" pendingText="Saving…">Save promo</SubmitButton></FormActions>
  </form>;
}
