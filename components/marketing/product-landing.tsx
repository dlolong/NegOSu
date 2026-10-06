import { ArrowRight as ArrowRightIcon, ArrowRight, CheckCircle2, type LucideIcon } from "lucide-react";

import Link from "next/link";
import type { ReactNode } from "react";

import { BrandWordmark } from "@/components/brand-wordmark";
import {
  productBrand,
  petCareBrand,
  marketingBrands,
  hospitalityBrand,
  type MarketingVerticalKey,
} from "@/modules/platform/brand";

export type MarketingFeature = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export { MarketingHeader } from "@/components/marketing/marketing-header";

export function MarketingHero({ vertical, eyebrow, title, description, visual }: {
  vertical: MarketingVerticalKey;
  eyebrow: string;
  title: string;
  description: string;
  visual: ReactNode;
}) {
  return (
    <section id={`negosu-${toId(vertical)}-hero`} className="mx-auto grid w-full max-w-7xl gap-8 px-4 pb-12 pt-9 sm:px-6 sm:pb-16 sm:pt-12 lg:min-h-[calc(100svh-4rem)] lg:grid-cols-[1.04fr_.96fr] lg:items-center lg:gap-12 lg:py-14">
      <div>
        <div className="inline-flex rounded-full border border-brand-border bg-brand-tint px-3 py-1 text-sm font-medium text-brand-primary-strong">{eyebrow}</div>
        <h1 className="mt-5 max-w-3xl text-4xl font-medium tracking-[-0.045em] sm:text-5xl lg:text-6xl">{title}</h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-600 sm:text-lg sm:leading-8">{description}</p>
        <div className="mt-7 flex flex-col gap-3 min-[380px]:flex-row">
          <Link id={`negosu-${toId(vertical)}-start-free-button`} href={marketingBrands[vertical].signupPath} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-primary px-5 py-3 font-medium text-white shadow-sm hover:bg-brand-primary-strong">
            Start Free <ArrowRight aria-hidden="true" size={18} />
          </Link>
          <a id={`negosu-${toId(vertical)}-explore-features-button`} href={`#negosu-${toId(vertical)}-features`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-brand-border bg-white px-5 py-3 font-medium text-brand-ink hover:bg-brand-tint"><ArrowRightIcon aria-hidden="true" size={16} className="shrink-0"/>Explore Features</a>
        </div>
      </div>
      <div id={`negosu-${toId(vertical)}-product-visual`} className="min-w-0">{visual}</div>
    </section>
  );
}

export function FeatureSection({ vertical, heading, description, features }: {
  vertical: MarketingVerticalKey;
  heading: string;
  description?: string;
  features: readonly MarketingFeature[];
}) {
  return (
    <section id={`negosu-${toId(vertical)}-features`} className="border-y border-zinc-100 bg-zinc-50">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-18">
        <h2 className="max-w-3xl text-3xl font-medium tracking-tight sm:text-4xl">{heading}</h2>
        {description ? <p className="mt-3 max-w-2xl leading-7 text-zinc-600">{description}</p> : null}
        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, description: featureDescription }) => (
            <article id={`negosu-${toId(vertical)}-feature-${toId(title)}`} key={title} className="rounded-ui-md border border-zinc-200 bg-white p-5 shadow-ui-sm">
              <Icon aria-hidden="true" className="mb-4 text-brand-primary" size={22} />
              <h3 className="font-medium">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{featureDescription}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HowItWorks({ vertical, steps }: { vertical: MarketingVerticalKey; steps: readonly string[] }) {
  return (
    <section id={`negosu-${toId(vertical)}-how-it-works`} className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-18">
      <p className="text-sm font-medium normal-case tracking-wider text-brand-primary-strong">How it works</p>
      <h2 className="mt-2 text-3xl font-medium tracking-tight sm:text-4xl">Set up the essentials, then run the day.</h2>
      <div className="mt-7 grid gap-3 md:grid-cols-3">
        {steps.map((step, index) => (
          <article id={`negosu-${toId(vertical)}-how-it-works-step-${index + 1}`} key={step} className="flex gap-3 border-t border-zinc-200 py-5">
            <CheckCircle2 aria-hidden="true" className="mt-0.5 shrink-0 text-brand-primary" size={20} />
            <div>
              <p className="text-xs font-medium normal-case tracking-wider text-zinc-500">Step {index + 1}</p>
              <p className="mt-1 font-medium">{step}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function MarketingCta({ vertical, title, description }: { vertical?: MarketingVerticalKey; title: string; description: string }) {
  const signupPath = vertical ? marketingBrands[vertical].signupPath : "/signup";
  return (
    <section id={vertical ? `negosu-${toId(vertical)}-final-cta` : "negosu-final-cta"} className="px-4 py-14 sm:px-6 sm:py-18">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 rounded-2xl bg-brand-ink px-6 py-8 text-white shadow-sm sm:px-8 sm:py-10 lg:flex-row lg:items-center">
        <div>
          <h2 className="text-3xl font-medium tracking-tight">{title}</h2>
          <p className="mt-2 max-w-2xl leading-7 text-zinc-300">{description}</p>
        </div>
        <Link id={vertical ? `negosu-${toId(vertical)}-final-start-button` : "negosu-final-start-button"} href={signupPath} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-primary px-5 py-3 font-medium text-white hover:bg-blue-400">
          Start Free <ArrowRight aria-hidden="true" size={18} />
        </Link>
      </div>
    </section>
  );
}

export function MarketingFooter({ vertical }: { vertical?: MarketingVerticalKey } = {}) {
  const linkClass = "inline-flex min-h-10 items-center rounded-sm text-sm text-slate-300 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300";
  return (
    <footer id="negosu-main-footer" className="bg-brand-ink px-4 text-white sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 py-12 sm:py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-16">
          <div className="min-w-0 max-w-sm">
            <Link id="negosu-footer-home-link" href="/" aria-label="NegOSu home" className="inline-flex rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"><BrandWordmark inverse className="w-36"/></Link>
            <p className="mt-4 text-base font-medium text-white">{productBrand.tagline}</p>
            <p className="mt-3 max-w-xs text-sm leading-6 text-slate-300">Keep your team, customers, and daily operations connected. One platform, built around your business.</p>
          </div>
          <nav id="negosu-footer-navigation" aria-label="Footer navigation" className="grid min-w-0 grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3">
            <div className="min-w-0">
              <h2 id="negosu-footer-solutions-title" className="mb-3 text-sm font-semibold text-white">Solutions</h2>
              <ul aria-labelledby="negosu-footer-solutions-title" className="space-y-1">
                <li><Link id="negosu-footer-automotive-link" href={marketingBrands.automotive.path} className={linkClass}>Automotive</Link></li>
                <li><Link id="negosu-footer-salon-link" href={marketingBrands.salon.path} className={linkClass}>Salon &amp; Beauty</Link></li>
                <li><Link id="negosu-footer-pet-care-link" href={petCareBrand.path} className={linkClass}>Pet Care</Link></li>
                <li><Link id="negosu-footer-hospitality-link" href={hospitalityBrand.path} className={linkClass}>Apartelle &amp; Inn</Link></li>
              </ul>
            </div>
            <div className="min-w-0">
              <h2 id="negosu-footer-platform-title" className="mb-3 text-sm font-semibold text-white">Platform</h2>
              <ul aria-labelledby="negosu-footer-platform-title" className="space-y-1">
                <li><Link id="negosu-footer-features-link" href="/#features" className={linkClass}>Features</Link></li>
                <li><Link id="negosu-footer-plans-link" href="/plans" className={linkClass}>Plans &amp; pricing</Link></li>
                <li><Link id="negosu-footer-contact-link" href="/contact" className={linkClass}>Contact us</Link></li>
              </ul>
            </div>
            <div className="min-w-0">
              <h2 id="negosu-footer-account-title" className="mb-3 text-sm font-semibold text-white">Get started</h2>
              <ul aria-labelledby="negosu-footer-account-title" className="space-y-1">
                <li><Link id="negosu-footer-start-free-link" href={vertical ? marketingBrands[vertical].signupPath : "/signup"} className={linkClass}>Create an account<ArrowRight size={14} aria-hidden="true" className="ml-2 shrink-0"/></Link></li>
                <li><Link id="negosu-footer-sign-in-link" href={vertical ? marketingBrands[vertical].loginPath : "/login"} className={linkClass}>Sign in</Link></li>
              </ul>
            </div>
          </nav>
        </div>
        <div className="flex flex-col gap-2 border-t border-white/15 py-5 text-xs leading-5 text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {productBrand.name}. All rights reserved.</p>
          <p>Simple tools. Connected operations.</p>
        </div>
      </div>
    </footer>
  );
}

function toId(value: string) {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
