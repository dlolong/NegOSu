"use client";
import { movementDescriptions, movementPreview, type MovementDisplayType } from "@/lib/inventory-movement-display";
import { SettingsFormSection } from "@/components/settings-form-section";

import { useActionState, useState, type ReactNode } from "react";
import { ArrowRightLeft, Save } from "lucide-react";
import { recordMovement, saveRecipe, transferStock } from "@/app/dashboard/inventory/actions";
import { SearchableSelect } from "@/components/searchable-select";
import { FormActions } from "@/components/form-actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { quantityLabel } from "@/lib/inventory";
import { matchingTransferTargets, type InventoryActionState, type InventoryStock } from "@/lib/inventory-workspace";

const select = "mt-2 min-h-11 w-full min-w-0 max-w-full rounded-xl border border-admin-border bg-white px-3 text-sm";
function InventoryField({ label, optional = false, children }: { label: string; optional?: boolean; children: ReactNode }) {
  return <label className="block min-w-0 text-sm font-medium text-admin-text">{label}{optional ? <span className="font-normal text-admin-text-muted"> (optional)</span> : null}{children}</label>;
}
export function InventoryForm({ mode, salon, stock, item, branches, services, returnHref, idempotencyKey }: {
  mode: "movement" | "transfer" | "recipe"; salon: boolean; stock: InventoryStock[]; item?: InventoryStock;
  branches: { id: string; name: string }[]; services: { id: string; name: string }[]; returnHref: string; idempotencyKey: string; currency?: string;
}) {
  const productPrefix=salon?"salon-product":"inventory-item",inventoryPrefix=salon?"salon-inventory":"inventory";
  const actions = { movement: recordMovement, transfer: transferStock, recipe: saveRecipe };
  const [state, action, pending] = useActionState((_previous: InventoryActionState, data: FormData) => actions[mode](data), {});
  const [draft, setDraft] = useState<Record<string, string>>({ type: "purchase", sourceItemId: "" });
  const field = (name: string) => ({ name, disabled: pending, value: draft[name] ?? "", onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setDraft(current => ({ ...current, [name]: event.target.value, ...(name === "sourceItemId" ? { targetItemId: "" } : {}) })) });
  const choiceField = (name: string) => ({ name, disabled: pending, value: draft[name] ?? "", onValueChange: (value: string) => setDraft(current => ({ ...current, [name]: value, ...(name === "sourceItemId" ? { targetItemId: "" } : {}) })) });
  const source = stock.find(row => row.id === draft.sourceItemId);
  const targets = matchingTransferTargets(source, stock);
  const id = mode === "transfer" ? `${inventoryPrefix}-transfer-form` : mode === "recipe" ? "inventory-recipe-form" : `${productPrefix}-movement-form`;
  const movement = movementDescriptions[draft.type as MovementDisplayType] ?? movementDescriptions.purchase;
  const preview = movementPreview(item?.quantity_on_hand ?? 0, draft.quantity ?? "", draft.type);
  return <form id={id} action={action} aria-busy={pending} className="grid min-w-0 gap-4">
    <input type="hidden" name="returnTo" value={returnHref}/><input type="hidden" name="idempotencyKey" value={idempotencyKey}/>
    <FormMessage error={state.error}/>
    <SettingsFormSection id={`${id}-details`} title={mode === "transfer" ? "Transfer details" : mode === "recipe" ? "Service usage" : "Stock movement"}>
    {mode === "movement" ? <>
      <input type="hidden" name="itemId" value={item?.id ?? ""}/>
      <div id={`${productPrefix}-movement-product`} className="col-span-full min-w-0 rounded-xl bg-admin-surface-muted p-3 [overflow-wrap:anywhere]">
        <strong className="text-base">{item?.name ?? "Product unavailable"}</strong><p className="mt-1 text-xs text-admin-text-secondary">{branches.find(branch=>branch.id===item?.branch_id)?.name ?? "Selected branch"}{item?.sku ? ` · ${item.sku}` : ""}</p>
        <p className="mt-2 text-sm">Current stock: <strong>{quantityLabel(item?.quantity_on_hand ?? 0,item?.unit ?? "")}</strong></p>
      </div>
      <div className="col-span-full"><InventoryField label="1. Why is the stock changing?">
        <select id={`${productPrefix}-movement-type`} aria-describedby={`${productPrefix}-movement-help`} className={select} {...field("type")}>
          <optgroup label="Add stock">{(["purchase","return","opening","adjustment"] as const).map(type=><option key={type} value={type}>{movementDescriptions[type].label}</option>)}</optgroup>
          <optgroup label="Remove stock">{(["usage","waste"] as const).map(type=><option key={type} value={type}>{movementDescriptions[type].label}</option>)}</optgroup>
        </select>
      </InventoryField><p id={`${productPrefix}-movement-help`} className="mt-2 text-xs leading-5 text-admin-text-secondary">{movement.help}</p></div>
      <div className="col-span-full"><InventoryField label={`2. Quantity to ${movement.removes ? "remove" : "add"} (${item?.unit ?? "units"})`}>
        <Input id={`${productPrefix}-movement-quantity`} aria-describedby={`${productPrefix}-movement-quantity-help`} required type="number" inputMode="decimal" min="0.001" max="999999999" step="0.001" placeholder="e.g. 5" {...field("quantity")} className="mt-2"/>
      </InventoryField><p id={`${productPrefix}-movement-quantity-help`} className="mt-2 text-xs text-admin-text-secondary">Enter the amount {movement.removes ? "taken out" : "added"}, not the final stock balance. Always use a positive number.</p></div>
      <div id={`${productPrefix}-movement-preview`} role="status" aria-live="polite" className="col-span-full rounded-xl border border-admin-border p-3">
        <h3 className="text-sm font-medium">3. Review stock change</h3>
        {preview ? <><dl className="mt-3 grid grid-cols-3 gap-3 text-sm"><div><dt className="text-xs text-admin-text-secondary">Current</dt><dd className="mt-1 font-medium [overflow-wrap:anywhere]">{quantityLabel(item?.quantity_on_hand ?? 0,item?.unit ?? "")}</dd></div><div><dt className="text-xs text-admin-text-secondary">{movement.removes ? "Remove" : "Add"}</dt><dd className="mt-1 font-medium [overflow-wrap:anywhere]">{quantityLabel(Math.abs(preview.change),item?.unit ?? "")}</dd></div><div><dt className="text-xs text-admin-text-secondary">Estimated after</dt><dd className="mt-1 font-medium [overflow-wrap:anywhere]">{quantityLabel(preview.after,item?.unit ?? "")}</dd></div></dl>{preview.after < 0 ? <p className="mt-2 text-sm text-status-danger">This exceeds the current stock. Check the quantity before saving.</p> : null}</> : <p className="mt-2 text-xs text-admin-text-secondary">Enter a quantity above to preview the change.</p>}
        <p className="mt-2 text-xs text-admin-text-secondary">The latest stock is checked when you save.{movement.removes ? " Reserved stock cannot be removed." : ""}</p>
      </div>
      <div className="col-span-full"><InventoryField label="Note or reference" optional><textarea id={`${productPrefix}-movement-note`} maxLength={500} rows={2} placeholder={movement.note} {...field("note")} className="mt-2 w-full rounded-xl border border-admin-border px-3 py-2 text-sm"/></InventoryField></div>
    </> : mode === "transfer" ? <>
      <InventoryField label="Source stock"><SearchableSelect id={`${inventoryPrefix}-transfer-source`} required {...choiceField("sourceItemId")} options={stock.map(row=>({id:row.id,name:`${row.name} · ${branches.find(branch=>branch.id===row.branch_id)?.name??"Branch"} · ${quantityLabel(row.quantity_on_hand,row.unit)}`}))} placeholder="Search source product or branch"/></InventoryField>
      <InventoryField label="Destination stock"><SearchableSelect id={`${inventoryPrefix}-transfer-target`} required {...choiceField("targetItemId")} disabled={pending||!source||!targets.length} options={targets.map(row=>({id:row.id,name:`${row.name} · ${branches.find(branch=>branch.id===row.branch_id)?.name??"Branch"} · ${row.unit}`}))} placeholder="Search destination product or branch"/></InventoryField>
      <p role="status" className="col-span-full text-xs leading-5 text-admin-text-muted">{source && !targets.length ? "No matching product in another accessible branch. Create the product there with the same product code first." : "Choose the same product in another branch. Matching product codes are shown; check the product and unit before transferring."}</p>
      <InventoryField label="Quantity"><Input id={`${inventoryPrefix}-transfer-quantity`} required type="number" min="0.001" step="0.001" {...field("quantity")} className="mt-2"/></InventoryField>
      <InventoryField label="Transfer note" optional><Input id={`${inventoryPrefix}-transfer-note`} maxLength={500} {...field("note")} className="mt-2"/></InventoryField>
    </> : <>
      <InventoryField label="Service"><SearchableSelect id="inventory-recipe-service-select" required {...choiceField("serviceId")} options={services} lookup="service" placeholder="Search service or category"/></InventoryField>
      <InventoryField label="Inventory item"><SearchableSelect id="inventory-recipe-item-select" required {...choiceField("inventoryItemId")} options={stock.map(row=>({id:row.id,name:`${row.name} · ${row.unit}`}))} placeholder="Search inventory item"/></InventoryField>
      <InventoryField label="Quantity used"><Input id="inventory-recipe-quantity-input" required type="number" min="0.001" step="0.001" {...field("quantity")} className="mt-2"/></InventoryField>
      <p className="col-span-full text-xs leading-5 text-admin-text-muted">Set how much of this item the service uses. Saving replaces the quantity for this service and product.</p>
    </>}
    </SettingsFormSection>
    <FormActions id={`${id}-actions`} cancelHref={returnHref}>
      <SubmitButton id={mode === "transfer" ? `${inventoryPrefix}-transfer-button` : mode === "recipe" ? "inventory-recipe-save-button" : `${productPrefix}-movement-save`} pendingText="Saving…" disabled={(mode === "transfer" && !draft.targetItemId) || (mode === "movement" && !item)}>
        {mode === "transfer" ? <ArrowRightLeft aria-hidden="true" size={16}/> : <Save aria-hidden="true" size={16}/>}{mode === "transfer" ? "Transfer stock" : mode === "recipe" ? "Save recipe" : movement.removes ? "Save stock removal" : "Save stock addition"}
      </SubmitButton>
    </FormActions>
  </form>;
}
