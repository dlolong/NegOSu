
import Link from "next/link";
import { redirect } from "next/navigation";

import { signUp } from "@/app/auth/actions";
import { SignupForm } from "@/components/signup-form";
import { AuthShell } from "@/components/auth-shell";
import { FormMessage } from "@/components/form-message";
import { getAuthenticatedUser } from "@/lib/auth/context";
import { resolveOnboardingDestination } from "@/lib/auth/onboarding";
import { productBrand } from "@/modules/platform/brand";
import { resolveOptionalProductEntry } from "@/modules/platform/product-entry";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string; industry?: string }> }) {
  const [params, auth] = await Promise.all([searchParams, getAuthenticatedUser()]);
  if (auth) redirect((await resolveOnboardingDestination(auth.supabase, auth.user.id)).path);
  const entry = resolveOptionalProductEntry(params.industry);
  const contextQuery = entry ? `?industry=${entry.industry}` : "";

  return (
    <AuthShell closeHref="/" id="negosu-signup-page" industry={entry?.industry} title="Create your account" description={entry?.signupDescription ?? `Create your ${productBrand.name} account and choose the business you want to manage.`} footer={<>Already registered? <Link id="negosu-signup-login-link" className="font-medium text-brand-primary-strong" href={`/login${contextQuery}`}>Sign in</Link></>}>
      <FormMessage error={params.error} />
      <SignupForm action={signUp} initialIndustry={entry?.industry} />
    </AuthShell>
  );
}
