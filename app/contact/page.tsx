import Link from "next/link";
import { X } from "lucide-react";
import { MarketingHeader, MarketingFooter } from "@/components/marketing/product-landing";
import { ContactForm } from "@/components/marketing/contact-form";

export const metadata = { title: "Contact Us | NegOSu", description: "Contact the NegOSu team with questions about our business applications." };
export default function ContactPage() {
  return <main id="negosu-contact-page" className="min-h-screen bg-white text-brand-ink">
    <MarketingHeader/>
    <section className="mx-auto max-w-xl px-4 py-10 sm:py-14"><div className="flex items-center justify-between gap-4"><h1 className="text-3xl font-medium">Contact us</h1><Link id="contact-close-button" href="/" aria-label="Close and return to home" title="Back to home" className="grid size-11 shrink-0 place-items-center rounded-xl text-zinc-500 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"><X size={20} aria-hidden="true"/></Link></div><p className="mb-7 mt-3 text-zinc-600">Have a question about NegOSu? Send an inquiry to our team.</p><ContactForm/></section>
    <MarketingFooter/>
  </main>;
}
