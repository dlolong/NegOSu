"use client";

import { useRef, useState } from "react";
import { Plus, Save, X } from "lucide-react";
import { createAppointmentCategory, createAppointmentService } from "@/app/dashboard/appointments/entity-actions";
import { InlineCreationGuard } from "@/components/inline-creation-guard";
import { SearchableSelect, type SelectOption } from "@/components/searchable-select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormActions } from "@/components/form-actions";

export function CategoryField({ id, options = [], defaultValue = "", canCreate = true, name = "categoryId", onValueChange, onEditingChange }: { id: string; options?: SelectOption[]; defaultValue?: string; canCreate?: boolean; name?: string; onValueChange?: (id: string) => void; onEditingChange?: (editing: boolean) => void }) {
  const [choices, setChoices] = useState(options), [value, setValue] = useState(defaultValue);
  const [draft, setDraft] = useState<string | null>(null), [error, setError] = useState(""), [pending, setPending] = useState(false);
  const requestId = useRef(""), busy = useRef(false);
  function finish() { setDraft(null); setError(""); onEditingChange?.(false); }
  async function save() {
    if (busy.current) return;
    busy.current = true; setPending(true); setError("");
    try {
      const result = await createAppointmentCategory({ name: draft, requestId: requestId.current });
      if (result.error) { setError(result.error); return; }
      if (result.data) { setChoices(current => [...current, result.data]); setValue(result.data.id); onValueChange?.(result.data.id); finish(); }
    } catch { setError("Unable to save the category. Please try again."); }
    finally { busy.current = false; setPending(false); }
  }
  return <div className="min-w-0"><SearchableSelect id={id} name={name} options={choices} value={value} onValueChange={next => { setValue(next); onValueChange?.(next); }} placeholder="Search categories or leave uncategorized" lookup="category" disabled={draft !== null} createLabel="category" onCreate={canCreate ? text => { requestId.current = crypto.randomUUID(); setDraft(text); onEditingChange?.(true); } : undefined}/>
    {draft !== null ? <InlineCreationGuard><section id={`${id}-confirmation`} aria-label="Add category" className="mt-3 rounded-ui-lg border border-admin-border bg-admin-surface p-3"><p className="text-sm font-medium">Add this category to your database?</p><fieldset disabled={pending} className="mt-3 grid gap-3"><label className="text-sm">Category name<Input id={`${id}-new-name`} value={draft} maxLength={100} onChange={event => setDraft(event.target.value)}/></label>{error ? <p role="alert" className="text-sm text-status-danger">{error}</p> : null}<FormActions id={`${id}-new-actions`} onCancel={finish} disabled={pending}><Button id={`${id}-new-save`} type="button" disabled={pending} onClick={() => void save()}><Save size={16} aria-hidden="true"/>{pending ? "Saving…" : "Add category"}</Button></FormActions></fieldset></section></InlineCreationGuard> : null}
  </div>;
}

export function ServicePicker({ id, services, defaultIds = [], canCreate = false, label = "Service", currency = "PHP" }: { id: string; services: SelectOption[]; defaultIds?: string[]; canCreate?: boolean; label?: string; currency?: string }) {
  const [selected, setSelected] = useState(defaultIds), [choices, setChoices] = useState(services);
  const [draft, setDraft] = useState<{ name: string; basePrice: string; durationMinutes: string; categoryId: string } | null>(null);
  const [pending, setPending] = useState(false), [categoryEditing, setCategoryEditing] = useState(false), [error, setError] = useState("");
  const requestId = useRef(""), busy = useRef(false);
  async function save() {
    if (busy.current || categoryEditing) return;
    busy.current = true; setPending(true); setError("");
    try {
      const result = await createAppointmentService({ ...draft, requestId: requestId.current });
      if (result.error) { setError(result.error); return; }
      if (result.data) { setChoices(current => [...current.filter(item => item.id !== result.data.id), result.data]); setSelected(current => [...new Set([...current, result.data.id])]); setDraft(null); }
    } catch { setError("Unable to save the service. Please try again."); }
    finally { busy.current = false; setPending(false); }
  }
  return <fieldset id={`${id}-services-fieldset`} className="col-span-full min-w-0"><legend className="text-sm font-medium">{label}s *</legend>
    <label htmlFor={`${id}-service-select`} className="sr-only">Search {label.toLowerCase()} or category</label>
    <SearchableSelect id={`${id}-service-select`} options={choices} value="" required={!selected.length} lookup="service" disabled={draft !== null} placeholder={`Search ${label.toLowerCase()} or category name`} createLabel={label.toLowerCase()} onValueChange={(_value, option) => { if (option) { setChoices(current => [...current.filter(item => item.id !== option.id), option]); setSelected(current => [...new Set([...current, option.id])]); } }} onCreate={canCreate ? name => { requestId.current = crypto.randomUUID(); setError(""); setDraft({ name, basePrice: "", durationMinutes: "", categoryId: "" }); } : undefined}/>
    <div id={`${id}-selected-services`} className="mt-3 grid min-w-0 gap-2">{selected.map(serviceId => { const service = choices.find(item => item.id === serviceId); return <div key={serviceId} className="flex min-w-0 items-center justify-between gap-3 rounded-ui-lg border border-admin-border bg-admin-surface p-3"><input type="hidden" name="serviceIds" value={serviceId}/><span className="min-w-0 text-sm [overflow-wrap:anywhere]">{service?.name ?? "Selected service"}{service?.description ? <span className="block text-xs text-slate-500">{service.description}</span> : null}</span><button id={`${id}-service-${serviceId}-remove`} type="button" disabled={pending} aria-label={`Remove ${service?.name ?? "service"}`} className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg hover:bg-slate-100" onClick={() => setSelected(current => current.filter(value => value !== serviceId))}><X size={16} aria-hidden="true"/></button></div>; })}</div>
    {draft ? <InlineCreationGuard><section id={`${id}-service-confirmation`} aria-label={`Add ${label.toLowerCase()}`} className="mt-3 rounded-ui-lg border border-admin-border bg-admin-surface p-4"><p className="font-medium">Add this {label.toLowerCase()} to your database?</p><p className="mt-1 text-xs text-slate-500">Set its price and duration. It will be available at all branches; you can adjust availability and pricing in Services.</p><fieldset disabled={pending} className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
      <label className="col-span-full text-sm">Name<Input id={`${id}-new-service-name`} value={draft.name} maxLength={160} onChange={event => setDraft({ ...draft, name: event.target.value })}/></label>
      <div className="col-span-full"><label htmlFor={`${id}-new-service-category`} className="text-sm">Category</label><CategoryField id={`${id}-new-service-category`} name="" onValueChange={categoryId => setDraft(current => current ? { ...current, categoryId } : current)} onEditingChange={setCategoryEditing}/></div>
      <label className="text-sm">Price ({currency})<Input id={`${id}-new-service-price`} inputMode="decimal" value={draft.basePrice} onChange={event => setDraft({ ...draft, basePrice: event.target.value })}/></label>
      <label className="text-sm">Duration (minutes)<Input id={`${id}-new-service-duration`} type="number" min={1} max={10080} value={draft.durationMinutes} onChange={event => setDraft({ ...draft, durationMinutes: event.target.value })}/></label>
      {error ? <p role="alert" className="col-span-full text-sm text-status-danger">{error}</p> : null}
      <FormActions id={`${id}-new-service-actions`} onCancel={() => { setDraft(null); setCategoryEditing(false); setError(""); }} disabled={pending}><Button id={`${id}-new-service-save`} type="button" disabled={pending || categoryEditing} onClick={() => void save()}><Plus size={16} aria-hidden="true"/>{pending ? "Saving…" : `Add ${label.toLowerCase()}`}</Button></FormActions>
    </fieldset></section></InlineCreationGuard> : null}
    <p className="mt-2 text-xs text-slate-500">Select one or more services. Final prices and availability are checked when saving the appointment.</p>
  </fieldset>;
}
