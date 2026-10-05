import React from "react";
import { createRoot } from "react-dom/client";
import { PublicWebsiteEffects } from "@/components/public-website-effects";
import { PublicShopHeader, PublicShopMobileNavigation } from "@/components/public-shop-navigation";
const minimal = new URLSearchParams(location.search).has("minimal");
const props = { hospitality: minimal, industry: minimal ? "hospitality" : "salon", hasProducts: !minimal, hasPromos: !minimal, hasGallery: !minimal };
document.getElementById("root")!.className = "min-w-0 [&_[id]]:scroll-mt-[var(--public-header-offset,6rem)]";
createRoot(document.getElementById("root")!).render(<><PublicWebsiteEffects/><PublicShopHeader {...props} name="The Very Long Business Name Beauty and Wellness Studio" slug="test-shop" bookingAvailable={!minimal}/><section data-public-reveal id="fixture-hero" className="min-h-[110vh] p-6">Business introduction</section><div data-public-sections>{["public-automotive-shop-services", "public-shop-products", "public-shop-promos", "public-automotive-shop-branches", "public-shop-contact", "public-automotive-shop-gallery"].map(id => <section key={id} id={id} className="min-h-[80vh] p-6"><h2>{id}</h2></section>)}</div><PublicShopMobileNavigation {...props}/></>);
