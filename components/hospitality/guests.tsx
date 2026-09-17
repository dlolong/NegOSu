import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Plus, Search } from "lucide-react";
import { z } from "zod";
import { hospitalityContext } from "@/modules/hospitality/runtime";
import { canHospitality, type Stay } from "@/modules/hospitality/contracts";
import { CustomerForm, type CustomerRecord } from "@/components/crm-forms";
import { FormDialog } from "@/components/management-ui";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-patterns";
import { RecordTable } from "@/components/record-table";
import { RecordLink } from "@/components/record-item";
import { formatMoney } from "@/lib/operations";
import { Field, fieldClass, PageLinks, pageNumber, dateLabel, LoadError } from "./shared";

type Query = { q?: string; page?: string; create?: string; edit?: string; error?: string; message?: string; warning?: string; duplicateId?: string };
export async function HospitalityGuests({ query: q }: { query: Query }) {
  const { db, activeMembership: m } = await hospitalityContext(), page = pageNumber(q.page);
  let request = db.from("customers").select("id,full_name,phone,email", { count: "exact" }).eq("organization_id", m.organizationId).eq("is_archived", false);
  const term = (q.q ?? "").replace(/[,%()\\_"]/g, " ").trim().slice(0, 100);
  if (term) request = request.ilike("full_name", `%${term}%`);
  const guests = await request.order("full_name").range((page - 1) * 50, page * 50 - 1);
  const stays = guests.data?.length ? await db.from("hospitality_guest_rooms").select("guest_id,room_names,room_count").eq("organization_id", m.organizationId).in("guest_id", guests.data.map(g => g.id)).limit(50) : { data: [], error: null };
  const edit = z.uuid().safeParse(q.edit).success ? await db.from("customers").select("id,full_name,phone,email,address_line,city,province,notes").eq("organization_id", m.organizationId).eq("id", q.edit!).maybeSingle() : { data: null };
  const write = canHospitality(m.role, "guestsWrite"), base = "/dashboard/customers";
  return <main id="hospitality-guests-page" className="mx-auto min-w-0 max-w-7xl"><PageHeader id="hospitality-guests-header" title="Guests" description="Guest profiles and their current room assignments. Contacts are optional." action={write ? <Button id="hospitality-add-guest" asChild><Link href={`${base}?create=1`}><Plus size={16}/>Add guest</Link></Button> : undefined}/><FormMessage message={q.message} error={q.error}/>
    <form className="my-4 flex items-end gap-2"><Field label="Search guests"><input id="hospitality-guest-search" name="q" defaultValue={q.q} className={fieldClass} placeholder="Guest name"/></Field><Button id="hospitality-guest-search-button" type="submit" variant="secondary"><Search size={16}/><span className="sr-only sm:not-sr-only">Search</span></Button></form>
    {guests.error || stays.error ? <LoadError/> : <RecordTable id="hospitality-guests-table" caption="Guests" columns={[{ key: "name", label: "Guest" }, { key: "contact", label: "Contact", secondary: true }, { key: "rooms", label: "Current rooms", secondary: true }, { key: "actions", label: "Actions", align: "right" }]} rows={(guests.data ?? []).map(g => {
      const assignment = (stays.data ?? []).find(s => s.guest_id === g.id);
      const assigned = assignment ? `${assignment.room_names}${assignment.room_count > 10 ? ` and ${assignment.room_count - 10} more` : ""}` : "No current stay";
      return { id: `hospitality-guest-${g.id}`, cells: { name: <RecordLink href={`${base}/${g.id}`}>{g.full_name}</RecordLink>, contact: <><p>{g.phone || "No mobile"}</p><p className="text-xs">{g.email || "No email"}</p></>, rooms: assigned, actions: write ? <Button asChild size="sm" variant="secondary"><Link href={`${base}?edit=${g.id}`}><Pencil size={15}/>Edit</Link></Button> : null }, mobile: <><p>{g.phone || g.email || "No contact provided"}</p><p>{assigned}</p></> };
    })}/>}
    <PageLinks page={page} count={guests.count ?? 0} href={p => `${base}?page=${p}&q=${encodeURIComponent(term)}`}/>
    {q.create && write ? <FormDialog id="hospitality-guest-form-dialog" title="Add guest" description="Only the guest name is required." closeHref={base}><CustomerForm entityLabel="guest" embedded returnTo={`${base}?create=1`} {...q}/></FormDialog> : null}
    {edit.data && write ? <FormDialog id="hospitality-guest-edit-dialog" title="Edit guest" closeHref={base}><CustomerForm entityLabel="guest" embedded customer={edit.data as CustomerRecord} returnTo={`${base}?edit=${edit.data.id}`} {...q}/></FormDialog> : null}
  </main>;
}
export async function HospitalityGuestDetail({ guestId, query: q }: { guestId: string; query: Query }) {
  const { db, activeMembership: m } = await hospitalityContext(), page = pageNumber(q.page);
  if (!z.uuid().safeParse(guestId).success) notFound();
  const guest = await db.from("customers").select("id,full_name,phone,email,address_line,city,province,notes").eq("organization_id", m.organizationId).eq("id", guestId).maybeSingle();
  if (guest.error) return <LoadError/>;
  if (!guest.data) notFound();
  const stays = await db.from("hospitality_stays").select("*", { count: "exact" }).eq("organization_id", m.organizationId).eq("guest_id", guestId).order("checked_out_at", { ascending: false, nullsFirst: true }).order("checked_in_at", { ascending: false }).range((page - 1) * 50, page * 50 - 1);
  const rows = (stays.data ?? []) as Stay[], finance = canHospitality(m.role, "financeRead");
  const bills = finance && rows.length ? await db.from("hospitality_stay_bills").select("stay_id,invoices(total_centavos,paid_centavos,balance_centavos,status)").eq("organization_id", m.organizationId).in("stay_id", rows.map(s => s.id)) : { data: [], error: null };
  const branchRows = rows.length ? await db.from("branches").select("id,name,timezone").eq("organization_id", m.organizationId).in("id", [...new Set(rows.map(stay => stay.branch_id))]) : { data: [], error: null };
  const branches = new Map((branchRows.data ?? []).map(branch => [branch.id, branch]));
  const financial = new Map((bills.data ?? []).map(row => [row.stay_id, Array.isArray(row.invoices) ? row.invoices[0] : row.invoices]));
  const write = canHospitality(m.role, "guestsWrite");
  return <main id="hospitality-guest-detail-page" className="mx-auto min-w-0 max-w-6xl"><PageHeader id="hospitality-guest-detail-header" eyebrow="Guest" title={guest.data.full_name} description={[guest.data.phone, guest.data.email].filter(Boolean).join(" · ") || "No contact provided"} action={write || canHospitality(m.role, "checkIn") ? <div className="flex flex-wrap gap-2">{write ? <Button asChild variant="secondary"><Link href={`/dashboard/customers?edit=${guestId}`}><Pencil size={16}/>Edit guest</Link></Button> : null}{canHospitality(m.role, "checkIn") ? <Button asChild><Link href={`/dashboard/hospitality/rooms?guest=${guestId}`}><Plus size={16}/>Choose room</Link></Button> : null}</div> : undefined}/><FormMessage {...q}/><section className="my-4 rounded-xl border border-admin-border bg-white p-4 text-sm shadow-sm"><p>{[guest.data.address_line, guest.data.city, guest.data.province].filter(Boolean).join(", ") || "No address provided"}</p><p className="mt-2 whitespace-pre-wrap">{guest.data.notes || "No profile notes"}</p></section><h2 className="mb-3 text-lg">Current and previous stays</h2>
    {stays.error || bills.error || branchRows.error ? <LoadError/> : <RecordTable id="hospitality-guest-stays" caption="Guest occupancy history" columns={[{ key: "room", label: "Room / stay" }, { key: "date", label: "Checked in", secondary: true }, { key: "status", label: "Occupancy", secondary: true }, ...(finance ? [{ key: "balance", label: "Financial status", align: "right" as const }] : [])]} rows={rows.map(s => { const bill = financial.get(s.id); const money = bill ? `${formatMoney(bill.balance_centavos, m.currency)} remaining · ${formatMoney(bill.paid_centavos, m.currency)} paid / ${formatMoney(bill.total_centavos, m.currency)} charges` : "No charges recorded"; return { id: `hospitality-guest-stay-${s.id}`, cells: { room: <RecordLink href={`/dashboard/hospitality/stays/${s.id}`}>{s.room_name_snapshot}</RecordLink>, date: dateLabel(s.checked_in_at, branches.get(s.branch_id)?.timezone ?? m.timezone), status: s.checked_out_at ? "Checked out" : "In house", balance: money }, mobile: <><p>{s.checked_out_at ? "Checked out" : "In house"} · {dateLabel(s.checked_in_at, branches.get(s.branch_id)?.timezone ?? m.timezone)}</p></> }; })}/>}<PageLinks page={page} count={stays.count ?? 0} href={p => `/dashboard/customers/${guestId}?page=${p}`}/>
  </main>;
}
