import { createPublicClient } from "@/lib/supabase/public";
import { petCareBrand } from "@/modules/platform/brand";
import { Check } from "lucide-react";
import Link from "next/link";

import { presentLivePlans, formatPlanPrice } from "@/modules/platform/plan-catalog";

export async function PublicPlanCatalog({ compact = false }: { compact?: boolean }) {
  let plans: ReturnType<typeof presentLivePlans> = [];
  try {
    const { data, error } = await createPublicClient().rpc("public_plan_catalog");
    if (!error && data) plans = presentLivePlans(data);
  } catch { /* Do not advertise stale fallback prices when the catalog is unavailable. */ }
  return (
    <section id={compact ? "negosu-home-plans" : "negosu-plans-catalog"} aria-labelledby={compact ? "negosu-home-plans-title" : "negosu-plans-title"} className={compact ? "border-y border-zinc-100 bg-zinc-50" : "bg-white"}>
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-18">
        <p className="text-sm font-medium text-brand-primary-strong">Simple plans</p>
        <div className="mt-2 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div>
            <h2 id={compact ? "negosu-home-plans-title" : "negosu-plans-title"} className="text-3xl font-medium tracking-tight sm:text-4xl">Start free. Upgrade when your business needs more.</h2>
            <p className="mt-3 max-w-2xl leading-7 text-zinc-600">Choose Automotive, Salon &amp; Beauty, Pet Care, or Apartelle &amp; Inn at signup. Available tools vary by industry and plan. Prices are in Philippine pesos.</p>
          </div>
          {compact ? <Link id="negosu-view-all-plans-link" href="/plans" className="inline-flex min-h-11 items-center font-medium text-brand-primary-strong hover:underline">Compare all plans</Link> : null}
        </div>

        <p id={compact ? "negosu-home-pet-care-note" : "negosu-plans-pet-care-note"} className="mt-4 rounded-xl border border-brand-border bg-brand-tint p-4 text-sm leading-6 text-zinc-600">Pet Care includes grooming appointments, pet records, and pickup tracking. Public pages and reminders follow your selected plan. <Link href={petCareBrand.path} className="text-brand-primary-strong underline">Explore Pet Care.</Link></p>

        {!plans.length ? <p id="negosu-plans-unavailable" role="status" className="mt-6 text-sm">Plan prices are temporarily unavailable. Please try again shortly.</p> : null}
        <div id="negosu-plan-grid" className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {plans.map((plan) => (
            <article id={`negosu-plan-${plan.id}`} key={plan.id} className={`relative flex min-w-0 flex-col rounded-ui-lg border bg-white p-5 shadow-ui-sm ${plan.recommended ? "border-brand-primary ring-2 ring-blue-100" : "border-zinc-200"}`}>
              {plan.recommended ? <span className="mb-3 w-fit rounded-full bg-brand-tint px-2.5 py-1 text-xs font-medium text-brand-primary-strong">Most popular</span> : null}
              <h3 className="text-lg font-medium">{plan.name}</h3>
              <p className="mt-1 min-h-12 text-sm leading-5 text-zinc-600">{plan.summary}</p>
              <p className="mt-5 text-2xl font-medium">
                {plan.custom ? "Let’s talk" : plan.monthlyPriceCentavos === 0 ? "Free" : <>{formatPlanPrice(plan.monthlyPriceCentavos)}<span className="text-sm font-normal text-zinc-500">/month</span></>}
              </p>
              {!plan.custom && plan.yearlyPriceCentavos ? <p className="mt-1 text-xs text-zinc-500">{formatPlanPrice(plan.yearlyPriceCentavos)} billed yearly</p> : <div className="h-5" />}
              <ul className="mt-5 space-y-2 text-sm text-zinc-700">
                {plan.highlights.map((highlight) => <li key={highlight} className="flex gap-2"><Check aria-hidden="true" className="mt-0.5 shrink-0 text-brand-primary" size={16} /><span>{highlight}</span></li>)}
              </ul>
              <div className="mt-auto pt-6">
                {plan.custom
                  ? <a id={`negosu-plan-${plan.id}-contact-link`} href="mailto:sales@negosu.com" className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-brand-border px-4 font-medium text-brand-ink hover:bg-brand-tint">Contact sales</a>
                  : <Link id={`negosu-plan-${plan.id}-start-link`} href="/signup" className={`inline-flex min-h-11 w-full items-center justify-center rounded-xl px-4 font-medium ${plan.recommended ? "bg-brand-primary text-white hover:bg-brand-primary-strong" : "border border-brand-border text-brand-ink hover:bg-brand-tint"}`}>{plan.id === "free" ? "Start free" : `Choose ${plan.name}`}</Link>}
              </div>
            </article>
          ))}
        </div>
        <p id="negosu-plan-note" className="mt-5 text-center text-sm text-zinc-500">Paid plans can be managed by the business owner after signup. Upgrading or downgrading never deletes your business records.</p>
      </div>
    </section>
  );
}
