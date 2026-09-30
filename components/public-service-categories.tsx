import Link from "next/link";
import { ArrowRight, Clock3 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PublicCardRow } from "@/components/public-card-row";
import { ServiceThumbnail } from "@/components/service-thumbnail";
import { formatMoney } from "@/lib/operations";
import type { PublicService } from "@/lib/public-booking";

export function PublicServiceCategories({ services, shopName, currency, bookingHref, serviceLabel }: { services: PublicService[]; shopName: string; currency?: string; bookingHref: string; serviceLabel: string }) {
  const groups = new Map<string | null, PublicService[]>();
  for (const service of services) {
    const category = service.category?.trim() || null;
    groups.set(category, [...(groups.get(category) ?? []), service]);
  }
  return <div className="mt-6 min-w-0 space-y-8">{[...groups].map(([category, items]) => {
    const label = category ?? (serviceLabel === "treatment" ? "Other treatments" : "Other services");
    const id = `public-shop-category-${category === null ? "uncategorized" : `named-${encodeURIComponent(category)}`}`;
    return <section key={id} aria-labelledby={`${id}-title`} className="min-w-0">
      <h3 id={`${id}-title`} className="mb-2 text-xl font-medium text-brand-ink">{label} <span className="text-sm font-normal text-admin-text-secondary">({items.length})</span></h3>
      <PublicCardRow id={`${id}-row`} label={label}>{items.map(service => <Card id={`public-automotive-shop-service-${service.id}`} elevation="none" interactive className="flex min-w-0 flex-col p-4 sm:p-5" key={service.id}><div className="mb-4"><ServiceThumbnail id={`public-service-thumbnail-${service.id}`} url={service.thumbnailUrl} name={service.name}/></div><p className="text-xs font-medium normal-case tracking-wide text-brand-primary-strong">{service.category || (serviceLabel === "treatment" ? "Treatment" : "Service")}</p><h4 className="mt-2 text-xl font-medium text-brand-ink">{service.name}</h4><p className="mt-2 grow text-sm leading-6 text-admin-text-secondary">{service.description || `Professional ${service.name.toLowerCase()} from ${shopName}.`}</p><div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-admin-border pt-4 text-sm"><span className="inline-flex items-center gap-1.5 text-admin-text-muted"><Clock3 aria-hidden="true" size={16}/>{service.durationMinutes} min</span><strong className="text-brand-ink">From {formatMoney(service.priceCentavos, service.currency ?? currency)}</strong></div><Link id={`public-shop-service-book-${service.id}`} href={`${bookingHref}?service=${encodeURIComponent(service.id)}`} className="mt-4 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-brand-primary-strong hover:text-brand-primary">Book this {serviceLabel}<ArrowRight aria-hidden="true" size={15}/></Link></Card>)}</PublicCardRow>
    </section>;
  })}</div>;
}
