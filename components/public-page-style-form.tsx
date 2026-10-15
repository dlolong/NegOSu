"use client";

import { useState } from "react";
import { Check, LayoutTemplate } from "lucide-react";
import { savePublicPageAppearance } from "@/app/dashboard/settings/public-page/actions";
import { FormActions } from "@/components/form-actions";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { PublicStyledHero } from "@/components/public-page-presentation";
import { publicPageStylesForIndustry, resolvePublicHeroPosition, type PublicPageStyleId, type PublicHero } from "@/modules/platform/public-page-style";
import { resolvePublicPageTheme } from "@/modules/platform/public-page-theme";

export function PublicPageStyleForm({ industry, preference, hero, coverUrl, name, theme }: {
  industry: string; preference: PublicPageStyleId; hero: PublicHero; coverUrl: string | null; name: string; theme: string;
}) {
  const initial = { headline: hero.headline ?? "", eyebrow: hero.eyebrow ?? "", description: hero.description ?? "", position: resolvePublicHeroPosition(hero.position) };
  const [selected, setSelected] = useState(preference);
  const [draft, setDraft] = useState(initial);
  return <form id="public-page-style-form" action={savePublicPageAppearance} onReset={() => { setSelected(preference); setDraft(initial); }} className="mt-4 min-w-0 space-y-5">
    <fieldset aria-describedby="public-page-style-help" className="grid min-w-0 gap-3 sm:grid-cols-2"><legend className="sr-only">Public page style</legend>
      {publicPageStylesForIndustry(industry).map(style => <label key={style.id} id={`public-page-style-option-${style.id}`} className="relative min-w-0 cursor-pointer rounded-ui-lg border border-admin-border p-4 has-[:checked]:border-brand-primary has-[:checked]:ring-2 has-[:checked]:ring-brand-border has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-primary">
        <input id={`public-page-style-radio-${style.id}`} className="peer sr-only" type="radio" name="pageStyle" value={style.id} checked={style.id === selected} onChange={() => setSelected(style.id)}/>
        <Check aria-hidden="true" size={18} className="absolute right-3 top-4 hidden text-brand-primary peer-checked:block"/><strong className="block pr-6">{style.name}</strong><span className="mt-2 block text-sm leading-6 text-admin-text-secondary">{style.description}</span>
      </label>)}
    </fieldset>
    <p id="public-page-style-help" className="text-sm text-admin-text-secondary">Free on all plans for now. Your color theme is selected separately. Services, products and promos keep their scrolling cards.</p>
    <div hidden={selected === "standard"} className="space-y-4">
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium" htmlFor="public-page-hero-eyebrow">Introductory label<Input id="public-page-hero-eyebrow" name="eyebrow" maxLength={60} value={draft.eyebrow} onChange={event => setDraft({ ...draft, eyebrow: event.target.value })} placeholder="Use the default introduction" className="mt-2"/></label>
        <label className="text-sm font-medium" htmlFor="public-page-hero-position">Cover image focus<select id="public-page-hero-position" name="position" value={draft.position} onChange={event => setDraft({ ...draft, position: resolvePublicHeroPosition(event.target.value) })} className="mt-2 min-h-11 w-full rounded-ui-md border border-admin-border bg-white px-3"><option value="center">Center</option><option value="left">Left</option><option value="right">Right</option></select></label>
        <label className="text-sm font-medium sm:col-span-2" htmlFor="public-page-hero-headline">Hero headline<Input id="public-page-hero-headline" name="headline" maxLength={120} value={draft.headline} onChange={event => setDraft({ ...draft, headline: event.target.value })} placeholder="Use the default headline" className="mt-2"/></label>
        <label className="text-sm font-medium sm:col-span-2" htmlFor="public-page-hero-description">Supporting text<textarea id="public-page-hero-description" name="description" maxLength={300} value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} placeholder="Use the default supporting text" className="mt-2 min-h-24 w-full rounded-ui-md border border-admin-border bg-white p-3"/></label>
      </div>
      <p className="text-sm text-admin-text-secondary">Leave text blank to use the style’s defaults. The hero uses your saved cover image from Business details below. Review the full public page after saving.</p>
    </div>
    {selected !== "standard" ? <div id="public-page-style-preview" data-public-theme={resolvePublicPageTheme(theme)} data-public-style={selected} className="public-page-style-preview overflow-hidden rounded-ui-lg border border-admin-border" aria-label="Hero style preview"><PublicStyledHero name={name} industry={industry} hero={draft} coverUrl={coverUrl} bookingAvailable={industry !== "hospitality"} slug="preview" preview/></div> : <p id="public-page-standard-style-help" className="rounded-ui-lg bg-admin-surface-muted p-4 text-sm text-admin-text-secondary">Standard uses your business name, description and cover image in the existing layout. Your custom hero text is retained for when you switch styles.</p>}
    <FormActions id="public-page-style-actions"><SubmitButton id="public-page-style-save-button" pendingText="Saving style…"><LayoutTemplate size={16} aria-hidden="true"/>Save page style</SubmitButton></FormActions>
  </form>;
}
