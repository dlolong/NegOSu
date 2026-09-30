"use client";

import { ImageUploadButton } from "@/components/image-upload-field";
import { Save as SaveIcon } from "lucide-react";

import { FormActions } from "@/components/form-actions";

import { useState } from "react";
import { updateBusinessBranding } from "@/app/dashboard/settings/actions";
import { BusinessIdentity } from "@/components/business-identity";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";

export function BusinessBrandingForm({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  const [preview, setPreview] = useState(logoUrl ?? "");
  return <form id="settings-business-branding-form" action={updateBusinessBranding} onReset={() => setPreview(logoUrl ?? "")} className="mt-5 grid min-w-0 gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
    <div id="settings-business-branding-preview" className="rounded-ui-md border border-admin-border bg-admin-surface-muted p-4"><p className="mb-3 text-xs font-medium text-admin-text-secondary">Logo preview</p><BusinessIdentity name={name} logoUrl={preview}/></div><div className="min-w-0 space-y-3">
    <label htmlFor="settings-business-logo-url-input" className="block text-sm font-medium">Business logo URL
      <Input id="settings-business-logo-url-input" name="logoUrl" type="url" maxLength={2048} value={preview} onChange={event => setPreview(event.target.value)} placeholder="Upload below or paste an image link" aria-describedby="settings-business-logo-help" className="mt-2"/>
    </label>
    <p id="settings-business-logo-help" className="text-sm text-admin-text-muted">Upload a logo below or paste a public image link. Leave the field blank to use your business initials. Save to apply your choice.</p>
    <ImageUploadButton id="settings-business-logo-upload" onUploaded={setPreview}/>
    </div><FormActions id="settings-business-branding-actions"><SubmitButton id="settings-business-branding-save-button" pendingText="Saving logo…"><SaveIcon aria-hidden="true" size={16} className="shrink-0"/>Save business logo</SubmitButton></FormActions>
  </form>;
}
