import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { notFound } from "next/navigation";
import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { roleHasPermission } from "@/lib/rbac";
import { PageHeader } from "@/components/page-patterns";
import { ListTabs } from "@/components/list-tabs";
import { RecordTable } from "@/components/record-table";
import { RecordLink } from "@/components/record-item";
import { FormDialog } from "@/components/management-ui";
import { Button } from "@/components/ui/button";
import { ConversationActions, InboxRefresh } from "./conversation";

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ tab?: string; conversation?: string; page?: string }> }) {
  const [query, { activeMembership }, db] = await Promise.all([searchParams, getDashboardContext(), createClient()]);
  if (!roleHasPermission(activeMembership.role, "appointments.manage")) notFound();
  const tab = ["needs_reply", "open", "closed"].includes(query.tab ?? "") ? query.tab! : "needs_reply";
  const page = Math.min(1000, Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1));
  const now = new Date().toISOString();
  const fields = "id,customer_name,status,needs_reply,customer_message_count,updated_at,expires_at";
  let request = db.from("customer_conversations").select(fields, { count: "exact" }).eq("organization_id", activeMembership.organizationId).eq("branch_id", activeMembership.branchId);
  if (tab === "closed") request = request.or(`status.eq.closed,expires_at.lte.${now}`);
  else { request = request.eq("status", "open").gt("expires_at", now); if (tab === "needs_reply") request = request.eq("needs_reply", true); }
  const result = await request.order("updated_at", { ascending: false }).range((page - 1) * 30, page * 30 - 1);
  const selectedId = /^[a-f0-9-]{36}$/i.test(query.conversation ?? "") ? query.conversation! : null;
  const selected = selectedId ? await db.from("customer_conversations").select(fields).eq("id", selectedId).eq("organization_id", activeMembership.organizationId).eq("branch_id", activeMembership.branchId).maybeSingle() : null;
  const messages = selected?.data ? await db.from("customer_chat_messages").select("id,sender,body,created_at").eq("conversation_id", selected.data.id).order("created_at").order("id").limit(53) : null;
  const href = `/dashboard/inbox?tab=${tab}&page=${page}`;
  return <main id="customer-inbox-page" className="mx-auto min-w-0 max-w-6xl">
    <PageHeader id="customer-inbox-header" eyebrow={activeMembership.branchName} title="Customer inbox" description="Answer website questions and help customers book an appointment." action={<InboxRefresh/>}/>
    <ListTabs id="customer-inbox-tabs" baseHref="/dashboard/inbox" query={{}} value={tab} parameter="tab" options={[{ value: "needs_reply", label: "Needs reply" }, { value: "open", label: "Open" }, { value: "closed", label: "Closed" }]}/>
    {result.error ? <p id="customer-inbox-error" role="alert" className="mt-5 rounded-ui-md border border-admin-border p-5">The inbox could not be loaded. Please refresh or check that the chat database update is installed.</p> : <div className="mt-4"><RecordTable id="customer-inbox-table" caption="Customer conversations" empty="No conversations in this tab." columns={[{ key: "customer", label: "Customer" }, { key: "status", label: "Status" }, { key: "updated", label: "Last activity", secondary: true }]} rows={(result.data ?? []).map(row => ({ id: `inbox-row-${row.id}`, cells: { customer: <RecordLink id={`inbox-conversation-${row.id}`} href={`${href}&conversation=${row.id}`}>{row.customer_name}</RecordLink>, status: row.expires_at <= now ? "Expired" : row.status === "closed" ? "Closed" : row.needs_reply ? "Needs reply" : "Replied", updated: new Date(row.updated_at).toLocaleString("en-PH", { timeZone: activeMembership.timezone ?? "Asia/Manila" }) } }))}/><nav aria-label="Inbox pages" className="mt-4 flex justify-end gap-2">{page > 1 ? <Button asChild variant="secondary"><Link href={`/dashboard/inbox?tab=${tab}&page=${page - 1}`}><ChevronLeft size={16} aria-hidden="true"/>Previous</Link></Button> : null}{page * 30 < (result.count ?? 0) ? <Button asChild variant="secondary"><Link href={`/dashboard/inbox?tab=${tab}&page=${page + 1}`}>Next<ChevronRight size={16} aria-hidden="true"/></Link></Button> : null}</nav></div>}
    {selectedId ? <FormDialog id="inbox-conversation-dialog" title={selected?.data?.customer_name ?? "Conversation unavailable"} closeHref={href} size="md">{selected?.data && !messages?.error ? <><section id="inbox-messages" aria-label="Conversation" className="space-y-3">{messages?.data?.map(message => <article key={message.id} className={`rounded-ui-lg p-3 text-sm ${message.sender === "staff" ? "ml-6 bg-brand-tint" : "mr-6 bg-admin-surface-muted"}`}><p className="mb-1 text-xs font-semibold">{message.sender === "staff" ? "Your team" : selected.data?.customer_name}</p><p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{message.body}</p></article>)}</section><ConversationActions key={selected.data.id} id={selected.data.id} status={selected.data.status} expired={selected.data.expires_at <= now}/></> : <p role="alert">This conversation could not be loaded in the current branch.</p>}</FormDialog> : null}
  </main>;
}
