"use client";

import { Save as SaveIcon } from "lucide-react";

import { FormActions } from "@/components/form-actions";

import { useState } from "react";
import { updateBusinessBranding } from "@/app/dashboard/settings/actions";
import { BusinessIdentity } from "@/components/business-identity";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";

export function BusinessBrandingForm({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  const [preview, setPreview] = useState(logoUrl ?? "");
  return <form id="settings-business-branding-form" action={updateBusinessBranding} onReset={() => setPreview(logoUrl ?? "")} className="mt-5 space-y-4">
    <div id="settings-business-branding-preview" className="rounded-ui-md border border-admin-border bg-admin-surface-muted p-4"><BusinessIdentity name={name} logoUrl={preview}/></div>
    <label htmlFor="settings-business-logo-url-input" className="block text-sm font-semibold">Business logo URL
      <Input id="settings-business-logo-url-input" name="logoUrl" type="url" maxLength={2048} value={preview} onChange={event => setPreview(event.target.value)} placeholder="https://example.com/your-logo.png" aria-describedby="settings-business-logo-help" className="mt-2"/>
    </label>
    <p id="settings-business-logo-help" className="text-sm text-admin-text-muted">Use a publicly accessible image URL. Your logo appears in your workspace and customer pages. Leave this blank to use your business initials.</p>
    <FormActions id="settings-business-branding-actions"><SubmitButton id="settings-business-branding-save-button" pendingText="Saving logo…"><SaveIcon aria-hidden="true" size={16} className="shrink-0"/>Save business logo</SubmitButton></FormActions>
  </form>;
}
