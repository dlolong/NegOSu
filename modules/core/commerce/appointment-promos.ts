import { z } from "zod";

export type AppointmentPromoChoice = {
  id: string; name: string; description: string; branchId: string; serviceId: string;
  serviceIds?: string[]; version: number; priceCentavos: number; currency: string;
  validFrom: string | null; validThrough: string | null;
};
export const appointmentPromoSelectionsSchema = z.array(z.object({ id: z.uuid(), version: z.number().int().positive() })).max(30)
  .refine(rows => new Set(rows.map(row => row.id)).size === rows.length, "Select each promo only once.");
export function readAppointmentPromos(data: FormData) {
  try { return appointmentPromoSelectionsSchema.parse(JSON.parse(String(data.get("promoSelections") || "[]"))); }
  catch { throw new Error("Invalid promo selection. Refresh and select the promo again."); }
}
export function eligibleAppointmentPromos(promos: AppointmentPromoChoice[], branchId: string, date: string) {
  return promos.filter(p => p.branchId === branchId && (!date || ((!p.validFrom || p.validFrom <= date) && (!p.validThrough || p.validThrough >= date))));
}

/** Older single-service offers are normalized at the boundary. */
export function promoServiceIds(promo: { serviceId: string; serviceIds?: string[] }): string[] {
  return promo.serviceIds ?? [promo.serviceId];
}
