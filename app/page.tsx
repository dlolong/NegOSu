export const dynamic = "force-dynamic";
import { ArrowRight, Boxes, Building2, CalendarDays, CarFront, CreditCard, PawPrint, Scissors, ShieldCheck, Store, Users } from "lucide-react";
import type { Metadata } from "next";

import Link from "next/link";

import { MarketingCta, MarketingFooter, MarketingHeader } from "@/components/marketing/product-landing";
import { PublicPlanCatalog } from "@/components/marketing/plan-catalog";
import { productBrand, verticalBrands, supportedVerticalKeys, petCareBrand, hospitalityBrand } from "@/modules/platform/brand";

export const metadata: Metadata = {
  title: { absolute: "NegOSu | Business Operating System" },
  description: productBrand.description,
  alternates: { canonical: "/" },
  openGraph: { title: `${productBrand.name} | Business Operating System`, description: productBrand.description, url: "/" },
};

const applicationPreviews = {
  automotive: { icon: CarFront, description: "Appointments, vehicles, Job Orders, parts, and maintenance." },
  salon: { icon: Scissors, description: "Clients, treatments, staff, appointments, and payments." },
  pet_care: { icon: PawPrint, description: "Pets, owners, grooming appointments, payments, and pickup." },
  hospitality: { icon: Building2, description: "Room bookings, check-ins, checkout, guest history, and payments." },
} as const;

const sharedCapabilities = [
  { icon: Users, title: "Customer records", description: "Keep the people you serve and their history easy to find." },
  { icon: CalendarDays, title: "Scheduling", description: "Coordinate appointments, staff, branches, and resources." },
  { icon: Store, title: "Services", description: "Manage what you offer, duration, pricing, and availability." },
  { icon: Boxes, title: "Inventory", description: "Know what is on hand and record stock movement at each branch." },
  { icon: CreditCard, title: "Payments", description: "Record payments against the work each industry performs." },
  { icon: ShieldCheck, title: "One secure platform", description: "Use shared permissions, audit, notifications, and tenant controls." },
] as const;

const faqs = [
  ["Is NegOSu right for my business?", "NegOSu is built for automotive shops, salons and beauty businesses, pet grooming businesses, and apartelles or inns. Choose your business type to see the tools that fit your day-to-day work."],
  ["How can it help me manage my day?", "Keep customer details, appointments or room bookings, payments, and stock records in one place. You and your team can check what needs attention without searching through separate notebooks and spreadsheets. Available tools depend on your business type and plan."],
  ["Can I try it before choosing a paid plan?", "Yes. Start with the Free plan and see how it fits your business. You can compare plans and upgrade when you need room for more staff, branches, or additional tools."],
  ["What do I need to get started?", "Create an account, choose your business type, and add your business details. Then add the services or rooms you offer and invite the staff who will use NegOSu."],
  ["Can my staff use it too?", "Yes. You can invite your staff and choose what each person is allowed to view or do. The number of staff you can add depends on your plan."],
  ["Can I use it for more than one branch?", "Yes. Choose a plan that supports the number of branches you need. Your team can work with the branches they have access to, while you keep track of your business locations."],
  ["What if I need help deciding?", "Use the Contact us page to tell us about your business and what you need help with. Include your email address so our team can get back to you."],
] as const;

export default function NegOSuLandingPage() {
  return (
    <main id="negosu-home-page" className="min-h-screen overflow-x-clip bg-white text-brand-ink">
      <MarketingHeader />

      <section id="negosu-hero" className="mx-auto grid w-full max-w-7xl gap-8 px-4 pb-12 pt-9 sm:px-6 sm:pb-16 sm:pt-12 lg:min-h-[calc(100svh-4rem)] lg:grid-cols-[1.04fr_.96fr] lg:items-center lg:gap-12 lg:py-14">
        <div>
          <p className="inline-flex rounded-full border border-brand-border bg-brand-tint px-3 py-1 text-sm font-medium text-brand-primary-strong">Four applications. One business platform.</p>
          <h1 className="mt-5 max-w-4xl text-4xl font-medium tracking-[-0.05em] sm:text-5xl lg:text-6xl xl:text-7xl">{productBrand.tagline}</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-600 sm:text-lg sm:leading-8">From service appointments to guest stays, bring your customers, team, inventory and payments together. Choose Automotive, Salon & Beauty, Pet Care, or Apartelle & Inn.</p>
        </div>

        <div id="negosu-hero-product-visual" className="min-w-0 rounded-ui-lg border border-slate-200 bg-white p-3 shadow-ui-md sm:p-4">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
              <div><p className="text-xs font-medium tracking-wider text-brand-primary-strong">NegOSu</p><p className="mt-0.5 font-medium text-brand-ink">Choose your application</p></div>
            </div>
            <div className="p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              {supportedVerticalKeys.map(key => {
                const brand = verticalBrands[key];
                const { icon: Icon, description } = applicationPreviews[key];
                const id = key.replaceAll("_", "-");
                return <Link id={`negosu-${id}-preview`} key={key} href={brand.path} aria-label={`View ${brand.shortName}`} className="group flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-4 text-brand-ink transition-colors hover:border-brand-primary hover:bg-brand-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2">
                  <div className="flex items-center justify-between gap-2"><Icon aria-hidden="true" className="text-brand-primary" size={22}/><ArrowRight aria-hidden="true" size={16} className="text-slate-400 group-hover:text-brand-primary"/></div>
                  <h2 className="mt-3 font-medium">{brand.shortName}</h2>
                  <p className="mt-1 flex-1 text-sm leading-6 text-slate-600">{description}</p>
                </Link>;
              })}
            </div>
            </div>
          </div>
        </div>
      </section>

      <section id="solutions" className="border-y border-zinc-100 bg-zinc-50">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-18">
          <p className="text-sm font-medium normal-case tracking-wider text-brand-primary-strong">Supported industries</p>
          <h2 className="mt-2 text-3xl font-medium tracking-tight sm:text-4xl">What kind of business do you run?</h2>
          <p className="mt-3 max-w-2xl leading-7 text-zinc-600">Choose the application that matches your work. Each has its own industry workflows, connected by the same business platform.</p>
          <div id="negosu-industry-selector" className="mt-8 grid gap-4 sm:grid-cols-2">
            <article id="negosu-automotive-card" className="rounded-ui-lg border border-zinc-200 bg-white p-6 shadow-ui-sm sm:p-7">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-tint text-brand-primary-strong"><CarFront aria-hidden="true" /></div>
              <h3 className="mt-5 text-2xl font-medium">Automotive</h3>
              <p className="mt-2 leading-7 text-zinc-600">For car wash, detailing, repair, maintenance, and auto-care businesses.</p>
              <Link id="negosu-explore-automotive-link" href={verticalBrands.automotive.path} className="mt-6 inline-flex min-h-11 items-center gap-2 font-medium">Explore Automotive <ArrowRight aria-hidden="true" size={18} /></Link>
            </article>
            <article id="negosu-salon-card" className="rounded-ui-lg border border-zinc-200 bg-white p-6 shadow-ui-sm sm:p-7">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-primary-strong"><Scissors aria-hidden="true" /></div>
              <h3 className="mt-5 text-2xl font-medium">Salon &amp; Beauty</h3>
              <p className="mt-2 leading-7 text-zinc-600">For salons, spas, facial care, nail, barber, and beauty-service businesses.</p>
              <Link id="negosu-explore-salon-link" href={verticalBrands.salon.path} className="mt-6 inline-flex min-h-11 items-center gap-2 font-medium">Explore Salon &amp; Beauty <ArrowRight aria-hidden="true" size={18} /></Link>
            </article>
            <article id="negosu-pet-care-card" className="rounded-ui-lg border border-zinc-200 bg-white p-6 shadow-ui-sm sm:p-7"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-primary-strong"><PawPrint aria-hidden="true"/></div><h3 className="mt-5 text-2xl">Pet Care</h3><p className="mt-2 text-sm text-brand-primary-strong">Grooming, bath, and pet spa services</p><p className="mt-2 leading-7 text-zinc-600">For appointment-based pet grooming, from owner and pet records to payments and collection.</p><Link id="negosu-explore-pet-care-link" href={petCareBrand.path} className="mt-6 inline-flex min-h-11 items-center gap-2">Explore Pet Care <ArrowRight aria-hidden="true" size={18}/></Link></article>
            <article id="negosu-hospitality-card" className="rounded-ui-lg border border-zinc-200 bg-white p-6 shadow-ui-sm sm:p-7"><div className="flex items-center justify-between gap-3"><Building2 aria-hidden="true" className="text-brand-primary-strong"/><span className="rounded-full border border-brand-border bg-brand-tint px-3 py-1 text-xs text-brand-primary-strong">Rooms & guests</span></div><h3 className="mt-5 text-2xl">Apartelle &amp; Inn</h3><p className="mt-2 leading-7 text-zinc-600">Manage available rooms, fixed stay rates, cashier check-in, payments, checkout, supplies and reports.</p><Link id="negosu-explore-hospitality-link" href={hospitalityBrand.path} className="mt-6 inline-flex min-h-11 items-center gap-2">Explore Apartelle &amp; Inn <ArrowRight aria-hidden="true" size={18}/></Link></article>
          </div>
          <p className="mt-5 text-sm text-zinc-500">All four applications are available. Choose your business type and start free.</p>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-18">
        <p className="text-sm font-medium normal-case tracking-wider text-brand-primary-strong">Shared capabilities</p>
        <h2 className="mt-2 max-w-3xl text-3xl font-medium tracking-tight sm:text-4xl">The essentials stay connected.</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sharedCapabilities.map(({ icon: Icon, title, description }) => <article id={`negosu-capability-${title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`} key={title} className="border-t border-slate-200 py-5"><Icon aria-hidden="true" className="text-brand-primary" size={22} /><h3 className="mt-4 font-medium">{title}</h3><p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p></article>)}
        </div>
      </section>

      <section id="negosu-vertical-overview" className="border-y border-blue-950 bg-brand-ink text-white">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 py-14 sm:px-6 sm:py-18 lg:grid-cols-2">
          <article id="negosu-automotive-overview" className="rounded-2xl border border-white/15 bg-white/5 p-6 sm:p-8"><p className="text-sm font-medium tracking-wider text-blue-300">NegOSu Automotive</p><h2 className="mt-3 text-3xl font-medium">From arrival to the next service.</h2><p className="mt-3 leading-7 text-zinc-300">Coordinate appointments, vehicles, inspections, approved work, parts, payments, service history, and maintenance.</p><Link href={verticalBrands.automotive.path} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-primary px-4 py-2 font-medium text-white">See Automotive <ArrowRight aria-hidden="true" size={18} /></Link></article>
          <article id="negosu-salon-overview" className="rounded-2xl border border-white/15 bg-white/5 p-6 sm:p-8"><p className="text-sm font-medium tracking-wider text-blue-300">NegOSu Salon &amp; Beauty</p><h2 className="mt-3 text-3xl font-medium">From booking to the next visit.</h2><p className="mt-3 leading-7 text-zinc-300">Coordinate Clients, Appointments, Staff, Treatments, chairs or rooms, products, payments, and reminders.</p><Link href={verticalBrands.salon.path} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-primary px-4 py-2 font-medium text-white">See Salon &amp; Beauty <ArrowRight aria-hidden="true" size={18} /></Link></article>
          <article id="negosu-pet-care-overview" className="rounded-2xl border border-white/15 bg-white/5 p-6 sm:p-8"><p className="text-sm tracking-wider text-blue-300">NegOSu Pet Care · Pet Grooming</p><h2 className="mt-3 text-3xl">From grooming booking to pickup.</h2><p className="mt-3 max-w-3xl leading-7 text-zinc-300">Keep pets and owners together, reserve groomers and resources, record payments, and track when each pet is ready and collected.</p><Link id="negosu-pet-care-overview-link" href={petCareBrand.path} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-primary px-4 py-2 text-white">See Pet Care <ArrowRight aria-hidden="true" size={18}/></Link></article>
          <article id="negosu-hospitality-overview" className="rounded-2xl border border-white/15 bg-white/5 p-6 sm:p-8"><p className="text-sm tracking-wider text-blue-300">NegOSu Apartelle &amp; Inn · Rooms & guests</p><h2 className="mt-3 text-3xl">From check-in to checkout.</h2><p className="mt-3 leading-7 text-zinc-300">See which rooms are occupied, keep guest history, agree charges, record payments and track supplies. Your team and reports stay connected.</p><Link id="negosu-hospitality-overview-link" href={hospitalityBrand.path} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-primary px-4 py-2 text-white">See Apartelle &amp; Inn <ArrowRight aria-hidden="true" size={18}/></Link></article>
        </div>
      </section>

      <section id="negosu-how-it-works" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-18">
        <p className="text-sm font-medium tracking-wider text-brand-primary-strong">How NegOSu works</p>
        <h2 className="mt-2 text-3xl font-medium tracking-tight sm:text-4xl">Choose your business. Set up the essentials. Run the day.</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">{["Create your account and choose a supported business type.", "Add your business, first branch, team, and services or rooms.", "Enter the workspace built for your industry and start operating."].map((step, index) => <article id={`negosu-how-it-works-step-${index + 1}`} key={step} className="border-t border-zinc-200 py-5"><p className="text-xs font-medium normal-case tracking-wider text-zinc-500">Step {index + 1}</p><p className="mt-2 font-medium leading-6">{step}</p></article>)}</div>
      </section>

      <section id="negosu-faq" className="border-y border-zinc-100 bg-zinc-50">
        <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-18">
          <p className="text-sm font-medium normal-case tracking-wider text-brand-primary-strong">FAQ</p>
          <h2 className="mt-2 text-3xl font-medium tracking-tight sm:text-4xl">Questions before you get started?</h2>
          <div className="mt-7 divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white px-5">{faqs.map(([question, answer], index) => <details id={`negosu-faq-item-${index + 1}`} key={question} className="group py-5"><summary className="cursor-pointer list-none font-medium marker:content-none">{question}<span aria-hidden="true" className="float-right ml-3 text-zinc-400 group-open:rotate-45">+</span></summary><p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">{answer}</p></details>)}</div>
        </div>
      </section>

      <PublicPlanCatalog compact />

      <MarketingCta title="Ready to run your business with less friction?" description="Start with Automotive, Salon & Beauty, Pet Care, or Apartelle & Inn. Create your account and set up your business and first branch." />
      <MarketingFooter />
    </main>
  );
}
