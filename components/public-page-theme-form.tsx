"use client";

import { useState } from "react";
import { Check, Palette } from "lucide-react";
import { savePublicPageTheme } from "@/app/dashboard/settings/public-page/actions";
import { FormActions } from "@/components/form-actions";
import { SubmitButton } from "@/components/submit-button";
import { publicPageThemes, type PublicPageThemeId } from "@/modules/platform/public-page-theme";

export function PublicPageThemeForm({ preference }: { preference: PublicPageThemeId }) {
  const [selected, setSelected] = useState(preference);
  return <form id="public-page-theme-form" action={savePublicPageTheme} onReset={() => setSelected(preference)} className="mt-4 min-w-0 space-y-4">
    <fieldset aria-describedby="public-page-theme-help" className="min-w-0">
      <legend className="sr-only">Public page color theme</legend>
      <div id="public-page-theme-options" className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-3">
        {publicPageThemes.map(theme => <label key={theme.id} id={`public-page-theme-option-${theme.id}`} className="relative min-w-0 cursor-pointer rounded-ui-lg border border-admin-border bg-admin-surface p-3 has-[:checked]:border-brand-primary has-[:checked]:ring-2 has-[:checked]:ring-brand-border has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-primary">
          <input id={`public-page-theme-radio-${theme.id}`} type="radio" name="publicPageTheme" value={theme.id} checked={selected === theme.id} onChange={() => setSelected(theme.id)} className="peer sr-only"/>
          <Check aria-hidden="true" size={18} className="absolute right-3 top-3 hidden text-brand-primary peer-checked:block"/>
          <strong className="block pr-6 text-sm">{theme.name}</strong>
          <span className="mt-3 flex gap-2" aria-hidden="true">{theme.swatches.map(color => <span key={color} className="size-7 rounded-full border border-black/10" style={{ backgroundColor: color }}/>)}</span>
        </label>)}
      </div>
    </fieldset>
    <p id="public-page-theme-help" className="text-sm text-admin-text-secondary">Free on all plans for now. Choose a palette, preview it below, then save to update your public page.</p>
    <div id="public-page-theme-preview" data-public-theme={selected} className="overflow-hidden rounded-ui-lg border border-admin-border bg-admin-canvas text-admin-text" aria-label="Public page theme preview">
      <div className="bg-brand-ink px-4 py-3 text-sm text-white">Your business</div>
      <div className="space-y-3 p-4"><p className="text-xl font-semibold text-brand-ink">Welcome to our page</p><p className="text-sm text-admin-text-secondary">Explore what we offer and get in touch.</p><span className="inline-block rounded-ui-md bg-brand-primary px-4 py-2 text-sm font-medium text-white">Explore our services</span><div className="rounded-ui-md border border-brand-border bg-brand-tint p-3 text-sm text-brand-primary-strong">Services, products and locations</div></div>
    </div>
    <FormActions id="public-page-theme-actions"><SubmitButton id="public-page-theme-save-button" pendingText="Saving theme…"><Palette aria-hidden="true" size={16}/>Save public page theme</SubmitButton></FormActions>
  </form>;
}
