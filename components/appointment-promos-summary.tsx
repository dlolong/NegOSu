import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/operations";

export async function AppointmentPromosSummary({ appointmentId }: { appointmentId: string }) {
  const db = await createClient();
  const { data, error } = await db.from("appointment_promo_snapshots").select("promo_id,name,price_centavos,currency,components").eq("appointment_id", appointmentId);
  // Older databases keep ordinary appointment details available before migration.
  if (error?.code === "PGRST205" || error?.code === "42P01") return null;
  if (error) return <p role="alert" className="mt-4 text-sm">Included promo details could not be loaded. Refresh to try again.</p>;
  if (!data?.length) return null;
  const grouped = new Map<string, (typeof data)[number]>();
  for (const row of data) {
    const existing = grouped.get(row.promo_id);
    grouped.set(row.promo_id, { ...row, price_centavos: Number(row.price_centavos) + Number(existing?.price_centavos ?? 0) });
  }
  return <section id="appointment-promos-summary" className="mt-5 rounded-ui-lg border border-admin-border bg-admin-surface p-5"><h2 className="font-medium">Booked promos</h2>{[...grouped.values()].map(p => <div key={p.promo_id} className="mt-3"><p className="text-sm font-medium">{p.name} · {formatMoney(Number(p.price_centavos),p.currency)}</p><ul className="mt-2 list-inside list-disc text-sm text-admin-text-secondary">{(p.components as {kind:string;name:string;quantity:string;unit:string}[]).map((c,i)=><li key={i}>{c.name}{c.kind!=="service"?` · ${c.quantity} ${c.unit}${c.kind==="supply"?" (used during service)":""}`:""}</li>)}</ul></div>)}<p className="mt-3 text-sm text-admin-text-secondary">The agreed promo price is included in the appointment total and is kept when rescheduling. Keep all its included services, branch, and customer; cancel and rebook to change the offer. Record actual product use or handover in Inventory; booking does not change stock.</p></section>;
}
