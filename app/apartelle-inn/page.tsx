import Link from "next/link";
import { ArrowRight, BedDouble, Boxes, Building2, ChartNoAxesCombined, CreditCard, Users } from "lucide-react";
import { FeatureSection, HowItWorks, MarketingCta, MarketingFooter, MarketingHeader, MarketingHero } from "@/components/marketing/product-landing";
import { hospitalityBrand } from "@/modules/platform/brand";

export const metadata = {
  title: "NegOSu Apartelle & Inn",
  description: "Manage rooms, guests, check-in and checkout, payments, inventory and reports with NegOSu Apartelle & Inn. Start with a free account.",
  alternates: { canonical: "/apartelle-inn" },
};

export default function ApartelleInnPage() {
  return (
    <main id="negosu-hospitality-page" className="min-h-screen bg-white text-brand-ink">
      <MarketingHeader vertical="hospitality"/>
      <MarketingHero vertical="hospitality" eyebrow="NegOSu Apartelle & Inn" title="Your rooms, guests and daily operations. Together."
        description="Keep the front desk organized, from check-in to checkout. Manage rooms, guest history, room rates, payments, supplies and your team in one workspace. Start with a free account."
        visual={<section id="negosu-hospitality-preview-board" className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm sm:p-7">
          <div className="flex items-center gap-3"><Building2 className="text-brand-primary" aria-hidden="true"/><h2 className="text-xl">Front desk at a glance</h2></div>
          <p className="mt-2 text-sm text-slate-500">An example of your daily workspace</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">{[["Room 101", "Vacant", "Ready for a new check-in"], ["Room 102", "Occupied", "View the guest’s stay and balance"]].map(([room, status, detail]) => <article key={room} className="rounded-xl border border-slate-200 bg-white p-4"><BedDouble aria-hidden="true" className="text-brand-primary"/><h3 className="mt-3 text-lg">{room}</h3><p className="mt-2 text-sm text-brand-primary-strong">{status}</p><p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p></article>)}</div>
          <p className="mt-4 rounded-xl border border-brand-border bg-white p-4 text-sm leading-6">Room status, guest payments and low-stock supplies stay easy to find.</p>
        </section>}/>
      <FeatureSection vertical="hospitality" heading="Everything your front desk needs for the day." description="A simple stay workflow with the shared NegOSu business tools."
        features={[
          { icon: BedDouble, title: "Rooms & stays", description: "Configure 3, 6 and 12-hour, daily, weekly and monthly rates, with hourly extensions and stay history." },
          { icon: Users, title: "Guest records", description: "Check in without a guest name. Add optional guest details when useful and keep stay history." },
          { icon: CreditCard, title: "Charges & payments", description: "Record final prices, discounts, payments, paper receipts and refundable deposits, with clear checkout balances." },
          { icon: Boxes, title: "Products & inventory", description: "Track branch supplies, record stock movements and see what needs restocking." },
          { icon: ChartNoAxesCombined, title: "Reports", description: "Review stays, room status, collections, outstanding balances and stock. Export options follow your plan." },
          { icon: Building2, title: "Staff & branches", description: "Manage your team, operating locations and system access with existing role and branch permissions." },
        ]}/>
      <HowItWorks vertical="hospitality" steps={["Create your account, business and first branch.", "Add rooms, package and extension rates, and your staff.", "Select a room and stay period, take payment, then check in."]}/>
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6"><p className="max-w-3xl text-sm leading-6 text-slate-600">Administrators set room rates. Cashiers collect payment and return change; supply movements are recorded separately. Guest payments record money received by your business. Your NegOSu subscription stays separate in Billing & Plan.</p><Link id="negosu-hospitality-sign-in-link" href={hospitalityBrand.loginPath} className="mt-4 inline-flex min-h-11 items-center gap-2 text-brand-primary-strong">Already have an account? Sign in <ArrowRight size={16} aria-hidden="true"/></Link></section>
      <MarketingCta vertical="hospitality" title="Make room for a simpler workday." description="Start free with Rooms, Guests, Payments, Inventory, Reports and Staff. Set up your apartelle or inn today."/>
      <MarketingFooter vertical="hospitality"/>
    </main>
  );
}
