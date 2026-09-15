import { Check, Palette } from "lucide-react";
import { updateDashboardTheme } from "@/app/dashboard/settings/actions";
import { FormActions } from "@/components/form-actions";
import { SubmitButton } from "@/components/submit-button";
import { dashboardThemes, type DashboardThemeId, type DashboardThemeOption } from "@/modules/platform/dashboard-theme";

export function WorkspaceThemeForm({ preference }: { preference: DashboardThemeId }) {
  return <form id="settings-theme-form" action={updateDashboardTheme} className="mt-5 min-w-0">
    <fieldset aria-describedby="settings-theme-help" className="min-w-0">
      <legend className="sr-only">Dashboard color theme</legend>
      <div id="settings-theme-options" className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {dashboardThemes.map(theme => <ThemeChoice key={theme.id} theme={theme} selected={preference}/>)}
      </div>
    </fieldset>
    <p className="mt-4 text-xs leading-5 text-admin-text-muted">Your choice applies to your account. Business logos and public pages keep their own branding. Success, warning, and error colors stay consistent.</p>
    <FormActions id="settings-theme-actions" className="mt-4"><SubmitButton id="settings-theme-save-button" pendingText="Applying theme…"><Palette aria-hidden="true" size={16} className="shrink-0"/>Apply color theme</SubmitButton></FormActions>
  </form>;
}
function ThemeChoice({ theme, selected }: { theme: DashboardThemeOption; selected: DashboardThemeId }) {
  return <label id={`settings-theme-option-${theme.id}`} className="relative flex min-w-0 cursor-pointer flex-col rounded-ui-lg border border-admin-border bg-admin-surface p-4 transition-[border-color,box-shadow] has-[:checked]:border-brand-primary has-[:checked]:ring-2 has-[:checked]:ring-brand-border has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-primary">
    <input id={`settings-theme-radio-${theme.id}`} className="peer sr-only" type="radio" name="dashboardTheme" value={theme.id} defaultChecked={theme.id === selected}/>
    <Check aria-hidden="true" className="absolute right-3 top-4 hidden text-brand-primary peer-checked:block" size={18}/>
    <span className="block min-w-0 pr-5"><strong className="block text-sm text-admin-text">{theme.name}</strong><small className="mt-2 block leading-5 text-admin-text-muted">{theme.description}</small></span>
    <span className="mt-auto flex gap-1.5 pt-4" aria-hidden="true">{theme.swatches.map(color => <span key={color} className="size-7 rounded-full border border-black/10" style={{backgroundColor: color}}/>)}</span>
  </label>;
}
