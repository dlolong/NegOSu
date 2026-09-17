import { Save as SaveIcon, Settings as SettingsIcon, Palette } from "lucide-react";

import { FormActions } from "@/components/form-actions";

import { BusinessBrandingForm } from "@/components/business-branding-form";
import { roleHasPermission } from "@/lib/rbac";

import { updateProfile } from "@/app/dashboard/settings/actions";
import { FormMessage } from "@/components/form-message";
import { PageHeader } from "@/components/page-patterns";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getDashboardContext } from "@/lib/auth/context";
import { WorkspaceThemeForm } from "@/components/workspace-theme-form";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const [params, context] = await Promise.all([searchParams, getDashboardContext()]);
  return (
    <main id="settings-page" className="mx-auto min-w-0 max-w-5xl">
      <PageHeader id="settings-page-header" eyebrow="Settings" title="Profile and workspace" description="Manage your personal details, workspace appearance, and active business."/>
      <FormMessage error={params.error} message={params.message} />
      <div className="mt-5 grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
        <Card id="settings-profile-section" elevation="none" className="min-w-0 p-5 sm:p-6"><h2 className="text-lg font-medium">Your profile</h2><form id="settings-profile-form" action={updateProfile} className="mt-5 space-y-4"><label className="block text-sm font-medium">Full name<Input id="settings-profile-name-input" required maxLength={120} autoComplete="name" name="fullName" defaultValue={context.profile.fullName} className="mt-2" /></label><label className="block text-sm font-medium">Phone<Input id="settings-profile-phone-input" maxLength={30} autoComplete="tel" name="phone" defaultValue={context.profile.phone} className="mt-2" /></label><label className="block text-sm font-medium">Email<Input id="settings-profile-email-input" disabled value={context.user.email ?? ""} className="mt-2" /></label><FormActions id="settings-profile-actions"><SubmitButton pendingText="Saving…" id="settings-profile-save-button"><SaveIcon aria-hidden="true" size={16} className="shrink-0"/>Save profile</SubmitButton></FormActions></form></Card>
        <Card id="settings-organization-section" elevation="none" className="min-w-0 p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate text-lg font-medium text-admin-text">{context.activeMembership.organizationName}</h2><p className="mt-1 truncate text-sm text-admin-text-muted">/{context.activeMembership.organizationSlug}</p></div><Badge>{context.activeMembership.role}</Badge></div><dl className="mt-6 grid grid-cols-2 gap-4 text-sm"><div><dt className="text-admin-text-muted">Branch</dt><dd className="mt-1 font-medium text-admin-text">{context.activeMembership.branchName}</dd></div><div><dt className="text-admin-text-muted">Phone</dt><dd className="mt-1 font-medium text-admin-text">{context.activeMembership.organizationPhone || "Not provided"}</dd></div><div><dt className="text-admin-text-muted">Currency</dt><dd className="mt-1 font-medium text-admin-text">{context.activeMembership.currency}</dd></div><div><dt className="text-admin-text-muted">Timezone</dt><dd className="mt-1 break-words font-medium text-admin-text">{context.activeMembership.timezone}</dd></div></dl><div className="mt-6 flex flex-wrap gap-2"><Button id="settings-manage-branches-button" asChild variant="secondary"><a href="/dashboard/settings/branches"><SettingsIcon aria-hidden="true" size={16} className="shrink-0"/>Manage branches</a></Button>{context.activeMembership.role==="owner"&&<Button id="settings-manage-staff-button" asChild><a href="/dashboard/settings/staff"><SettingsIcon aria-hidden="true" size={16} className="shrink-0"/>Manage staff</a></Button>}</div></Card>
        {roleHasPermission(context.activeMembership.role, "settings.manage") ? <Card id="settings-business-branding-section" elevation="none" className="min-w-0 p-5 sm:p-6 lg:col-span-2"><h2 className="text-lg font-medium">Business identity</h2><p className="mt-1 text-sm text-admin-text-secondary">Make this workspace feel like {context.activeMembership.organizationName}. Your business leads, with a small Powered by NegOSu attribution.</p><BusinessBrandingForm key={`${context.activeMembership.organizationId}-${context.activeMembership.organizationLogoUrl}`} name={context.activeMembership.organizationName} logoUrl={context.activeMembership.organizationLogoUrl}/></Card> : null}
        <Card id="settings-appearance-section" elevation="none" className="min-w-0 p-5 sm:p-6 lg:col-span-2">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-ui-md bg-brand-tint text-brand-primary-strong"><Palette aria-hidden="true" size={20}/></span>
            <div><h2 className="text-lg font-medium text-admin-text">Workspace color theme</h2><p id="settings-theme-help" className="mt-1 text-sm text-admin-text-secondary">Choose a color palette for your workspace.</p></div>
          </div>
          <WorkspaceThemeForm preference={context.profile.dashboardTheme}/>
        </Card>
      </div>
    </main>
  );
}
