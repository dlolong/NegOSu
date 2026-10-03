import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { hospitalityContext } from "@/modules/hospitality/runtime";
import { canHospitality, type Room } from "@/modules/hospitality/contracts";
import { formatMoney } from "@/lib/operations";
import { PageHeader } from "@/components/page-patterns";
import { Button } from "@/components/ui/button";
import { ListTabs } from "@/components/list-tabs";
import { RoomHistory } from "@/components/hospitality/room-history";
import { LoadError } from "@/components/hospitality/shared";

export default async function RoomDetailsPage({ params, searchParams }: {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [{ roomId }, query, { db, activeMembership: m }] = await Promise.all([params, searchParams, hospitalityContext()]);
  if (!z.uuid().safeParse(roomId).success) notFound();
  const result = await db.from("hospitality_rooms").select("*").eq("id", roomId).eq("organization_id", m.organizationId).eq("branch_id", m.branchId).maybeSingle();
  if (result.error) return <LoadError>Room details could not be loaded. Refresh to try again.</LoadError>;
  if (!result.data) notFound();
  const room = result.data as Room;
  const tab = query.tab === "history" ? "history" : "details";
  return <main id="hospitality-room-details-page" className="mx-auto min-w-0 max-w-7xl">
    <PageHeader id="hospitality-room-details-header" eyebrow={m.branchName} title={room.name} description="Room details and guest stay history." action={canHospitality(m.role, "rooms") ? <Button asChild variant="secondary"><Link id="hospitality-room-edit" href={`/dashboard/hospitality/rooms?dialog=room&room=${room.id}`}>Edit room</Link></Button> : undefined}/>
    <ListTabs id="hospitality-room-tabs" baseHref={`/dashboard/hospitality/rooms/${room.id}`} query={{ preset: query.preset, start: query.start, end: query.end }} parameter="tab" value={tab} options={[{ value: "details", label: "Details" }, { value: "history", label: "History" }]}/>
    {tab === "history" ? <RoomHistory roomId={room.id} query={query}/> : <section id="hospitality-room-details" className="mt-5 rounded-xl border border-admin-border bg-white p-4 sm:p-6">
      <dl className="grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Room type</dt><dd>{room.room_type || "Not specified"}</dd></div><div><dt className="text-slate-500">Capacity</dt><dd>{room.capacity} occupants</dd></div></dl>
      <h2 className="mt-5 font-medium">Description</h2><p className="mt-2 whitespace-pre-wrap break-words text-sm">{room.description || "No description provided."}</p>
      <h2 className="mt-5 font-medium">Room rates</h2>
      {room.rates.length ? <dl className="mt-3 space-y-3">{room.rates.map(rate => <div key={rate.id} className="flex flex-wrap justify-between gap-3 border-b border-admin-border pb-3 text-sm"><dt>{rate.label}</dt><dd>{formatMoney(rate.priceCentavos, m.currency)}{rate.extensionHourlyCentavos ? <span className="block text-xs text-slate-500">Extra hour {formatMoney(rate.extensionHourlyCentavos, m.currency)}</span> : null}</dd></div>)}</dl> : <p className="mt-2 text-sm text-slate-500">Rates not configured.</p>}
    </section>}
  </main>;
}
