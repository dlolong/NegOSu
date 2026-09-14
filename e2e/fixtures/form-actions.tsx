import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Save } from "lucide-react";
import { FormActions } from "@/components/form-actions";
import { FormDialog } from "@/components/management-ui";
import { CustomerForm, VehicleForm, BranchForm } from "@/components/crm-forms";
import { ServiceForm, VisitForm } from "@/components/operations-forms";
import { StaffProfileForm } from "@/components/staff-management";
import { BusinessBrandingForm } from "@/components/business-branding-form";
import { SubmitButton } from "@/components/submit-button";

// Loaded only by the browser component tests. Server actions and Next navigation
// are replaced at their boundaries; no customer database is contacted.
declare global {
  interface Window {
    recordFormAction: (name: string, entries: Array<[string, FormDataEntryValue]>) => Promise<{ error?: string } | void>;
    releaseFormSave?: () => void;
  }
}
const params = new URLSearchParams(location.search);
const kind = params.get("fixture") ?? "customer";
const customer = { id: "customer-one", full_name: "Ana Santos", phone: null, email: null, address_line: null, city: null, province: null, notes: null };
const vehicle = { id: "vehicle-one", customer_id: customer.id, make: "Toyota", model: "Vios", plate_number: null, model_year: null, variant: null, color: null, vehicle_type: null, fuel_type: null, transmission: null, odometer_km: null, vin: null, engine_number: null, notes: null };
const branch = { id: "branch-one", name: "Main" };
const submit = async (data: FormData) => { await window.recordFormAction("saveVisit", [...data]); };
function Fixture() {
  const [saved, setSaved] = useState(false);
  if (kind === "pending") return <form action={async data => { await window.recordFormAction("savePending", [...data]); await new Promise<void>(resolve => { window.releaseFormSave = resolve; }); setSaved(true); }}>
    <label>Name<input id="pending-name" name="name" required defaultValue="Ana"/></label>
    <FormActions id="pending-actions"><SubmitButton id="pending-save" pendingText="Saving…"><Save aria-hidden="true" size={16}/>Save</SubmitButton></FormActions>
    {saved ? <p id="save-success">Saved</p> : null}
  </form>;
  if (kind === "branding") return <BusinessBrandingForm name="Salon" logoUrl="https://example.test/original.svg"/>;
  if (kind === "staff") return <FormDialog id="fixture-dialog" title="Add staff" closeHref="/dashboard/settings/staff"><StaffProfileForm branches={[branch]} industry="salon" prefix="salon-staff-create"/></FormDialog>;
  if (kind === "branch") return <BranchForm/>;
  if (kind === "service") return <ServiceForm categories={[]} branches={[]} automotivePricing={false}/>;
  if (kind === "walk-in" || kind === "appointment" || kind === "appointment-edit" || kind === "quick-create") return <VisitForm mode={kind === "walk-in" ? "walk_in" : "appointment"} action={submit} branches={[branch]} customers={[{ id: customer.id, name: customer.full_name }]} vehicles={[{ id: vehicle.id, customer_id: customer.id, label: "Toyota Vios" }]} services={[]} defaults={{ customerId: customer.id, vehicleId: vehicle.id }} appointment={kind === "appointment-edit" ? { id: "appointment-one", branch_id: branch.id, customer_id: customer.id, vehicle_id: vehicle.id, starts_at: "2026-09-14T10:00", customer_note: null, internal_note: null, serviceIds: [] } : undefined}/>;
  const isVehicle = kind.startsWith("vehicle");
  const edit = kind.endsWith("edit");
  const form = isVehicle ? <VehicleForm vehicle={edit ? vehicle : undefined} customers={[customer]} embedded returnTo="/dashboard/vehicles?q=Toyota&create=1"/> : <CustomerForm customer={edit ? customer : undefined} embedded returnTo="/dashboard/customers?q=Ana&create=1"/>;
  if (kind.includes("standalone")) return form;
  return <FormDialog id="fixture-dialog" title={isVehicle ? "Vehicle details" : "Customer details"} closeHref={isVehicle ? "/dashboard/vehicles?q=Toyota" : "/dashboard/customers?q=Ana"}>{form}</FormDialog>;
}
createRoot(document.getElementById("root")!).render(<Fixture/>);
