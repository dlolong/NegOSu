import { promoServiceIds } from "../modules/core/commerce/appointment-promos";
import type { PublicService } from "./public-booking";

export type PublicPromo = {
  id: string; branchId: string; serviceId: string; serviceIds?: string[]; name: string; description: string;
  imageUrl: string | null; version: number; priceCentavos: number; currency: string;
  durationMinutes: number; validFrom: string | null; validThrough: string | null;
  inclusions: Array<{ name: string; quantity: string; unit: string }>;
};
export function publicPromoAppliesOn(promo: PublicPromo, date: string) {
  return (!promo.validFrom || date >= promo.validFrom) && (!promo.validThrough || date <= promo.validThrough);
}
export function publicBookingSelection(services: PublicService[], promos: PublicPromo[], branchId: string, serviceIds: string[], promoIds: string[]) {
  const selectedPromos: PublicPromo[] = [];
  const used = new Set<string>();
  for (const id of promoIds) {
    const promo = promos.find(p => p.id === id && p.branchId === branchId && promoServiceIds(p).length > 0 && promoServiceIds(p).every(id => services.some(s => s.id === id)));
    if (!promo || promoServiceIds(promo).some(id => used.has(id))) continue;
    promoServiceIds(promo).forEach(id => used.add(id)); selectedPromos.push(promo);
  }
  const ids = new Set([...serviceIds, ...selectedPromos.flatMap(promoServiceIds)]);
  const selectedServices = services.filter(s => ids.has(s.id));
  const priceCentavos = selectedPromos.reduce((total, p) => total + p.priceCentavos, 0) + selectedServices.filter(s => !used.has(s.id)).reduce((total, s) => total + s.priceCentavos, 0);
  return { services: selectedServices, promos: selectedPromos, priceCentavos, durationMinutes: selectedServices.reduce((total,s)=>total+s.durationMinutes,0) };
}
export function publicBookingHref(slug: string, branch: string, services: readonly string[], promos: readonly string[], values: { step?: number; month?: string; date?: string } = {}) {
  const query = new URLSearchParams({ branch, selection: "1", step: String(values.step ?? 2) });
  services.forEach(id=>query.append("services",id)); promos.forEach(id=>query.append("promos",id));
  if(values.month)query.set("month",values.month);if(values.date)query.set("date",values.date);
  return `/shop/${encodeURIComponent(slug)}/book?${query}`;
}
