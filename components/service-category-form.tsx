"use client";

import { useActionState, useState } from "react";
import { Save, Plus, Trash2 } from "lucide-react";
import { saveCategory, deleteCategory } from "@/app/dashboard/operations-actions";
import { FormActions } from "@/components/form-actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import type { CategoryActionState } from "@/lib/service-categories";

export type CategoryRecord = { id: string; name: string; sort_order: number; is_active: boolean; serviceCount: number };

export function ServiceCategoryForm({ category, mode, prefix, q, filterCategory, nextOrder = 0 }: {
  category?: CategoryRecord; mode: "create" | "edit" | "delete"; prefix: string; q?: string; filterCategory?: string; nextOrder?: number;
}) {
  const [state, action] = useActionState((_previous: CategoryActionState, data: FormData) => mode === "delete" ? deleteCategory(data) : saveCategory(data), {});
  const deleting = mode === "delete";
  const [name, setName] = useState(category?.name ?? "");
  const [sortOrder, setSortOrder] = useState(String(category?.sort_order ?? nextOrder));
  const [active, setActive] = useState(category?.is_active ?? true);
  return <form id={`${prefix}-${mode}-form`} action={action} className="grid min-w-0 gap-4">
    <input type="hidden" name="id" value={category?.id ?? ""}/>
    <input type="hidden" name="q" value={q ?? ""}/><input type="hidden" name="category" value={filterCategory ?? ""}/>
    <FormMessage error={state.error}/>
    {deleting ? <div className="min-w-0 space-y-3 text-sm text-admin-text-secondary">
      <p>Delete <strong className="break-words text-admin-text [overflow-wrap:anywhere]">{category?.name}</strong>?</p>
      <p>{category?.serviceCount ?? 0} linked services or treatments will remain in the catalog and become <strong>Uncategorized</strong>. Their prices, bookings, and history are kept.</p>
      <p>This category cannot be restored after deletion.</p>
    </div> : <>
      <label htmlFor={`${prefix}-${mode}-name-input`} className="min-w-0 text-sm font-semibold">Category name
        <Input id={`${prefix}-${mode}-name-input`} name="name" required minLength={2} maxLength={100} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Hair care or Exterior detailing" className="mt-2"/>
      </label>
      <label htmlFor={`${prefix}-${mode}-sort-input`} className="text-sm font-semibold">Sort order
        <Input id={`${prefix}-${mode}-sort-input`} name="sortOrder" type="number" required min={0} max={9999} value={sortOrder} onChange={event => setSortOrder(event.target.value)} className="mt-2"/>
        <span className="mt-1 block text-xs font-normal text-admin-text-muted">Lower numbers appear first.</span>
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input id={`${prefix}-${mode}-active-input`} type="checkbox" name="isActive" checked={active} onChange={event => setActive(event.target.checked)}/>Available when adding services</label>
    </>}
    <FormActions id={`${prefix}-${mode}-actions`}>
      <SubmitButton id={`${prefix}-${mode}-save-button`} pendingText={deleting ? "Deleting…" : "Saving…"} variant={deleting ? "destructive" : "primary"}>
        {deleting ? <Trash2 aria-hidden="true" size={16}/> : mode === "create" ? <Plus aria-hidden="true" size={16}/> : <Save aria-hidden="true" size={16}/>}
        {deleting ? "Delete category" : mode === "create" ? "Add category" : "Save category"}
      </SubmitButton>
    </FormActions>
  </form>;
}
