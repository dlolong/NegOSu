import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCheck, LogIn, LogOut, Plus, Search } from "lucide-react";
import { z } from "zod";
import { hospitalityContext, hospitalityShiftStaff } from "@/modules/hospitality/runtime";
import { canHospitality, type Room } from "@/modules/hospitality/contracts";
import { PaidCheckInForm } from "@/components/hospitality/paid-check-in-form";
import { HospitalityReport } from "@/components/hospitality/report";
import { BookingTabs } from "@/components/hospitality/booking-tabs";
import { RoomStatus } from "@/components/hospitality/room-status";
import { HospitalityActionForm } from "@/components/hospitality/action-form";
import { PageHeader } from "@/components/page-patterns";
import { RecordTable } from "@/components/record-table";
import { RecordLink } from "@/components/record-item";
import { FormDialog } from "@/components/management-ui";
import { Button } from "@/components/ui/button";
import { LoadError, PageLinks, pageNumber, fieldClass, SaveActions, dateLabel } from "@/components/hospitality/shared";
import { markRoomReady } from "../actions";

const base = "/dashboard/hospitality/bookings";
type Query = { room?: string; guest?: string; q?: string; page?: string; tab?: string; preset?: string; start?: string; end?: string; dialog?: string; status?: string; pickQ?: string; pickPage?: string };
type AvailableRoom = Room & { occupancy_status: string; stay_id: string | null; planned_checkout_at: string | null; cleaning_required: boolean; cleaning_stay_id: string | null };
const searchTerm = (value?: string) => (value ?? "").replace(/[,%()\\_"]/g, " ").trim().slice(0, 80);

export default async function BookingsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const [q, { db, activeMembership: m, user }] = await Promise.all([searchParams, hospitalityContext()]);
  if (q.tab === "history") return <HospitalityReport query={{ ...q, section: "stays", preset: q.preset ?? "month" }} mode="history"/>;
  const checkIn = canHospitality(m.role, "checkIn"), operate = canHospitality(m.role, "operate"), housekeeping = canHospitality(m.role, "housekeeping");
  const entering = q.dialog === "manual" || q.dialog === "check-in";
  if ((entering && !checkIn) || (q.dialog === "ready" && !housekeeping)) notFound();
  const page = pageNumber(q.page), term = searchTerm(q.q);
  const status = ["vacant", "occupied", "cleaning", "inactive"].includes(q.status ?? "") ? q.status! : "";
  const listQuery = { ...(term ? { q: term } : {}), ...(status ? { status } : {}), ...(page > 1 ? { page: String(page) } : {}) };
  const closeHref = `${base}?${new URLSearchParams(listQuery)}`;
  const href = (values: Record<string, string>) => `${base}?${new URLSearchParams({ ...listQuery, ...values })}`;
  let request = db.from("hospitality_room_availability").select("*", { count: "exact" }).eq("organization_id", m.organizationId).eq("branch_id", m.branchId);
  if (term) request = request.ilike("name", `%${term}%`);
  if (status) request = request.eq("occupancy_status", status);
  const [rooms, branch] = await Promise.all([
    request.order("name").order("id").range((page - 1) * 50, page * 50 - 1),
    db.from("branches").select("timezone").eq("organization_id", m.organizationId).eq("id", m.branchId).single(),
  ]);
  const rows = (rooms.data ?? []) as AvailableRoom[];
  let selected: AvailableRoom | null = null, selectedError = false;
  if (q.room && (entering || q.dialog === "ready" || q.dialog === "stay")) {
    if (!z.uuid().safeParse(q.room).success) notFound();
    const result = await db.from("hospitality_room_availability").select("*").eq("id", q.room).eq("organization_id", m.organizationId).eq("branch_id", m.branchId).maybeSingle();
    selectedError = Boolean(result.error); selected = result.data as AvailableRoom | null;
    if (!selectedError && !selected) notFound();
  }
  if (q.dialog === "stay" && selected) {
    const stay = await db.from("hospitality_stays").select("id").eq("organization_id", m.organizationId).eq("branch_id", m.branchId).eq("room_id", selected.id).order("checked_in_at", { ascending: false }).order("id").limit(1).maybeSingle();
    if (stay.error) selectedError = true;
    else if (stay.data) redirect(`/dashboard/hospitality/stays/${stay.data.id}`);
  }
  let staff: Awaited<ReturnType<typeof hospitalityShiftStaff>> = [], staffError = false;
  if (entering && selected) { try { staff = await hospitalityShiftStaff(m.organizationId, m.branchId); } catch { staffError = true; } }
  const guest = z.uuid().safeParse(q.guest).success ? q.guest! : "";
  const pickPage = pageNumber(q.pickPage), pickQ = searchTerm(q.pickQ);
  let choices = null;
  if (entering && !q.room) {
    let lookup = db.from("hospitality_room_availability").select("id,name,capacity,rates", { count: "exact" }).eq("organization_id", m.organizationId).eq("branch_id", m.branchId);
    if (q.dialog !== "manual") lookup = lookup.eq("occupancy_status", "vacant");
    if (pickQ) lookup = lookup.ilike("name", `%${pickQ}%`);
    choices = await lookup.order("name").order("id").range((pickPage - 1) * 50, pickPage * 50 - 1);
  }
  const dialogQuery = { dialog: q.dialog ?? "manual", ...(guest ? { guest } : {}) };
  return <main id="hospitality-bookings-page" className="mx-auto min-w-0 max-w-7xl">
    <PageHeader id="hospitality-bookings-header" eyebrow={m.branchName} title="Bookings" description="View room availability, check guests in and out, and mark cleaned rooms ready." action={checkIn ? <Button asChild><Link id="hospitality-manual-booking-button" href={href({ dialog: "manual" })}><Plus size={16}/>Manually Add Booking</Link></Button> : undefined}/>
    <BookingTabs value="rooms"/>
    <form id="hospitality-booking-search-form" className="my-4 flex flex-wrap items-end gap-2">
      <label className="min-w-0 flex-1 text-sm" htmlFor="hospitality-booking-search">Search rooms<input id="hospitality-booking-search" name="q" type="search" defaultValue={term} maxLength={80} className={fieldClass}/></label>
      <label className="text-sm" htmlFor="hospitality-booking-status">Room status<select id="hospitality-booking-status" name="status" defaultValue={status} className={fieldClass}><option value="">All rooms</option><option value="vacant">Available</option><option value="occupied">Occupied</option><option value="cleaning">Cleaning</option><option value="inactive">Inactive</option></select></label>
      <Button id="hospitality-booking-search-button" type="submit" variant="secondary"><Search size={16}/>Search</Button>
    </form>
    {rooms.error ? <LoadError>Rooms could not be loaded. Refresh and try again.</LoadError> : <RecordTable id="hospitality-booking-rooms" caption="Room availability and bookings" empty="No rooms found." columns={[{ key: "room", label: "Room" }, { key: "status", label: "Status" }, { key: "period", label: "Paid until", secondary: true }, { key: "actions", label: "Actions", align: "right" }]} rows={rows.map(room => ({ id: `hospitality-booking-room-${room.id}`, cells: {
      room: <><RecordLink href={room.stay_id ? `/dashboard/hospitality/stays/${room.stay_id}` : href({ dialog: "stay", room: room.id })}>{room.name}</RecordLink><p className="mt-1 text-xs text-slate-500">{room.room_type || "Room"} · Capacity {room.capacity}</p></>,
      status: <RoomStatus status={room.occupancy_status}/>,
      period: room.planned_checkout_at ? dateLabel(room.planned_checkout_at, branch.data?.timezone ?? m.timezone) : "—",
      actions: <div className="flex flex-wrap justify-end gap-2">
        {room.occupancy_status === "vacant" && checkIn ? room.rates.length ? <Button asChild size="sm"><Link id={`hospitality-check-in-${room.id}`} href={href({ dialog: "check-in", room: room.id })}><LogIn size={15}/>Check In</Link></Button> : <span className="text-xs text-slate-500">Set room rates first</span> : null}
        {room.stay_id ? <><Button asChild size="sm" variant="secondary"><Link href={`/dashboard/hospitality/stays/${room.stay_id}`}>View stay</Link></Button>{operate ? <Button asChild size="sm"><Link id={`hospitality-check-out-${room.id}`} href={`/dashboard/hospitality/stays/${room.stay_id}?dialog=checkout`}><LogOut size={15}/>Check Out</Link></Button> : null}</> : null}
        {room.cleaning_required && !room.stay_id && housekeeping ? <Button asChild size="sm" variant="secondary"><Link id={`hospitality-mark-ready-${room.id}`} href={href({ dialog: "ready", room: room.id })}><CheckCheck size={15}/>Mark as Ready</Link></Button> : null}
      </div>,
    } }))}/>}
    {!rooms.error ? <PageLinks page={page} count={rooms.count ?? 0} href={p => href({ page: String(p) })}/> : null}
    {entering ? <FormDialog id="hospitality-check-in-dialog" title={q.dialog === "manual" ? "Manually Add Booking" : `Check In${selected ? ` · ${selected.name}` : ""}`} description={selected ? selected.name : q.dialog === "manual" ? "Record a previous booking, including guests who already checked out." : "Choose an available room to continue."} closeHref={closeHref} size="md">
      {selectedError ? <LoadError>Unable to load this room. Close and try again.</LoadError> : selected ? <>
        <Link id="hospitality-booking-change-room" className="mb-4 inline-flex min-h-11 items-center text-sm underline" href={href(dialogQuery)}>Choose another room</Link>
        {q.dialog !== "manual" && selected.occupancy_status !== "vacant" ? <p role="alert">This room is occupied, inactive or being cleaned. Choose an available room.</p> : !selected.rates.length ? <p role="alert">Configure room rates before check-in.</p> : staffError || branch.error || !branch.data ? <LoadError>Staff or branch details could not be loaded. Close and try again.</LoadError> : <PaidCheckInForm key={`${selected.id}-${selected.rates_version}-${q.dialog}`} room={selected} manual={q.dialog === "manual"} timezone={branch.data.timezone} guestId={guest} requestKey={crypto.randomUUID()} currency={m.currency} closeHref={closeHref} staff={staff} canManageStaff={m.role === "owner"} staffScope={{ userId: user.id, organizationId: m.organizationId, branchId: m.branchId }}/>}
      </> : <>
        <form id="hospitality-manual-room-search-form" className="mb-4 flex flex-wrap items-end gap-2">
          {Object.entries({ ...listQuery, ...dialogQuery }).map(([name, value]) => <input key={name} type="hidden" name={name} value={value}/>)}
          <label className="min-w-0 flex-1 text-sm" htmlFor="hospitality-manual-room-search">Find a room<input id="hospitality-manual-room-search" name="pickQ" type="search" defaultValue={pickQ} className={fieldClass}/></label><Button type="submit" id="hospitality-manual-room-search-button" variant="secondary">Search</Button>
        </form>
        {choices?.error ? <LoadError>Rooms could not be loaded.</LoadError> : <div id="hospitality-check-in-room-list" className="grid gap-2">{choices?.data?.length ? choices.data.map(room => <div key={room.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-admin-border p-3"><span className="min-w-0 break-words">{room.name} · Up to {room.capacity}</span>{room.rates.length ? <Button asChild size="sm"><Link id={`hospitality-manual-select-${room.id}`} href={href({ ...dialogQuery, room: room.id })}>Select room</Link></Button> : <span className="text-sm text-slate-500">Rates not configured</span>}</div>) : <p className="text-sm">No rooms found. Try another search.</p>}</div>}
        {choices && !choices.error ? <PageLinks page={pickPage} count={choices.count ?? 0} href={p => href({ ...dialogQuery, pickQ, pickPage: String(p) })}/> : null}
      </>}
    </FormDialog> : null}
    {q.dialog === "stay" ? <FormDialog id="hospitality-booking-details-dialog" title={`Check-in details${selected ? ` · ${selected.name}` : ""}`} closeHref={closeHref} size="md">{selectedError ? <LoadError>Check-in details could not be loaded.</LoadError> : <><p className="text-sm">No check-in has been recorded for this room yet.</p>{checkIn && selected?.occupancy_status === "vacant" && selected.rates.length ? <Button asChild className="mt-4"><Link id="hospitality-first-check-in" href={href({ dialog: "check-in", room: selected.id })}>Check In</Link></Button> : null}</>}</FormDialog> : null}
    {q.dialog === "ready" ? <FormDialog id="hospitality-ready-dialog" title={`Mark ${selected?.name ?? "room"} as ready`} closeHref={closeHref} size="md">{selectedError ? <LoadError/> : selected?.cleaning_required && !selected.stay_id && selected.cleaning_stay_id ? <HospitalityActionForm id="hospitality-ready-form" action={markRoomReady}><input type="hidden" name="roomId" value={selected.id}/><input type="hidden" name="cleaningStayId" value={selected.cleaning_stay_id}/><p className="sm:col-span-2 text-sm">Confirm housekeeping is finished.{!selected.is_active ? " This room will remain inactive until an administrator activates it." : " The room will become available for check-in."}</p><SaveActions id="hospitality-ready" label="Mark as Ready" closeHref={closeHref}/></HospitalityActionForm> : <p role="alert">This room no longer needs cleaning. Close and refresh the list.</p>}</FormDialog> : null}
  </main>;
}
