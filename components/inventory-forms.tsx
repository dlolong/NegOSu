"use client";

import { useActionState, useState, type ReactNode } from "react";
import { ArrowRightLeft, Plus, Save } from "lucide-react";
import { createInventoryItem, recordMovement, saveRecipe, transferStock } from "@/app/dashboard/inventory/actions";
import { SuggestedValueField } from "@/components/suggested-value-field";
import { SearchableSelect } from "@/components/searchable-select";
import { FormActions } from "@/components/form-actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { quantityLabel } from "@/lib/inventory";
import { matchingTransferTargets, type InventoryActionState, type InventoryStock } from "@/lib/inventory-workspace";

const select = "mt-2 min-h-11 w-full min-w-0 max-w-full rounded-xl border border-admin-border bg-white px-3 text-sm";
function InventoryField({ label, optional = false, children }: { label: string; optional?: boolean; children: ReactNode }) {
  return <label className="block min-w-0 text-sm font-semibold text-admin-text">{label}{optional ? <span className="font-normal text-admin-text-muted"> (optional)</span> : null}{children}</label>;
}
export function InventoryForm({ mode, salon, stock, item, branches, services, returnHref, idempotencyKey }: {
  mode: "create" | "movement" | "transfer" | "recipe"; salon: boolean; stock: InventoryStock[]; item?: InventoryStock;
  branches: { id: string; name: string }[]; services: { id: string; name: string }[]; returnHref: string; idempotencyKey: string;
}) {
  const productPrefix=salon?"salon-product":"inventory-item",inventoryPrefix=salon?"salon-inventory":"inventory";
  const actions = { create: createInventoryItem, movement: recordMovement, transfer: transferStock, recipe: saveRecipe };
  const [state, action] = useActionState((_previous: InventoryActionState, data: FormData) => actions[mode](data), {});
  const [draft, setDraft] = useState<Record<string, string>>({ unit: "unit", cost: "0", sellPrice: "0", reorderLevel: "0", type: "purchase", sourceItemId: "" });
  const field = (name: string) => ({ name, value: draft[name] ?? "", onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setDraft(current => ({ ...current, [name]: event.target.value, ...(name === "sourceItemId" ? { targetItemId: "" } : {}) })) });
  const choiceField = (name: string) => ({ name, value: draft[name] ?? "", onValueChange: (value: string) => setDraft(current => ({ ...current, [name]: value, ...(name === "sourceItemId" ? { targetItemId: "" } : {}) })) });
  const source = stock.find(row => row.id === draft.sourceItemId);
  const targets = matchingTransferTargets(source, stock);
  const id = mode === "create" ? `${productPrefix}-create-form` : mode === "transfer" ? `${inventoryPrefix}-transfer-form` : mode === "recipe" ? "inventory-recipe-form" : `${productPrefix}-movement-form`;
  return <form id={id} action={action} className="grid min-w-0 gap-4">
    <input type="hidden" name="returnTo" value={returnHref}/><input type="hidden" name="idempotencyKey" value={idempotencyKey}/>
    <FormMessage error={state.error}/>
    {mode === "create" ? <>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <InventoryField label="Product name"><Input id={`${productPrefix}-name-input`} required minLength={2} maxLength={120} {...field("name")} className="mt-2" placeholder="e.g. Cleaning solution"/></InventoryField>
        <InventoryField label="SKU" optional><Input id={`${productPrefix}-sku-input`} maxLength={60} {...field("sku")} className="mt-2" placeholder="Your product code"/></InventoryField>
        <div><label htmlFor={`${productPrefix}-category-input`} className="text-sm font-semibold">Category (optional)</label><SuggestedValueField id={`${productPrefix}-category-input`} name="category" label="Category" maxLength={80} options={stock.map(row=>row.category).filter((value):value is string=>Boolean(value))} value={draft.category??""} onValueChange={category=>setDraft(current=>({...current,category}))}/></div>
        <InventoryField label="Unit"><Input id={`${productPrefix}-unit-input`} required maxLength={30} {...field("unit")} className="mt-2" placeholder="e.g. bottle, piece, liter"/></InventoryField>
        <InventoryField label="Cost (PHP)"><Input id={`${productPrefix}-cost-input`} required inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" {...field("cost")} className="mt-2"/></InventoryField>
        <InventoryField label="Sell price (PHP)"><Input id={`${productPrefix}-price-input`} required inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" {...field("sellPrice")} className="mt-2"/></InventoryField>
        <InventoryField label="Reorder level"><Input id={`${productPrefix}-reorder-input`} required type="number" min="0" step="0.001" {...field("reorderLevel")} className="mt-2"/><span className="mt-1 block text-xs font-normal text-admin-text-muted">Show a low-stock alert at this quantity or below.</span></InventoryField>
      </div>
      <details className="min-w-0 rounded-xl border border-admin-border p-4"><summary className="cursor-pointer text-sm font-semibold">Additional details (optional)</summary><div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
        <InventoryField label="Lot / batch" optional><Input id={`${productPrefix}-lot-input`} maxLength={80} {...field("lotNumber")} className="mt-2"/></InventoryField>
        <InventoryField label="Expiry date" optional><Input id={`${productPrefix}-expiry-input`} type="date" {...field("expiresOn")} className="mt-2"/></InventoryField>
        <div className="sm:col-span-2"><InventoryField label="Description" optional><Input id={`${productPrefix}-description-input`} maxLength={1000} {...field("description")} className="mt-2"/></InventoryField></div>
      </div></details>
      <p className="text-sm text-admin-text-muted">New products start with zero stock. Use Record movement to enter your opening quantity or a purchase.</p>
    </> : mode === "movement" ? <>
      <input type="hidden" name="itemId" value={item?.id ?? ""}/>
      <div className="min-w-0 rounded-xl border border-admin-border bg-admin-surface p-4 [overflow-wrap:anywhere]"><strong>{item?.name}</strong><p className="mt-1 text-sm text-admin-text-muted">On hand: {quantityLabel(item?.quantity_on_hand ?? 0, item?.unit ?? "")}</p></div>
      <InventoryField label="Movement type"><select id={`${productPrefix}-movement-type`} className={select} {...field("type")}><option value="purchase">Purchase · add stock</option><option value="opening">Opening balance · add stock</option><option value="return">Return · add stock</option><option value="usage">Usage · remove stock</option><option value="waste">Waste / damage · remove stock</option><option value="adjustment">Positive adjustment · add stock</option></select></InventoryField>
      <p className="text-sm text-admin-text-muted">{["usage", "waste"].includes(draft.type) ? "This quantity will be deducted. Stock already reserved cannot be removed." : "This quantity will be added to your current stock. Enter the amount to add, not the final balance."}</p>
      <InventoryField label="Quantity"><Input id={`${productPrefix}-movement-quantity`} required type="number" min="0.001" step="0.001" {...field("quantity")} className="mt-2"/></InventoryField>
      <InventoryField label="Reference / note" optional><Input id={`${productPrefix}-movement-note`} maxLength={500} {...field("note")} className="mt-2"/></InventoryField>
    </> : mode === "transfer" ? <>
      <InventoryField label="Source stock"><SearchableSelect id={`${inventoryPrefix}-transfer-source`} required {...choiceField("sourceItemId")} options={stock.map(row=>({id:row.id,name:`${row.name} · ${branches.find(branch=>branch.id===row.branch_id)?.name??"Branch"} · ${quantityLabel(row.quantity_on_hand,row.unit)}`}))} placeholder="Search source product or branch"/></InventoryField>
      <InventoryField label="Destination stock"><SearchableSelect id={`${inventoryPrefix}-transfer-target`} required disabled={!source||!targets.length} {...choiceField("targetItemId")} options={targets.map(row=>({id:row.id,name:`${row.name} · ${branches.find(branch=>branch.id===row.branch_id)?.name??"Branch"} · ${row.unit}`}))} placeholder="Search destination product or branch"/></InventoryField>
      <p role="status" className="text-sm text-admin-text-muted">{source && !targets.length ? "No matching product in another accessible branch. Create the product there with the same SKU first." : "Choose the same product in another branch. Matching SKUs are shown; check the product and unit before transferring."}</p>
      <InventoryField label="Quantity"><Input id={`${inventoryPrefix}-transfer-quantity`} required type="number" min="0.001" step="0.001" {...field("quantity")} className="mt-2"/></InventoryField>
      <InventoryField label="Transfer note" optional><Input id={`${inventoryPrefix}-transfer-note`} maxLength={500} {...field("note")} className="mt-2"/></InventoryField>
    </> : <>
      <InventoryField label="Service"><SearchableSelect id="inventory-recipe-service-select" required {...choiceField("serviceId")} options={services} lookup="service" placeholder="Search service or category"/></InventoryField>
      <InventoryField label="Inventory item"><SearchableSelect id="inventory-recipe-item-select" required {...choiceField("inventoryItemId")} options={stock.map(row=>({id:row.id,name:`${row.name} · ${row.unit}`}))} placeholder="Search inventory item"/></InventoryField>
      <InventoryField label="Quantity used"><Input id="inventory-recipe-quantity-input" required type="number" min="0.001" step="0.001" {...field("quantity")} className="mt-2"/></InventoryField>
      <p className="text-sm text-admin-text-muted">Set how much of this item the service uses. Saving replaces the quantity for this service and product.</p>
    </>}
    <FormActions id={`${id}-actions`} cancelHref={returnHref}>
      <SubmitButton id={mode === "create" ? `${productPrefix}-save-button` : mode === "transfer" ? `${inventoryPrefix}-transfer-button` : mode === "recipe" ? "inventory-recipe-save-button" : `${productPrefix}-movement-save`} pendingText="Saving…" disabled={mode === "transfer" && !draft.targetItemId}>
        {mode === "create" ? <Plus aria-hidden="true" size={16}/> : mode === "transfer" ? <ArrowRightLeft aria-hidden="true" size={16}/> : <Save aria-hidden="true" size={16}/>}{mode === "create" ? "Create product" : mode === "transfer" ? "Transfer stock" : mode === "recipe" ? "Save recipe" : "Record movement"}
      </SubmitButton>
    </FormActions>
  </form>;
}
