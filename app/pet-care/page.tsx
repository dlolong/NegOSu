import type { Metadata } from "next";
import { CalendarDays, CreditCard, HeartHandshake, ArrowRight, PawPrint, Scissors, ShieldCheck, Users, Armchair } from "lucide-react";
import Link from "next/link";
import { FeatureSection, HowItWorks, MarketingFooter, MarketingHeader, MarketingHero } from "@/components/marketing/product-landing";
import { petCareBrand } from "@/modules/platform/brand";

const description = "Meet NegOSu Pet Care, grooming software for pet and owner records, appointments, groomers, payments, and pickup.";
export const metadata: Metadata = {
 title: { absolute: "NegOSu Pet Care | Pet Grooming Software" }, description,
 alternates: { canonical: petCareBrand.path },
 openGraph: { title: "NegOSu Pet Care | Pet Grooming Software", description, url: petCareBrand.path },
};
const features = [
 {icon:PawPrint,title:"Pets and their owners",description:"Keep each pet’s profile, grooming preferences, and visit history connected to its primary owner."},
 {icon:CalendarDays,title:"Grooming appointments",description:"Book one pet per appointment, with availability checks for the pet, groomer, and resource."},
 {icon:Users,title:"Your grooming team",description:"Assign groomers with or without a system account. Staff contact details are optional."},
 {icon:Armchair,title:"Tables and resources",description:"Reserve grooming tables, stations, and rooms within their configured capacity."},
 {icon:Scissors,title:"Services and prices",description:"Set grooming services, duration, and prices, with service details retained in visit history."},
 {icon:CreditCard,title:"Appointment payments",description:"Record partial or full payments and see the remaining balance alongside the visit."},
 {icon:HeartHandshake,title:"Ready for pickup",description:"Track grooming finished, ready for pickup, and collected as separate steps."},
 {icon:ShieldCheck,title:"Private customer links",description:"Let owners confirm or reschedule through a private appointment link. Handling notes stay internal."},
 {icon:CalendarDays,title:"Online booking requests",description:"Let owners request grooming through your branded page. Review the pet and assign available staff before confirming."},
 {icon:Scissors,title:"Grooming visit notes",description:"Keep an internal care record for each visit, including the result, handling observations, and recommended return date."},
] as const;
function GroomingPreview() {
 return <div className="rounded-ui-lg border border-slate-200 bg-white p-3 shadow-ui-md sm:p-4"><div className="rounded-xl border border-slate-200 bg-slate-50"><div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4"><div><p className="text-xs text-brand-primary-strong">EXAMPLE GROOMING DAY</p><p className="mt-1">Milo Grooming Studio</p></div><PawPrint aria-hidden="true" size={24}/></div><div className="space-y-3 p-4">{[["Milo · Shih Tzu","Owner: Maria","Full grooming · Ana · Table 1","Grooming in progress"],["Luna · Cat","Owner: Alex","Bath and brush · Bo · Table 2","Ready for pickup"]].map(([pet,owner,service,status])=><article key={pet} className="rounded-xl border border-slate-200 bg-white p-4"><h2>{pet}</h2><p className="mt-1 text-sm text-slate-600">{owner}</p><p className="mt-2 text-sm text-slate-600">{service}</p><p className="mt-3 inline-flex rounded-full border border-brand-border bg-brand-tint px-3 py-1 text-xs">{status}</p></article>)}<p className="text-xs leading-5 text-slate-500">Illustrative records. Payment and collection are tracked separately.</p></div></div></div>;
}
export default function PetCarePage() {
 return <main id="negosu-pet-care-page" className="min-h-screen bg-white text-brand-ink [&_h1]:font-normal [&_h2]:font-normal [&_h3]:font-normal [&_a]:font-normal">
  <MarketingHeader vertical="pet_care"/>
  <MarketingHero vertical="pet_care" eyebrow="NegOSu Pet Care · Pet Grooming" title="Care for the pets. Keep the day organized." description="Connect pets, owners, grooming appointments, your team, payments, and pickup in one workspace. Start with a free account." visual={<GroomingPreview/>}/>
  <FeatureSection vertical="pet_care" heading="A clear view of every grooming visit." description="Built for appointment-based grooming, with your business identity at the center." features={features}/>
  <HowItWorks vertical="pet_care" steps={["Create your account, then set up your branch, grooming services, team, and resources.","Add the owner and pet, then book a grooming appointment with available staff and space.","Track grooming progress, record payment, mark ready for pickup, and record collection."]}/>
  <section id="pet-care-get-started" className="mx-auto max-w-7xl px-4 py-12 sm:px-6"><div className="rounded-ui-lg border border-brand-border bg-brand-tint p-5 sm:p-8"><h2 className="text-3xl">Start your pet grooming workspace.</h2><p className="mt-3 max-w-3xl leading-7 text-slate-600">Create your business, add your services and team, and start managing grooming visits. Publish a branded booking page when your plan includes public pages.</p><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">Designed for pet grooming operations. Notification delivery depends on the business’s plan, customer preferences, and configured channels.</p><div className="mt-6 flex flex-wrap gap-3"><Link id="negosu-pet-care-create-account-button" href={petCareBrand.signupPath} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-3 text-white"><ArrowRight aria-hidden="true" size={18}/>Create free account</Link><Link id="negosu-pet-care-sign-in-link" href={petCareBrand.loginPath} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-brand-border bg-white px-4 py-3"><Users aria-hidden="true" size={18}/>Sign in</Link></div></div></section>
  <MarketingFooter vertical="pet_care"/>
 </main>;
}
