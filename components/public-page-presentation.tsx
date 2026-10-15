import { PublicHeroMedia } from "@/components/public-hero-media";
import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { publicPageStyleContent, type PublicHero } from "@/modules/platform/public-page-style";
import { BusinessIdentity } from "@/components/business-identity";
import { PoweredBy } from "@/components/powered-by";
import { safeMapLink } from "@/lib/location-map";
import type { PublicShop } from "@/lib/public-booking";

export function PublicStyledHero({ name, industry, hero, coverUrl, bookingAvailable, slug, preview = false }: {
  name: string; industry: string; hero?: PublicHero; coverUrl: string | null; bookingAvailable: boolean; slug: string; preview?: boolean;
}) {
  const content = publicPageStyleContent(industry);
  const action = industry === "hospitality" ? content.action : bookingAvailable ? content.action : "Contact us";
  const href = industry !== "hospitality" && bookingAvailable ? `/shop/${encodeURIComponent(slug)}/book` : "#public-shop-contact";
  return <section id={preview ? "public-style-preview-hero" : "public-automotive-shop-hero"} className="public-style-hero">
    <PublicHeroMedia name={name} coverUrl={coverUrl} position={hero?.position} preview={preview}/>
    <div className="public-style-hero-shade"/>
    <div className="public-style-hero-inner">
      <div className="public-style-hero-copy">
        <p className="public-style-eyebrow">{hero?.eyebrow?.trim() || content.eyebrow}</p>
        <h1>{hero?.headline?.trim() || content.headline}</h1>
        <p className="public-style-hero-description">{hero?.description?.trim() || content.description}</p>
        <div className="public-style-hero-actions">
          {preview ? <><span className="public-style-primary-link">{action}<ArrowRight size={18}/></span><span className="public-style-secondary-link">{industry === "hospitality" ? "Explore our locations" : "Explore our services"}</span></> : <>
            <Link id="public-automotive-shop-book-button" className="public-style-primary-link" href={href}>{action}<ArrowRight aria-hidden="true" size={18}/></Link>
            <a id="public-shop-hero-explore" className="public-style-secondary-link" href={industry === "hospitality" ? "#public-automotive-shop-branches" : "#public-automotive-shop-services"}>{industry === "hospitality" ? "Explore our locations" : "Explore our services"}</a>
          </>}
        </div>
        <p className="public-style-hero-note">{industry === "hospitality" ? "Room rates and availability are confirmed by the property." : "Appointment requests are subject to confirmation."}</p>
      </div>
    </div>
  </section>;
}

export function PublicVisitGuide({ industry, bookingAvailable }: { industry: string; bookingAvailable: boolean }) {
  const hospitality = industry === "hospitality";
  const steps = hospitality ? [
    ["Explore the property", "Browse our photos, locations and contact details."],
    ["Tell us about your stay", "Contact the property with your dates and guest count."],
    ["Confirm the details", "The property will confirm room availability, rates and arrangements."],
  ] : bookingAvailable ? [
    [industry === "pet_care" ? "Choose grooming" : industry === "salon" ? "Choose treatments" : "Choose services", "Select your location and the services you need."],
    ["Pick a time", "Choose an available date and time for your request."],
    ["Send your request", "Share your contact details and review before submitting."],
    ["Wait for confirmation", "Follow your request status while the business confirms your appointment."],
  ] : [
    ["Explore our offerings", "Browse services and locations to plan your visit."],
    ["Contact the business", "Ask your preferred location about availability."],
    ["Confirm your visit", "Agree on the details with the business before arriving."],
  ];
  return <section id="public-shop-visit-guide" aria-labelledby="public-shop-visit-guide-title" className="public-style-visit-guide">
    <p className="public-style-eyebrow">Plan your visit</p><h2 id="public-shop-visit-guide-title" className="text-3xl text-brand-ink">{hospitality ? "Make yourself at home" : bookingAvailable ? "How booking works" : "Let’s plan your visit"}</h2>
    <ol className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{steps.map(([title, description], index) => <li key={title} className="min-w-0 border-t border-brand-border pt-4"><span className="mb-3 grid size-10 place-items-center rounded-full border border-brand-border text-brand-primary-strong">{index + 1}</span><h3 className="text-lg text-brand-ink">{title}</h3><p className="mt-2 text-sm leading-6 text-admin-text-secondary">{description}</p></li>)}</ol>
  </section>;
}

export function PublicClosingBanner({ industry, slug, bookingAvailable }: { industry: string; slug: string; bookingAvailable: boolean }) {
  const content = publicPageStyleContent(industry);
  return <section id="public-shop-closing-banner" className="public-style-closing">
    <div><p className="public-style-eyebrow">{industry === "hospitality" ? "Your next stay" : "Your next visit"}</p><h2>{content.closing}</h2><p className="mt-3 text-sm leading-6">{industry === "hospitality" ? "Contact the property for rates and availability." : bookingAvailable ? "Send a request and the business will confirm your appointment." : "Contact your preferred location to arrange a visit."}</p></div>
    <Link id="public-shop-closing-action" className="public-style-closing-link" href={industry !== "hospitality" && bookingAvailable ? `/shop/${encodeURIComponent(slug)}/book` : "#public-shop-contact"}>{industry === "hospitality" ? content.action : bookingAvailable ? content.action : "Contact us"}<ArrowRight size={18} aria-hidden="true"/></Link>
  </section>;
}

export function PublicStyledFooter({ shop, hasPromos }: { shop: PublicShop; hasPromos: boolean }) {
  const links = [
    ...(shop.industry !== "hospitality" ? [{ name: "Services", href: "#public-automotive-shop-services" }] : []),
    ...(shop.products?.length ? [{ name: "Products", href: "#public-shop-products" }] : []),
    ...(hasPromos ? [{ name: "Promos", href: "#public-shop-promos" }] : []),
    { name: "Locations", href: "#public-automotive-shop-branches" }, { name: "Contact", href: "#public-shop-contact" },
  ];
  return <footer id="public-automotive-shop-footer" className="public-style-footer">
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[2fr_1fr_1fr]">
      <div className="min-w-0"><BusinessIdentity name={shop.name} logoUrl={shop.logoUrl} inverse wordmark/><p className="mt-4 max-w-md text-sm leading-6">{shop.description || publicPageStyleContent(shop.industry).description}</p><PoweredBy inverse className="mt-5"/></div>
      <nav aria-label="Explore the business"><p className="public-style-eyebrow">Explore</p><div className="mt-3 flex flex-col items-start">{links.map(link => <a key={link.name} id={`public-footer-${link.name.toLowerCase()}`} href={link.href} className="inline-flex min-h-11 items-center text-sm hover:underline">{link.name}</a>)}</div></nav>
      <div><p className="public-style-eyebrow">Connect</p><div className="mt-3 flex flex-col items-start gap-1 text-sm">
        {shop.phone ? <a id="public-shop-call-link" className="inline-flex min-h-11 items-center" href={`tel:${shop.phone.replace(/[^\d+]/g, "")}`}>{shop.phone}</a> : null}
        {shop.email ? <a id="public-shop-email-link" className="inline-flex min-h-11 items-center break-all" href={`mailto:${encodeURIComponent(shop.email)}`}>{shop.email}</a> : null}
        {[{ label: "Website", url: shop.website }, { label: "Facebook", url: shop.facebook }, { label: "Instagram", url: shop.instagram }].map(item => { const href = safeMapLink(item.url); return href ? <a key={item.label} id={`public-footer-${item.label.toLowerCase()}`} className="inline-flex min-h-11 items-center" href={href} target="_blank" rel="noopener noreferrer">{item.label}</a> : null; })}
        <a id="public-footer-find-location" href="#public-automotive-shop-branches" className="inline-flex min-h-11 items-center gap-2"><MapPin size={16} aria-hidden="true"/>Find a location</a>
      </div></div>
    </div>
  </footer>;
}
