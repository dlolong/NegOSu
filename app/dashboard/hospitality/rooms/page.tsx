import {FormMessage} from "@/components/form-message";
import {RemoveRecordButton} from "@/components/remove-record-button";
import { CompactFilters } from "@/components/compact-filters";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { z } from "zod";
import { hospitalityContext } from "@/modules/hospitality/runtime";
import { canHospitality, stayPackages, type Room } from "@/modules/hospitality/contracts";
import { formatMoney } from "@/lib/operations";
import { PageHeader } from "@/components/page-patterns";
import { RecordTable } from "@/components/record-table";
import { RecordLink } from "@/components/record-item";
import { FormDialog } from "@/components/management-ui";
import { Button } from "@/components/ui/button";
import { HospitalityActionForm } from "@/components/hospitality/action-form";
import { RoomRatesEditor } from "@/components/hospitality/room-rates-editor";
import { Field, fieldClass, SaveActions, LoadError, PageLinks, pageNumber } from "@/components/hospitality/shared";
import { saveRoom } from "../actions";

type Query = { historyPage?: string; message?: string; q?: string; page?: string; dialog?: string; room?: string; guest?: string; tab?: string; preset?: string; start?: string; end?: string };

export default async function RoomsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const [q, { db, activeMembership: m }] = await Promise.all([searchParams, hospitalityContext()]);
  // Preserve saved links while moving operational workflows to Bookings.
  if (q.tab === "history") redirect(`/dashboard/hospitality/bookings?${new URLSearchParams({ tab: "history", ...(q.preset ? { preset: q.preset } : {}), ...(q.start ? { start: q.start } : {}), ...(q.end ? { end: q.end } : {}), ...(q.page ? { page: q.page } : {}) })}`);
  if (q.dialog === "check-in" || q.dialog === "ready" || q.guest) redirect(`/dashboard/hospitality/bookings?${new URLSearchParams({ dialog: q.dialog === "ready" ? "ready" : "manual", ...(q.room ? { room: q.room } : {}), ...(q.guest ? { guest: q.guest } : {}) })}`);
  if (q.dialog === "details" && z.uuid().safeParse(q.room).success) redirect(`/dashboard/hospitality/rooms/${q.room}${q.historyPage ? `?tab=history&page=${pageNumber(q.historyPage)}` : ""}`);
  const tab = "all";
  const page = pageNumber(q.page), term = (q.q ?? "").replace(/[,%()\\_"]/g, " ").trim().slice(0, 80);
  let request = db.from("hospitality_rooms").select("*", { count: "exact" }).eq("organization_id", m.organizationId).eq("branch_id", m.branchId);
  if (term) request = request.ilike("name", `%${term}%`);
  const rooms = await request.order("name").range((page - 1) * 50, page * 50 - 1);
  const rows = (rooms.data ?? []) as Room[];
  const selected = z.uuid().safeParse(q.room).success ? await db.from("hospitality_rooms").select("*").eq("id", q.room!).eq("organization_id", m.organizationId).eq("branch_id", m.branchId).maybeSingle() : { data: null };
  const room = selected.data as Room | null;
  const manage = canHospitality(m.role, "rooms");
  const base = "/dashboard/hospitality/rooms", closeHref = `${base}?tab=${tab}`;
  const price = (r: Room) => r.rates.length ? `From ${formatMoney(Math.min(...r.rates.map(rate => rate.priceCentavos)), m.currency)}` : "Rates not configured";
  return <main id="hospitality-rooms-page" className="mx-auto min-w-0 max-w-7xl">
    <PageHeader id="hospitality-rooms-header" title="Rooms" description="Maintain room details, capacity and rates. Open a room to view its stay history. Manage room status and arrivals in Bookings." action={manage ? <Button id="hospitality-add-room-button" asChild><Link href={`${base}?tab=${tab}&dialog=room`}><Plus size={16}/>Add room</Link></Button> : undefined}/>
    <FormMessage message={q.message}/>
    <div id="hospitality-rooms-workspace" className="mt-4 min-w-0">
    <div id="hospitality-rooms-content" className="min-w-0">
    <CompactFilters id="hospitality-room-search-form" searchLabel="Search rooms" search={<input id="hospitality-room-search"  name="q" defaultValue={q.q} placeholder="Room name or number" type="search" enterKeyHint="search" className="min-h-11 w-full min-w-0 rounded-ui-md border border-admin-border bg-admin-surface px-3 py-2 text-sm"/>} searchValue={q.q} hiddenFields={<><input type="hidden" name="tab" value={tab}/></>}><Button id="hospitality-room-search-button" type="submit" variant="secondary"><Search size={16}/><span className="sr-only sm:not-sr-only">Search</span></Button></CompactFilters>
    {rooms.error ? <LoadError/> : <RecordTable id="hospitality-room-grid" caption="Room setup and maintenance" empty="No rooms found." columns={[{ key: "room", label: "Room" }, { key: "period", label: "Room rate", secondary: true }, { key: "capacity", label: "Capacity", secondary: true }]} rows={rows.map(r => {
      const href = `${base}/${r.id}`;
      const period = price(r);
      return { id: `hospitality-room-${r.id}`, cells: { room: <><RecordLink href={href}>{r.name}</RecordLink>{r.room_type ? <p className="mt-1 text-xs text-slate-500">{r.room_type}</p> : null}</>, period, capacity: r.capacity }, mobile: <><p>{period}</p><p>Capacity {r.capacity}</p></> };
    })}/>}
    <PageLinks page={page} count={rooms.count ?? 0} href={p => `${base}?tab=${tab}&page=${p}&q=${encodeURIComponent(term)}`}/>
    </div>
    </div>
    {q.dialog === "room" && manage && (!q.room || room) ? <FormDialog id="hospitality-room-form-dialog" title={room ? `Edit ${room.name}` : "Add room"} closeHref={closeHref} size="md"><HospitalityActionForm id="hospitality-room-form" action={saveRoom}>
      <input type="hidden" name="id" value={room?.id ?? ""}/><Field label="Room name / number *"><input id="hospitality-room-name" name="name" required maxLength={80} defaultValue={room?.name} className={fieldClass}/></Field><Field label="Room type"><input id="hospitality-room-type" name="roomType" maxLength={80} defaultValue={room?.room_type ?? ""} className={fieldClass}/></Field><Field label="Occupant capacity *"><input id="hospitality-room-capacity" name="capacity" type="number" min={1} max={100} required defaultValue={room?.capacity ?? 2} className={fieldClass}/></Field><label className="flex min-h-11 items-center gap-2 self-end text-sm"><input id="hospitality-room-active" name="active" type="checkbox" defaultChecked={room?.is_active ?? true}/>Active room</label>
      <RoomRatesEditor currency={m.currency} rates={room?.rates ?? []} version={room?.rates_version ?? 0} ids={stayPackages.map(() => crypto.randomUUID())}/>
      <Field label="Description" full><textarea id="hospitality-room-description" name="description" maxLength={1000} defaultValue={room?.description ?? ""} className={fieldClass}/></Field><SaveActions id="hospitality-room" label="Save room" closeHref={closeHref}/>
    </HospitalityActionForm>{room?<RemoveRecordButton kind="room" recordId={room.id} name={room.name}/>:null}</FormDialog> : null}
  </main>;
}
