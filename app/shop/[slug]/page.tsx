import { PublicWebsiteEffects } from "@/components/public-website-effects";
import { PublicProductCards } from "@/components/public-product-cards";
import { PublicShopHeader, PublicShopMobileNavigation } from "@/components/public-shop-navigation";
import { loadPublicPromos } from "@/lib/public-promos.runtime";
import { PublicPromoCards } from "@/components/public-promo-cards";
import { PublicServiceCategories } from "@/components/public-service-categories";
import { PublicChat } from "@/components/public-chat";
import { PublicContact } from "@/components/public-contact";
import { LocationMap } from "@/components/location-map";
import { ArrowRight as ArrowRightIcon, Plus as PlusIcon, ArrowRight, MapPin, Phone, Mail } from "lucide-react";

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PoweredBy } from "@/components/powered-by";
import { businessMetadata } from "@/modules/platform/business-branding";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { publicOpeningDayKeys } from "@/lib/public-booking";
import type { PublicShop } from "@/lib/public-booking";
import { loadPublicBusiness } from "@/lib/public-business";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const publicShop = await loadPublicBusiness(slug);
  if (!publicShop) return { title: "Business not found" };
  const description = publicShop.description ?? `Book ${publicShop.industry === "hospitality" ? "a stay" : publicShop.industry === "pet_care" ? "pet grooming" : publicShop.industry === "salon" ? "salon treatments" : "automotive services"} with ${publicShop.name}.`;
  return {
    ...businessMetadata(publicShop.name, publicShop.logoUrl),
    description,
    alternates: { canonical: `/shop/${slug}` },
    openGraph: { title: publicShop.name, siteName: publicShop.name, description, images: publicShop.coverUrl ? [publicShop.coverUrl] : undefined, type: "website" },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const publicShop = await loadPublicBusiness(slug);
  if (!publicShop) notFound();
  const industry = publicShop.industry ?? "automotive";
  const hospitality = industry === "hospitality";
  const serviceLabel = industry === "salon" ? "treatment" : "service";
  const primaryBranch = publicShop.branches.find(branch => branch.acceptsBookings) ?? publicShop.branches[0];
  const bookingAvailable = !hospitality && publicShop.services.length > 0 && publicShop.branches.some(branch=>branch.acceptsBookings);
  const {promos}=hospitality ? { promos: [] } : await loadPublicPromos(slug);
  const products = publicShop.products ?? [];
  const navigation = { hospitality, industry, hasProducts: products.length > 0, hasPromos: promos.length > 0, hasGallery: publicShop.gallery.length > 0 };
  const bookingHref = `/shop/${encodeURIComponent(slug)}/book`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": hospitality ? "LodgingBusiness" : industry === "pet_care" ? "LocalBusiness" : industry === "salon" ? "BeautySalon" : "AutomotiveBusiness",
    name: publicShop.name,
    description: publicShop.description,
    telephone: publicShop.phone,
    url: `/shop/${slug}`,
    image: [publicShop.logoUrl, publicShop.coverUrl].filter(Boolean),
    address: publicShop.branches[0]?.address.filter(Boolean).join(", "),
  };

  return <main id={hospitality ? "public-hospitality-shop-page" : industry === "pet_care" ? "public-pet-care-shop-page" : industry === "salon" ? "public-salon-shop-page" : "public-automotive-shop-page"} className="min-h-dvh min-w-0 bg-admin-canvas text-admin-text [overflow-wrap:anywhere] [--public-header-offset:6rem] sm:[--public-header-offset:9rem] lg:[--public-header-offset:6rem] [&_[id]]:scroll-mt-[var(--public-header-offset)]">
    <PublicWebsiteEffects/>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replaceAll("<", "\\u003c") }} />

    <a id="public-shop-skip-link" href={hospitality ? "#public-automotive-shop-branches" : "#public-automotive-shop-services"} className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-white focus:p-3">{hospitality ? "Skip to locations" : "Skip to services"}</a>
    <PublicShopHeader {...navigation} name={publicShop.name} logoUrl={publicShop.logoUrl} slug={slug} bookingAvailable={bookingAvailable}/>

    <section data-public-reveal id="public-automotive-shop-hero" className="overflow-hidden bg-white">
      <div className="mx-auto grid max-w-6xl items-center gap-6 px-4 py-7 sm:gap-8 sm:px-6 sm:py-12 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.9fr)] lg:py-16">
        <div>
          <p className="text-sm font-medium text-brand-primary-strong">{hospitality ? "Apartelle & Inn" : industry === "pet_care" ? "Pet grooming" : industry === "salon" ? "Salon & beauty" : "Automotive care"}</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-medium tracking-tight text-brand-ink sm:text-5xl lg:text-6xl">{publicShop.name}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 sm:text-lg sm:leading-8 text-admin-text-secondary">{publicShop.description ?? (hospitality ? "Plan your stay with us. Contact our property for room rates and availability." : industry === "pet_care" ? "Thoughtful pet grooming with a simple online booking experience." : industry === "salon" ? "Professional salon care with a simple online booking experience." : "Professional vehicle care with a simple online booking experience.")}</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap"><Button id="public-automotive-shop-book-button" asChild size="lg"><Link href={bookingAvailable?bookingHref:"#public-automotive-shop-branches"}>{bookingAvailable?"View available dates":"Find a location"}<ArrowRight aria-hidden="true" size={18}/></Link></Button>{products.length ? <Button id="public-shop-browse-products" asChild variant="secondary" size="lg"><a href="#public-shop-products">Browse products</a></Button> : null}</div>
          <div id="public-shop-quick-details" className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm text-admin-text-secondary">{primaryBranch ? <a id="public-shop-quick-location" href="#public-automotive-shop-branches" className="inline-flex min-w-0 items-center gap-2"><MapPin aria-hidden="true" className="text-brand-primary" size={17}/>{primaryBranch.name}</a> : null}{publicShop.phone ? <a className="inline-flex items-center gap-2 hover:text-brand-primary-strong" href={`tel:${publicShop.phone.replace(/[^\d+]/g, "")}`}><Phone aria-hidden="true" className="text-brand-primary" size={17}/>{publicShop.phone}</a> : null}</div>
        </div>
        <div id="public-shop-hero-media" className="relative min-h-52 overflow-hidden rounded-ui-lg border border-admin-border bg-brand-ink shadow-ui-md sm:min-h-96">
          {publicShop.coverUrl ? <Image src={publicShop.coverUrl} alt={`${publicShop.name} business`} fill unoptimized sizes="(min-width: 1024px) 45vw, 100vw" className="object-cover"/> : <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_top_right,var(--brand-primary),transparent_55%)] p-5 sm:p-10"><div className="rounded-ui-lg border border-white/15 bg-white/10 p-6 text-white backdrop-blur-sm"><p className="text-sm text-blue-100">Welcome to</p><p className="mt-2 text-3xl font-medium">{publicShop.name}</p></div></div>}
        </div>
      </div>
    </section>

    <div data-public-sections className="mx-auto min-w-0 max-w-6xl space-y-10 px-4 py-9 sm:space-y-14 sm:px-6 sm:py-14">
      <PublicPromoCards slug={slug} promos={promos} branches={publicShop.branches} services={publicShop.services}/>
      {!hospitality ? <section id="public-automotive-shop-services" className="scroll-mt-[calc(6rem+env(safe-area-inset-top))] sm:scroll-mt-5" aria-labelledby="public-shop-services-title">
        <div className="flex flex-wrap items-center justify-between gap-4 min-w-0 [&>a]:ml-auto [&>button]:ml-auto [&>form]:ml-auto"><div className="min-w-0 flex-1 basis-full sm:basis-64 [overflow-wrap:anywhere]"><p className="text-sm font-medium text-brand-primary-strong">What we offer</p><h2 id="public-shop-services-title" className="mt-1 text-3xl font-medium tracking-tight text-brand-ink">{industry === "salon" ? "Treatments" : "Services"}</h2></div>{publicShop.services.length ? <Button id="public-shop-services-book-button" className="ml-auto" asChild variant="secondary"><Link href={bookingHref}><ArrowRightIcon aria-hidden="true" size={16} className="shrink-0"/>Check availability</Link></Button> : null}</div>
        {publicShop.services.length ? <PublicServiceCategories services={publicShop.services} shopName={publicShop.name} currency={publicShop.currency} bookingHref={bookingHref} serviceLabel={serviceLabel}/> : <Card id="public-shop-services-empty-state" elevation="none" className="mt-6 p-6 text-center"><h3 className="font-medium">Services will be available soon</h3><p className="mt-2 text-sm text-admin-text-secondary">Contact {publicShop.name} directly for current offerings.</p></Card>}
      </section> : null}

      <PublicProductCards products={products} slug={publicShop.slug}/>
      <section id="public-automotive-shop-branches" className="scroll-mt-[calc(6rem+env(safe-area-inset-top))] sm:scroll-mt-5" aria-labelledby="public-shop-locations-title">
        <div><p className="text-sm font-medium text-brand-primary-strong">Visit us</p><h2 id="public-shop-locations-title" className="mt-1 text-3xl font-medium tracking-tight text-brand-ink">Locations</h2></div>
        {publicShop.branches.length ? <div className="mt-6 grid gap-4 lg:grid-cols-2">{publicShop.branches.map(branch => {
          const address = branch.address.filter(Boolean).join(", ");
          return <Card id={`public-automotive-shop-branch-${branch.id}`} elevation="none" className="min-w-0 p-4 sm:p-6" key={branch.id}>
            <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="min-w-0 text-xl font-medium text-brand-ink">{branch.name}</h3>{branch.acceptsBookings&&bookingAvailable?<span className="rounded-full bg-status-success-tint px-2.5 py-1 text-xs font-medium text-status-success">Online booking</span>:null}</div>
            <p className="mt-3 flex items-start gap-2 text-sm leading-6 text-admin-text-secondary"><MapPin aria-hidden="true" className="mt-1 shrink-0 text-brand-primary" size={16}/><span>{address||"Contact the business for directions."}</span></p>
            {branch.description?<p className="mt-3 text-sm leading-6 text-admin-text-secondary">{branch.description}</p>:null}
            <div className="mt-4"><LocationMap id={`public-location-map-${branch.id}`} name={branch.name} address={branch.address} mapUrl={branch.mapUrl}/></div>
            <Hours hours={branch.hours}/>
            <div className="mt-4 flex flex-wrap items-center gap-2">{branch.phone?<Button asChild variant="secondary" size="sm"><a id={`public-location-call-${branch.id}`} href={`tel:${branch.phone.replace(/[^\d+]/g,"")}`}><Phone size={16} aria-hidden="true"/>Call location</a></Button>:null}{branch.acceptsBookings&&bookingAvailable?<Button id={`public-shop-branch-book-${branch.id}`} asChild size="sm"><Link href={`${bookingHref}?branch=${encodeURIComponent(branch.id)}`}><PlusIcon size={16} aria-hidden="true"/>Book at this location</Link></Button>:null}</div>
          </Card>;
        })}</div> : <Card id="public-shop-locations-empty-state" elevation="none" className="mt-6 p-6 text-center"><h3 className="font-medium">Location details are coming soon</h3><p className="mt-2 text-sm text-admin-text-secondary">Contact {publicShop.name} directly for directions and opening hours.</p></Card>}
      </section>

      {publicShop.gallery.length > 0 ? <section id="public-automotive-shop-gallery" className="scroll-mt-[calc(6rem+env(safe-area-inset-top))] sm:scroll-mt-5" aria-labelledby="public-shop-gallery-title"><div><p className="text-sm font-medium text-brand-primary-strong">Inside our business</p><h2 id="public-shop-gallery-title" className="mt-1 text-3xl font-medium tracking-tight text-brand-ink">Gallery</h2></div><div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">{publicShop.gallery.map((image, index) => <Image id={`public-shop-gallery-image-${index}`} className={`w-full rounded-ui-lg object-cover ${index === 0 ? "col-span-2 aspect-[2/1] md:col-span-2" : "aspect-square md:aspect-[4/3]"}`} src={image.url} alt={image.alt} width={800} height={600} unoptimized key={`${image.url}-${index}`}/>)}</div></section> : null}
      <PublicContact shop={publicShop}/>
    </div>

    <footer id="public-automotive-shop-footer" className="border-t border-admin-border bg-white pb-24 sm:pb-0">
      <div className="mx-auto grid max-w-6xl gap-7 px-4 py-9 sm:px-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end"><div><p className="font-medium">{publicShop.name}</p><PoweredBy id="public-shop-powered-by" className="mt-2"/><div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-admin-text-secondary">{publicShop.phone?<a id="public-shop-call-link" className="inline-flex min-h-11 items-center gap-2" href={`tel:${publicShop.phone.replace(/[^\d+]/g,"")}`}><Phone size={16} aria-hidden="true"/>{publicShop.phone}</a>:null}{publicShop.email?<a id="public-shop-email-link" className="inline-flex min-h-11 min-w-0 items-center gap-2" href={`mailto:${publicShop.email}`}><Mail size={16} className="shrink-0" aria-hidden="true"/>{publicShop.email}</a>:null}</div></div><nav id="public-shop-social-links" className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-brand-primary-strong" aria-label={`${publicShop.name} links`}>{publicShop.website ? <a href={publicShop.website} target="_blank" rel="noopener noreferrer">Website</a> : null}{publicShop.facebook ? <a href={publicShop.facebook} target="_blank" rel="noopener noreferrer">Facebook</a> : null}{publicShop.instagram ? <a href={publicShop.instagram} target="_blank" rel="noopener noreferrer">Instagram</a> : null}</nav></div>
    </footer>
    <PublicShopMobileNavigation {...navigation}/>
    {!hospitality ? <PublicChat key={publicShop.slug} shop={publicShop}/> : null}
  </main>;
}

function Hours({ hours }: { hours: PublicShop["branches"][number]["hours"] }) {
  const entries = publicOpeningDayKeys.flatMap(day=>hours?.[day]&&typeof hours[day]==="object"?[[day,hours[day]] as const]:[]);
  if (!entries.length) return null;
  return <details className="mt-4 rounded-ui-md border border-admin-border bg-admin-surface-muted px-3 py-2"><summary className="min-h-11 cursor-pointer content-center text-sm font-medium text-admin-text">Opening hours</summary><dl className="mt-3 grid grid-cols-[minmax(6rem,1fr)_auto] gap-x-4 gap-y-1.5 text-sm">{entries.map(([day, value]) => <div className="contents" key={day}><dt className="capitalize text-admin-text-muted">{day}</dt><dd className="text-right font-medium">{value.closed||!value.open||!value.close ? "Closed" : `${value.open}–${value.close}`}</dd></div>)}</dl></details>;
}
