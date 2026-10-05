import Link from "next/link";
import { CalendarDays, Images, List, MapPin, Phone, ShoppingBag, Tag } from "lucide-react";
import { BusinessIdentity } from "@/components/business-identity";
import { Button } from "@/components/ui/button";

type NavigationProps = {
  hospitality: boolean;
  industry: string;
  hasProducts: boolean;
  hasPromos: boolean;
  hasGallery: boolean;
};

function sectionLinks({ hospitality, industry, hasProducts, hasPromos, hasGallery }: NavigationProps) {
  return [
    ...(!hospitality ? [{ key: "services", mobileKey: "services", label: industry === "salon" ? "Treatments" : "Services", href: "#public-automotive-shop-services", Icon: List }] : []),
    ...(hasProducts ? [{ key: "products", mobileKey: "products", label: "Products", href: "#public-shop-products", Icon: ShoppingBag }] : []),
    ...(hasPromos ? [{ key: "promos", mobileKey: "promos", label: "Promos", href: "#public-shop-promos", Icon: Tag }] : []),
    { key: "locations", mobileKey: "location", label: "Locations", href: "#public-automotive-shop-branches", Icon: MapPin },
    { key: "contact", mobileKey: "contact", label: "Contact", href: "#public-shop-contact", Icon: Phone },
    ...(hasGallery ? [{ key: "gallery", mobileKey: "gallery", label: "Gallery", href: "#public-automotive-shop-gallery", Icon: Images }] : []),
  ];
}

export function PublicShopHeader({ name, logoUrl, slug, bookingAvailable, ...navigation }: NavigationProps & {
  name: string;
  logoUrl?: string | null;
  slug: string;
  bookingAvailable: boolean;
}) {
  return <header id="public-shop-header" className="sticky top-0 z-40 border-b border-admin-border bg-white pt-[env(safe-area-inset-top)] shadow-none transition-shadow duration-200 data-[scrolled=true]:shadow-[0_4px_16px_-8px_rgba(15,23,42,0.22)] motion-reduce:transition-none sm:pt-0">
    <div className="mx-auto grid min-h-18 max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 gap-y-1 px-4 py-2 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
      <Link id="public-shop-home-link" href={`/shop/${encodeURIComponent(slug)}`} className="flex min-w-0 items-center" aria-label={`${name} home`}>
        <BusinessIdentity name={name} logoUrl={logoUrl}/>
      </Link>
      <nav id="public-shop-section-navigation" aria-label="Website sections" className="col-span-2 row-start-2 hidden items-center justify-center gap-1 border-t border-admin-border pt-1 text-sm font-medium sm:flex lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:border-0 lg:pt-0">
        {sectionLinks(navigation).map(({ key, label, href }) => <a key={key} id={`public-shop-${key}-nav`} href={href} className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-ui-md px-2 hover:bg-brand-tint hover:text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary">{label}</a>)}
      </nav>
      <div className="col-start-2 row-start-1 shrink-0 lg:col-start-3">
        <Button id="public-shop-header-book-button" asChild size="sm"><Link href={bookingAvailable ? `/shop/${encodeURIComponent(slug)}/book` : "#public-automotive-shop-branches"}><CalendarDays aria-hidden="true" size={16} className="shrink-0"/>{bookingAvailable ? "Book now" : "Visit us"}</Link></Button>
      </div>
    </div>
  </header>;
}

export function PublicShopMobileNavigation(props: NavigationProps) {
  return <nav id="public-shop-mobile-actions" aria-label="Website menu" className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-admin-border bg-white px-1 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] shadow-ui-md sm:hidden">
    {sectionLinks(props).map(({ key, mobileKey, label, href, Icon }) => <a key={key} id={`public-mobile-${mobileKey}-button`} href={href} className="flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-ui-md px-1 text-[10px] font-medium text-admin-text-secondary focus-visible:ring-2 focus-visible:ring-brand-primary"><Icon size={20} aria-hidden="true"/>{label}</a>)}
  </nav>;
}
