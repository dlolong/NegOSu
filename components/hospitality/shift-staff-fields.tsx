"use client";
import { useCallback, useSyncExternalStore } from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import { SearchableSelect, type SelectOption } from "@/components/searchable-select";
import { Field } from "./shared";
import { availableShiftPreferences, shiftPreferenceKey, type ShiftPreferenceScope } from "@/modules/hospitality/shift-preferences";

const memory = new Map<string, string>();
const changed = "negosu-shift-preferences-changed";
function subscribe(listener: () => void) {
  const external = (event: StorageEvent) => {
    if (event.key) memory.delete(event.key); else memory.clear();
    listener();
  };
  window.addEventListener(changed, listener);
  window.addEventListener("storage", external);
  return () => { window.removeEventListener(changed, listener); window.removeEventListener("storage", external); };
}
const serverSnapshot = () => "";

export function ShiftStaffFields({ options, prefix, scope, canManage = false }: { scope: ShiftPreferenceScope; canManage?: boolean; options: SelectOption[]; prefix: string }) {
  const key = shiftPreferenceKey(scope);
  const snapshot = useCallback(() => {
    if (memory.has(key)) return memory.get(key)!;
    try { return window.localStorage.getItem(key) ?? ""; } catch { return ""; }
  }, [key]);
  const raw = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const selected = availableShiftPreferences(raw, options.map(option => option.id));
  function remember(field: "cashierStaffId" | "housekeeperStaffId", value: string) {
    const next = JSON.stringify({ ...selected, [field]: value });
    memory.set(key, next);
    try { window.localStorage.setItem(key, next); } catch { /* Keep selections for this session when storage is unavailable. */ }
    window.dispatchEvent(new Event(changed));
  }
  return <fieldset id={`${prefix}-shift-staff`} className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
    <legend className="px-1 text-sm font-medium">Staff on duty</legend>
    <p className="mb-3 text-xs text-slate-500">Remembered on this browser for your branch. Change when the shift changes.</p>
    {options.length ? <div className="grid gap-3 sm:grid-cols-2"><Field label="Cashier *"><SearchableSelect id={`${prefix}-cashier`} name="cashierStaffId" options={options} preserveValueOnReset value={selected.cashierStaffId} onValueChange={value => remember("cashierStaffId", value)} required placeholder="Search cashier…"/></Field><Field label="Housekeeper *"><SearchableSelect id={`${prefix}-housekeeper`} name="housekeeperStaffId" options={options} preserveValueOnReset value={selected.housekeeperStaffId} onValueChange={value => remember("housekeeperStaffId", value)} required placeholder="Search housekeeper…"/></Field></div> : <p role="alert" className="text-sm">No active staff are available for this branch. Ask the owner to add staff or update their branch assignments before continuing.</p>}
    {canManage ? <Link id={`${prefix}-manage-staff`} href="/dashboard/settings/staff" className="mt-3 inline-flex items-center gap-2 text-xs text-brand-primary underline"><Users size={14}/>Staff directory</Link> : null}
    {!options.length ? <input type="hidden" name="cashierStaffId" value=""/> : null}
  </fieldset>;
}
