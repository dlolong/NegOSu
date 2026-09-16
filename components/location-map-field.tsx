"use client";
import { useState, type ReactNode } from "react";
import { saveBranchPublic } from "@/app/dashboard/settings/public-page/actions";
import { FormMessage } from "@/components/form-message";
import { MapPin } from "lucide-react";
import { normalizeMapInput, mapEmbedUrl } from "@/lib/location-map";
import { LocationMap } from "@/components/location-map";

export function LocationMapField({ branchId, name, address, value }: { branchId: string; name: string; address: (string|null)[]; value: string|null }) {
  const [draft,setDraft] = useState(value??"");
  const normalized = normalizeMapInput(draft);
  const embed = mapEmbedUrl(normalized);
  return <fieldset id={`public-branch-map-field-${branchId}`} className="min-w-0 space-y-3 rounded-ui-lg border border-admin-border p-3 sm:p-4">
    <legend className="px-1 text-sm font-semibold">Location map</legend>
    <p className="flex gap-2 text-sm text-admin-text-secondary"><MapPin size={16} className="mt-0.5 shrink-0" aria-hidden="true"/><span>{address.filter(Boolean).join(", ")||"Add this location’s address in Branch settings."}</span></p>
    <label htmlFor={`public-branch-map-url-input-${branchId}`} className="block text-sm font-medium">Map link or Google Maps embed code</label>
    <textarea id={`public-branch-map-url-input-${branchId}`} name="mapUrl" value={draft} onChange={event=>setDraft(event.target.value)} maxLength={8000} rows={3} aria-describedby={`public-branch-map-help-${branchId}`} className="w-full min-w-0 rounded-ui-md border border-admin-border bg-admin-surface p-3 text-sm [overflow-wrap:anywhere]" placeholder="Paste a map link or the code from Share → Embed a map"/>
    <p id={`public-branch-map-help-${branchId}`} className="text-xs leading-5 text-admin-text-secondary">For an interactive map, find your location in Google Maps, choose Share → Embed a map → Copy HTML, then paste it here. A regular map link adds a directions button.</p>
    {normalized===null?<p role="alert" className="text-sm text-status-danger">Use a valid map link or Google Maps embed code.</p>:<LocationMap id={`public-branch-map-preview-${branchId}`} name={name} address={address} mapUrl={normalized} compact/>}
    {embed?<p className="text-xs text-admin-text-secondary">Preview your pin before saving. This map will appear on your public website.</p>:null}
  </fieldset>;
}

export function PublicBranchForm({id,children,className}:{id:string;children:ReactNode;className?:string}) {
  const [error,setError]=useState<string>();
  return <div onResetCapture={event=>{event.preventDefault();event.stopPropagation();}}><FormMessage id={`${id}-error`} error={error}/><form id={id} className={className} action={async data=>{setError(undefined);const result=await saveBranchPublic(data);setError(result.error);}}>{children}</form></div>;
}
