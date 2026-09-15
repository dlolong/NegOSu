"use client";

import { Plus as PlusIcon } from "lucide-react";

import { useRef, useState } from "react";
import { createAppointmentCustomer, createAppointmentVehicle } from "@/app/dashboard/appointments/entity-actions";
import { InlineCreationGuard } from "@/components/inline-creation-guard";
import { SearchableSelect } from "@/components/searchable-select";
import { FormActions } from "@/components/form-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { VisitCustomerChoice, VisitVehicleChoice } from "@/lib/visit-entities";



export function VisitEntityFields({ prefix, vehiclePrefix, customers, vehicles, customerLabel, requiresVehicle, defaultCustomerId = "", defaultVehicleId = "", customerName = "customerId", selectId, onCustomerChange }: {
  onCustomerChange?: (id: string) => void;
  customerName?: string;
  selectId?: string;
  prefix: string;
  vehiclePrefix: string;
  customers: VisitCustomerChoice[];
  vehicles: VisitVehicleChoice[];
  customerLabel: string;
  requiresVehicle: boolean;
  defaultCustomerId?: string;
  defaultVehicleId?: string;
}) {
  const [customerChoices, setCustomerChoices] = useState(customers);
  const [vehicleChoices, setVehicleChoices] = useState(vehicles);
  const [customerId, setCustomerId] = useState(defaultCustomerId || vehicles.find(vehicle => vehicle.id === defaultVehicleId)?.customer_id || "");
  const [vehicleId, setVehicleId] = useState(defaultVehicleId);
  const [editing, setEditing] = useState<"customer" | "vehicle" | null>(null);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const requestId = useRef("");
  const previous = useRef({ customerId, vehicleId });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [customerDraft, setCustomerDraft] = useState({ fullName: "", phone: "", email: "" });
  const [vehicleDraft, setVehicleDraft] = useState({ make: "", model: "", plateNumber: "", vehicleType: "" });
  const lowerLabel = customerLabel.toLowerCase();

  function open(kind: "customer" | "vehicle", name = "") {
    previous.current = { customerId, vehicleId };
    requestId.current = crypto.randomUUID();
    setError(""); setMessage(""); setEditing(kind);
    if (kind === "customer") { setCustomerId(""); onCustomerChange?.(""); setCustomerDraft({ fullName: name, phone: "", email: "" }); }
    else setVehicleDraft({ make: "", model: "", plateNumber: "", vehicleType: "" });
    setVehicleId("");
  }

  function cancel() {
    setCustomerId(previous.current.customerId); onCustomerChange?.(previous.current.customerId); setVehicleId(previous.current.vehicleId);
    setEditing(null); setError("");
  }

  async function save(kind: "customer" | "vehicle") {
    if (busy.current) return;
    busy.current = true; setPending(true); setError("");
    try {
      if (kind === "customer") {
        const result = await createAppointmentCustomer({ ...customerDraft, requestId: requestId.current });
        if (result.error) { setError(result.error); return; }
        if (!result.data) return;
        setCustomerChoices(current => [...current.filter(item => item.id !== result.data.id), result.data]);
        setCustomerId(result.data.id); onCustomerChange?.(result.data.id); setVehicleId(""); setMessage(`${customerLabel} created and selected.`);
      } else {
        const result = await createAppointmentVehicle({ ...vehicleDraft, customerId, requestId: requestId.current });
        if (result.error) { setError(result.error); return; }
        if (!result.data) return;
        setVehicleChoices(current => [...current.filter(item => item.id !== result.data.id), result.data]);
        setVehicleId(result.data.id); setMessage("Vehicle created and selected.");
      }
      setEditing(null);
    } catch { setError("Unable to save right now. Please try again."); }
    finally { busy.current = false; setPending(false); }
  }

  const customerSelectId = selectId ?? `${prefix}-${lowerLabel}-select`;
  return <>
    <div className="min-w-0">
      <label htmlFor={customerSelectId} className="text-sm font-semibold">{customerLabel} *</label>
      <SearchableSelect id={customerSelectId} name={customerName} required options={customerChoices} lookup="customer" disabled={editing !== null} value={customerId} onValueChange={(id, option) => { if (option) setCustomerChoices(current => [...current.filter(row => row.id !== id), option]); setCustomerId(id); onCustomerChange?.(id); setVehicleId(""); setMessage(""); }} placeholder={`Search ${lowerLabel} by name, phone, or email`} onCreate={name => open("customer", name)} createLabel={lowerLabel}/>
      {editing !== "customer" ? <Button id={`${prefix}-quick-${lowerLabel}-open-button`} type="button" variant="secondary" className="mt-3" disabled={editing !== null} onClick={() => open("customer")}><PlusIcon aria-hidden="true" size={16} className="shrink-0"/>Create {lowerLabel}</Button> : <InlineCreationGuard><section id={`${prefix}-quick-${lowerLabel}-details`} aria-label={`Create ${lowerLabel}`} className="mt-3 rounded-xl border border-slate-200 p-3">
        <p className="mb-3 text-sm font-semibold">Add this record to your database?</p><fieldset disabled={pending} className="grid gap-3">
          <label className="text-sm font-semibold">Full name *<Input id={`${prefix}-quick-${lowerLabel}-name`} autoComplete="name" maxLength={160} value={customerDraft.fullName} onChange={event => setCustomerDraft({ ...customerDraft, fullName: event.target.value })}/></label>
          <label className="text-sm font-semibold">Phone (optional)<Input id={`${prefix}-quick-${lowerLabel}-phone`} type="tel" maxLength={40} value={customerDraft.phone} onChange={event => setCustomerDraft({ ...customerDraft, phone: event.target.value })}/></label>
          <label className="text-sm font-semibold">Email (optional)<Input id={`${prefix}-quick-${lowerLabel}-email`} type="email" value={customerDraft.email} onChange={event => setCustomerDraft({ ...customerDraft, email: event.target.value })}/></label>
          <FormActions id={`${prefix}-quick-${lowerLabel}-actions`} cancelId={`${prefix}-quick-${lowerLabel}-cancel-button`} onCancel={cancel} disabled={pending}><Button id={`${prefix}-quick-${lowerLabel}-save-button`} type="button" disabled={pending} aria-busy={pending} onClick={() => void save("customer")}><PlusIcon aria-hidden="true" size={16} className="shrink-0"/>{pending ? "Creating…" : `Create ${lowerLabel}`}</Button></FormActions>
        </fieldset>
      </section></InlineCreationGuard>}
    </div>
    {requiresVehicle ? <div className="min-w-0">
      <label htmlFor={`${vehiclePrefix}-vehicle-select`} className="text-sm font-semibold">Vehicle *</label>
      <SearchableSelect id={`${vehiclePrefix}-vehicle-select`} name="vehicleId" required options={vehicleChoices.filter(vehicle => vehicle.customer_id === customerId).map(vehicle => ({ id: vehicle.id, name: vehicle.label }))} lookup="vehicle" scopeId={customerId || undefined} disabled={!customerId || editing !== null} value={vehicleId} onValueChange={(id, option) => { if (option) setVehicleChoices(current => [...current.filter(row => row.id !== id), { id, label: option.name, customer_id: customerId }]); setVehicleId(id); setMessage(""); }} placeholder={customerId ? "Search vehicle or plate" : `Select a ${lowerLabel} first`}/>
      {editing !== "vehicle" ? <Button id={`${prefix}-quick-vehicle-open-button`} type="button" variant="secondary" className="mt-3" disabled={!customerId || editing !== null} onClick={() => open("vehicle")}><PlusIcon aria-hidden="true" size={16} className="shrink-0"/>Create vehicle</Button> : <InlineCreationGuard><section id={`${prefix}-quick-vehicle-details`} aria-label="Create vehicle" className="mt-3 rounded-xl border border-slate-200 p-3">
        <p className="mb-3 text-sm font-semibold">Add this record to your database?</p><fieldset disabled={pending} className="grid gap-3">
          <label className="text-sm font-semibold">Make *<Input id={`${prefix}-quick-vehicle-make`} maxLength={80} value={vehicleDraft.make} onChange={event => setVehicleDraft({ ...vehicleDraft, make: event.target.value })}/></label>
          <label className="text-sm font-semibold">Model *<Input id={`${prefix}-quick-vehicle-model`} maxLength={80} value={vehicleDraft.model} onChange={event => setVehicleDraft({ ...vehicleDraft, model: event.target.value })}/></label>
          <label className="text-sm font-semibold">Plate (optional)<Input id={`${prefix}-quick-vehicle-plate`} maxLength={30} value={vehicleDraft.plateNumber} onChange={event => setVehicleDraft({ ...vehicleDraft, plateNumber: event.target.value })}/></label>
          <label className="text-sm font-semibold">Vehicle class (optional)<Input id={`${prefix}-quick-vehicle-type`} maxLength={40} placeholder="e.g. SUV" value={vehicleDraft.vehicleType} onChange={event => setVehicleDraft({ ...vehicleDraft, vehicleType: event.target.value })}/></label>
          <FormActions id={`${prefix}-quick-vehicle-actions`} cancelId={`${prefix}-quick-vehicle-cancel-button`} onCancel={cancel} disabled={pending}><Button id={`${prefix}-quick-vehicle-save-button`} type="button" disabled={pending} aria-busy={pending} onClick={() => void save("vehicle")}><PlusIcon aria-hidden="true" size={16} className="shrink-0"/>{pending ? "Creating…" : "Create vehicle"}</Button></FormActions>
        </fieldset>
      </section></InlineCreationGuard>}
    </div> : null}
    {error ? <p id={`${prefix}-quick-create-error`} role="alert" className="text-sm text-status-danger sm:col-span-2">{error}</p> : null}
    {message ? <p id={`${prefix}-quick-create-message`} role="status" className="text-sm text-status-success sm:col-span-2">{message}</p> : null}
  </>;
}
