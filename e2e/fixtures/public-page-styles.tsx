import React from "react";
import { createRoot } from "react-dom/client";
import { PublicPageStyleForm } from "@/components/public-page-style-form";
import { PublicStyledHero, PublicVisitGuide, PublicClosingBanner, PublicStyledFooter } from "@/components/public-page-presentation";
import { PublicShopHeader, PublicShopMobileNavigation } from "@/components/public-shop-navigation";
import { PublicServiceCategories } from "@/components/public-service-categories";
import { PublicProductCards } from "@/components/public-product-cards";
import { PublicPromoCards } from "@/components/public-promo-cards";
import { PublicContact } from "@/components/public-contact";
import { publicPageStylesForIndustry, publicPageAppearanceSchema } from "@/modules/platform/public-page-style";
import type { PublicShop } from "@/lib/public-booking";

const query = new URLSearchParams(location.search);
const industry = (query.get("industry") || "salon") as PublicShop["industry"];
const style = publicPageStylesForIndustry(industry)[1].id;
const hospitality = industry === "hospitality";
const rootElement = document.getElementById("root")!;
rootElement.className = query.has("admin") ? "mx-auto max-w-5xl p-4" : "";
const root = createRoot(rootElement);
const services = Array.from({ length: 5 }, (_, i) => ({ id: `service-${i}`, name: `Service ${i}`, description: "Choose a service and explore available dates.", durationMinutes: 30, priceCentavos: 10000, category: "Care" }));
const products = Array.from({ length: 5 }, (_, i) => ({ id: `product-${i}`, name: `Product ${i}`, description: "Available to order.", category: "Essentials", priceCentavos: 10000, currency: "PHP", branchId: "main", branchName: "Main", unit: "piece" }));
const promos = Array.from({ length: 5 }, (_, i) => ({ id: `promo-${i}`, name: `Promo ${i}`, branchId: "main", serviceId: "service-0", description: "Special offer", imageUrl: null, version: 1, priceCentavos: 15000, currency: "PHP", durationMinutes: 30, validFrom: null, validThrough: null, inclusions: [] }));
const shop: PublicShop = { name: "A welcoming business with a longer name", slug: "example", industry, pageStyle: style, theme: "crimson", description: "Welcome to our business.", logoUrl: "https://images.test/logo.svg", coverUrl: query.has("photo") ? "https://images.test/cover.svg" : null, phone: null, email: null, website: null, facebook: null, instagram: null, services, products, branches: [], gallery: [] };
const nav = { industry, hospitality, hasProducts: true, hasPromos: !hospitality, hasGallery: false };
function renderAdmin(preference: typeof style = "standard", hero = { headline: "", eyebrow: "", description: "", position: "center" }) {
  root.render(<div data-dashboard-theme="blue"><PublicPageStyleForm key={JSON.stringify([preference, hero])} industry={industry} name={shop.name} theme="crimson" coverUrl={shop.coverUrl} preference={preference} hero={hero}/></div>);
}
Object.assign(window, { recordFormAction: async (_action: string, entries: [string, string][]) => {
  const parsed = publicPageAppearanceSchema.parse(Object.fromEntries(entries));
  document.body.dataset.savedStyle = parsed.pageStyle;
  await new Promise(resolve => setTimeout(resolve, 250));
  renderAdmin(parsed.pageStyle, parsed);
} });
if (query.has("admin")) renderAdmin();
else root.render(<div data-public-theme="crimson"><main className="public-designed-page min-w-0 [overflow-wrap:anywhere]" data-public-style={style}>
  <PublicShopHeader {...nav} name={shop.name} logoUrl={shop.logoUrl} slug={shop.slug} bookingAvailable={!hospitality} styled/>
  <PublicStyledHero name={shop.name} industry={industry} slug={shop.slug} coverUrl={shop.coverUrl} bookingAvailable={!hospitality}/>
  <div className="mx-auto max-w-6xl space-y-12 px-4 py-10">
    {!hospitality ? <><PublicPromoCards promos={promos} slug={shop.slug} branches={[{ id: "main", name: "Main" }]} services={services}/><section id="public-automotive-shop-services"><h2 className="text-3xl">Services</h2><PublicServiceCategories services={services} shopName={shop.name} bookingHref="/shop/example/book" serviceLabel="service"/></section></> : null}
    <PublicProductCards products={products} slug={shop.slug}/>
    <section id="public-automotive-shop-branches"><h2 className="text-3xl">Locations</h2><p>Visit our main location.</p></section>
    <PublicVisitGuide industry={industry} bookingAvailable={!hospitality}/><PublicContact shop={shop}/><PublicClosingBanner industry={industry} slug={shop.slug} bookingAvailable={!hospitality}/>
  </div>
  <PublicStyledFooter shop={shop} hasPromos={!hospitality}/><PublicShopMobileNavigation {...nav}/>
</main></div>);
