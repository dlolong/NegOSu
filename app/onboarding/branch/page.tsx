import { FormActions } from "@/components/form-actions";

import { Check as CheckIcon } from "lucide-react";
import { redirect } from "next/navigation";

import { createInitialBranch } from "@/app/onboarding/actions";
import { FormMessage } from "@/components/form-message";
import { BusinessIdentity } from "@/components/business-identity";
import { PoweredBy } from "@/components/powered-by";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { isMissingOrganizationIndustry } from "@/lib/auth/database-compatibility";
import { requireAuthenticatedUser } from "@/lib/auth/context";
import { resolveOnboardingDestination } from "@/lib/auth/onboarding";

export default async function BranchOnboardingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ error }, { supabase, user }] = await Promise.all([searchParams, requireAuthenticatedUser("/onboarding/branch")]);
  const destination = await resolveOnboardingDestination(supabase, user.id);
  if (destination.path !== "/onboarding/branch" || !destination.organizationId) redirect(destination.path);
  const currentOrganization = await supabase.from("organizations").select("name, logo_url, industry").eq("id", destination.organizationId).single();
  const legacyOrganization = isMissingOrganizationIndustry(currentOrganization.error)
    ? await supabase.from("organizations").select("name, logo_url").eq("id", destination.organizationId).single()
    : null;
  const organization: { name: string; logo_url: string | null; industry?: string } | null = legacyOrganization
    ? legacyOrganization.data
    : currentOrganization.data;

  return (
    <main id="negosu-onboarding-branch-page" className="min-h-dvh bg-slate-50 px-4 py-8 sm:px-5 sm:py-12">
      <section id="negosu-onboarding-branch-card" className="mx-auto w-full max-w-2xl rounded-ui-lg border border-brand-border bg-white p-5 shadow-ui-md sm:p-9">
        <BusinessIdentity name={organization?.name ?? "Your business"} logoUrl={organization?.logo_url}/><PoweredBy id="onboarding-branch-powered-by" className="mt-2"/>
        <p className="mt-5 text-sm font-medium text-brand-primary-strong">Setup · Step 2 of 2</p>
        <h1 id="negosu-onboarding-branch-title" className="mt-2 text-3xl font-medium tracking-tight">Set up your main branch.</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">Add the first operating location for {organization?.name ?? "your business"}. It becomes the default branch.</p>
        <FormMessage error={error} />
        <form id="negosu-onboarding-branch-form" action={createInitialBranch} className="mt-7 space-y-5">
          <input type="hidden" name="organizationId" value={destination.organizationId} />
          <label className="block text-sm font-medium" htmlFor="negosu-branch-name-input">Branch name<Input id="negosu-branch-name-input" required maxLength={120} name="branchName" defaultValue="Main Branch" autoComplete="organization" className="mt-2" /></label>
          <label className="block text-sm font-medium" htmlFor="negosu-branch-address-input">Address line<Input id="negosu-branch-address-input" required maxLength={200} name="addressLine" autoComplete="street-address" placeholder="Building, street, subdivision" className="mt-2" /></label>
          <label className="block text-sm font-medium" htmlFor="negosu-branch-barangay-input">Barangay <span className="font-normal text-zinc-600">(optional)</span><Input id="negosu-branch-barangay-input" maxLength={120} name="barangay" className="mt-2" /></label>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block text-sm font-medium" htmlFor="negosu-branch-city-input">City / municipality<Input id="negosu-branch-city-input" required maxLength={120} name="city" autoComplete="address-level2" className="mt-2" /></label>
            <label className="block text-sm font-medium" htmlFor="negosu-branch-province-input">Province<Input id="negosu-branch-province-input" required maxLength={120} name="province" autoComplete="address-level1" className="mt-2" /></label>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block text-sm font-medium" htmlFor="negosu-branch-postal-input">Postal code <span className="font-normal text-zinc-600">(optional)</span><Input id="negosu-branch-postal-input" maxLength={20} name="postalCode" autoComplete="postal-code" inputMode="numeric" className="mt-2" /></label>
            <label className="block text-sm font-medium" htmlFor="negosu-branch-country-input">Country<Input id="negosu-branch-country-input" required maxLength={120} name="country" autoComplete="country-name" defaultValue="Philippines" className="mt-2" /></label>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block text-sm font-medium" htmlFor="negosu-branch-phone-input">Branch phone <span className="font-normal text-zinc-600">(optional)</span><Input id="negosu-branch-phone-input" maxLength={30} name="phone" type="tel" autoComplete="tel" className="mt-2" /></label>
            <label className="block text-sm font-medium" htmlFor="negosu-branch-email-input">Branch email <span className="font-normal text-zinc-600">(optional)</span><Input id="negosu-branch-email-input" maxLength={254} name="email" type="email" autoComplete="email" className="mt-2" /></label>
          </div>
          <label className="block text-sm font-medium" htmlFor="negosu-branch-notes-input">Opening notes <span className="font-normal text-zinc-600">(optional)</span><textarea id="negosu-branch-notes-input" maxLength={500} name="openingNotes" rows={3} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-admin-text placeholder:text-zinc-400 focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20" placeholder="Landmark or operating note" /></label>
          <FormActions id="negosu-branch-actions" cancelHref="/"><SubmitButton id="negosu-branch-submit-button" pendingText="Creating branch…"><CheckIcon aria-hidden="true" size={16} className="shrink-0"/>Finish setup</SubmitButton></FormActions>
        </form>
      </section>
    </main>
  );
}
