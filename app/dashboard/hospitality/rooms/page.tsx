import Link from "next/link";
import { Pencil, Plus, Search, LogIn, LogOut, CheckCheck } from "lucide-react";
import { z } from "zod";
import { hospitalityContext } from "@/modules/hospitality/runtime";
import { canHospitality, stayPackages, type Room } from "@/modules/hospitality/contracts";
import { formatMoney } from "@/lib/operations";
import { PageHeader } from "@/components/page-patterns";
import { RecordTable } from "@/components/record-table";
import { RecordLink } from "@/components/record-item";
import { FormDialog } from "@/components/management-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListTabs } from "@/components/list-tabs";
import { HospitalityActionForm } from "@/components/hospitality/action-form";
import { RoomRatesEditor } from "@/components/hospitality/room-rates-editor";
import { PaidCheckInForm } from "@/components/hospitality/paid-check-in-form";
import { Field, fieldClass, SaveActions, LoadError, PageLinks, pageNumber, dateLabel } from "@/components/hospitality/shared";
import { saveRoom, markRoomReady } from "../actions";
import { HospitalityReport } from "@/components/hospitality/report";

type Query = { q?: string; page?: string; dialog?: string; room?: string; guest?: string; tab?: string };
type AvailableRoom = Room & { stay_id: string | null; occupancy_status: string; planned_checkout_at: string | null; stay_period_label: string | null; occupants: number | null; cleaning_required: boolean; cleaning_stay_id: string | null };
export default async function RoomsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const [q, { db, activeMembership: m }] = await Promise.all([searchParams, hospitalityContext()]);
  if (q.tab === "history") return <HospitalityReport query={{ ...q, section: "stays", preset: "month" }} mode="history"/>;
  const tab = "all";
  const page = pageNumber(q.page), term = (q.q ?? "").replace(/[,%()\\_"]/g, " ").trim().slice(0, 80);
  let request = db.from("hospitality_room_availability").select("*", { count: "exact" }).eq("organization_id", m.organizationId).eq("branch_id", m.branchId);
  if (term) request = request.ilike("name", `%${term}%`);
  const rooms = await request.order("name").range((page - 1) * 50, page * 50 - 1);
  const rows = (rooms.data ?? []) as AvailableRoom[];
  const selected = z.uuid().safeParse(q.room).success ? await db.from("hospitality_room_availability").select("*").eq("id", q.room!).eq("organization_id", m.organizationId).eq("branch_id", m.branchId).maybeSingle() : { data: null };
  const room = selected.data as AvailableRoom | null;
  const manage = canHospitality(m.role, "rooms"), checkIn = canHospitality(m.role, "checkIn");
  const base = "/dashboard/hospitality/rooms", closeHref = `${base}?tab=${tab}`;
  const price = (r: Room) => r.rates.length ? `From ${formatMoney(Math.min(...r.rates.map(rate => rate.priceCentavos)), m.currency)}` : "Rates not configured";
  return <main id="hospitality-rooms-page" className="mx-auto min-w-0 max-w-7xl">
    <PageHeader id="hospitality-rooms-header" eyebrow={m.branchName} title="Rooms" description="See every room and its current status. Check in available rooms, check out occupied rooms, and mark cleaned rooms ready." action={manage ? <Button id="hospitality-add-room-button" asChild><Link href={`${base}?tab=${tab}&dialog=room`}><Plus size={16}/>Add room</Link></Button> : undefined}/>
    <ListTabs id="hospitality-rooms-tabs" baseHref={base} query={{}} value={tab} options={[{ value: "all", label: "Rooms" }, { value: "history", label: "Stay history" }]} parameter="tab"/>
    <form className="my-4 flex items-end gap-2"><input type="hidden" name="tab" value={tab}/><Field label="Search rooms"><input id="hospitality-room-search" className={fieldClass} name="q" defaultValue={q.q} placeholder="Room name or number"/></Field><Button id="hospitality-room-search-button" type="submit" variant="secondary"><Search size={16}/><span className="sr-only sm:not-sr-only">Search</span></Button></form>
    {rooms.error ? <LoadError/> : <RecordTable id="hospitality-room-grid" caption="Rooms and current occupancy" empty="No rooms found." columns={[{ key: "room", label: "Room" }, { key: "status", label: "Status", secondary: true, className: "lg:w-32" }, { key: "period", label: "Stay / rate", secondary: true }, { key: "capacity", label: "Capacity", secondary: true }, { key: "actions", label: "Actions", align: "right", className: "w-36 sm:w-56" }]} rows={rows.map(r => {
      const href = r.stay_id ? `/dashboard/hospitality/stays/${r.stay_id}` : `${base}?tab=${tab}&dialog=details&room=${r.id}`;
      const period = r.stay_id ? `${r.stay_period_label ?? "Existing stay"}${r.planned_checkout_at ? ` · Until ${dateLabel(r.planned_checkout_at, m.timezone)}` : ""}` : price(r);
      return { id: `hospitality-room-${r.id}`, cells: { room: <><RecordLink href={href}>{r.name}</RecordLink>{r.room_type ? <p className="mt-1 text-xs text-slate-500">{r.room_type}</p> : null}<div className="mt-2 lg:hidden"><RoomStatus status={r.occupancy_status}/></div></>, status: <RoomStatus status={r.occupancy_status}/>, period, capacity: r.capacity, actions: <div className="flex flex-wrap justify-end gap-2">{r.occupancy_status === "vacant" && r.rates.length > 0 && checkIn ? <Button asChild size="sm"><Link id={`hospitality-check-in-${r.id}`} href={`${base}?tab=${tab}&dialog=check-in&room=${r.id}${q.guest ? `&guest=${encodeURIComponent(q.guest)}` : ""}`}><LogIn size={15} className="shrink-0"/><span className="whitespace-nowrap">Check in</span></Link></Button> : null}{r.stay_id && canHospitality(m.role, "operate") ? <Button asChild size="sm" variant="secondary"><Link id={`hospitality-check-out-${r.id}`} href={`/dashboard/hospitality/stays/${r.stay_id}?dialog=checkout`}><LogOut size={15} className="shrink-0"/><span>Check out</span></Link></Button> : null}{r.cleaning_required && !r.stay_id && canHospitality(m.role, "housekeeping") ? <Button asChild size="sm" variant="secondary"><Link id={`hospitality-mark-ready-${r.id}`} href={`${base}?tab=${tab}&dialog=ready&room=${r.id}`}><CheckCheck size={15} className="shrink-0"/><span>Mark ready</span></Link></Button> : null}{manage ? <Button asChild size="sm" variant="secondary"><Link href={`${base}?tab=all&dialog=room&room=${r.id}`} aria-label={`Edit ${r.name}`}><Pencil size={15}/></Link></Button> : null}</div> }, mobile: <><p>{period}</p><p>Capacity {r.capacity}</p></> };
    })}/>}
    <PageLinks page={page} count={rooms.count ?? 0} href={p => `${base}?tab=${tab}&page=${p}&q=${encodeURIComponent(term)}`}/>
    {q.dialog === "room" && manage && (!q.room || room) ? <FormDialog id="hospitality-room-form-dialog" title={room ? `Edit ${room.name}` : "Add room"} closeHref={closeHref} size="md"><HospitalityActionForm id="hospitality-room-form" action={saveRoom}>
      <input type="hidden" name="id" value={room?.id ?? ""}/><Field label="Room name / number *"><input id="hospitality-room-name" name="name" required maxLength={80} defaultValue={room?.name} className={fieldClass}/></Field><Field label="Room type"><input id="hospitality-room-type" name="roomType" maxLength={80} defaultValue={room?.room_type ?? ""} className={fieldClass}/></Field><Field label="Occupant capacity *"><input id="hospitality-room-capacity" name="capacity" type="number" min={1} max={100} required defaultValue={room?.capacity ?? 2} className={fieldClass}/></Field><label className="flex min-h-11 items-center gap-2 self-end text-sm"><input id="hospitality-room-active" name="active" type="checkbox" defaultChecked={room?.is_active ?? true}/>Active room</label>
      <RoomRatesEditor rates={room?.rates ?? []} version={room?.rates_version ?? 0} ids={stayPackages.map(() => crypto.randomUUID())}/>
      <Field label="Description" full><textarea id="hospitality-room-description" name="description" maxLength={1000} defaultValue={room?.description ?? ""} className={fieldClass}/></Field><SaveActions id="hospitality-room" label="Save room" closeHref={closeHref}/>
    </HospitalityActionForm></FormDialog> : null}
    {q.dialog === "check-in" && room && checkIn ? <FormDialog id="hospitality-check-in-dialog" title={`Check in · ${room.name}`} description={`Capacity ${room.capacity}. Guest name is optional.`} closeHref={closeHref} size="md">{room.occupancy_status !== "vacant" ? <p role="alert" className="text-sm">This room is occupied, inactive or being cleaned. Choose an available room.</p> : room.rates.length ? <PaidCheckInForm room={room} guestId={z.uuid().safeParse(q.guest).success ? q.guest : undefined} requestKey={crypto.randomUUID()} currency={m.currency} closeHref={closeHref}/> : <p className="text-sm">An administrator must configure room rates before check-in.</p>}</FormDialog> : null}
    {q.dialog === "ready" && room && canHospitality(m.role, "housekeeping") ? <FormDialog id="hospitality-ready-dialog" title={`Mark ${room.name} ready`} closeHref={closeHref} size="md">{room.cleaning_required && !room.stay_id && room.cleaning_stay_id ? <HospitalityActionForm id="hospitality-ready-form" action={markRoomReady}><input type="hidden" name="roomId" value={room.id}/><input type="hidden" name="cleaningStayId" value={room.cleaning_stay_id}/><p className="sm:col-span-2 text-sm">Confirm housekeeping is finished and the room is ready for the next customer.{!room.is_active ? " This room is inactive and will remain unavailable until an administrator activates it." : " Its status will change to Available."}</p><SaveActions id="hospitality-ready" label="Mark ready" closeHref={closeHref}/></HospitalityActionForm> : <p role="alert" className="text-sm">This room no longer needs cleaning. Refresh to see its current status.</p>}</FormDialog> : null}
    {q.dialog === "details" && room ? <FormDialog id="hospitality-room-details-dialog" title={room.name} closeHref={closeHref} size="md"><div className="flex flex-wrap items-center gap-2 text-sm"><RoomStatus status={room.occupancy_status}/><span>Capacity {room.capacity}</span></div><p className="mt-3 whitespace-pre-wrap text-sm">{room.description || "No description provided."}</p><dl className="mt-4 space-y-2">{room.rates.map(rate => <div key={rate.id} className="flex justify-between gap-3 text-sm"><dt>{rate.label}</dt><dd>{formatMoney(rate.priceCentavos, m.currency)}</dd></div>)}</dl>{checkIn && room.occupancy_status === "vacant" && room.rates.length > 0 ? <Button className="mt-4" asChild><Link href={`${base}?tab=${tab}&dialog=check-in&room=${room.id}`}><LogIn size={16}/>Check in</Link></Button> : null}{room.cleaning_required && !room.stay_id && canHospitality(m.role, "housekeeping") ? <Button className="mt-4" asChild><Link href={`${base}?tab=${tab}&dialog=ready&room=${room.id}`}><CheckCheck size={16}/>Mark ready</Link></Button> : null}{room.stay_id ? <Link className="mt-4 inline-block text-sm text-brand-primary underline" href={`/dashboard/hospitality/stays/${room.stay_id}`}>View occupied stay</Link> : null}</FormDialog> : null}
  </main>;
}

function RoomStatus({ status }: { status: string }) {
  const label = status === "vacant" ? "Available" : status === "occupied" ? "Occupied" : status === "cleaning" ? "Cleaning" : "Inactive";
  return <Badge variant={status === "vacant" ? "success" : status === "occupied" ? "info" : status === "cleaning" ? "warning" : "neutral"}>{label}</Badge>;
}
