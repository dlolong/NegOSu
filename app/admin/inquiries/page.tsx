import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminPageNumber } from "@/modules/platform/admin-access";
import { ListTabs } from "@/components/list-tabs";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { closeInquiry } from "./actions";

type Query = { status?: string; page?: string; error?: string; message?: string };
export default async function InquiriesPage({ searchParams }: { searchParams: Promise<Query> }) {
  await requirePlatformAdmin();
  const query = await searchParams;
  const status = query.status === "closed" ? "closed" : "new";
  const page = adminPageNumber(query.page);
  const { data, error } = await createAdminClient().from("platform_inquiries")
    .select("id,name,email,subject,message,status,created_at").eq("status", status)
    .order("created_at", { ascending: false }).order("id").range((page - 1) * 20, page * 20);
  return <main id="admin-inquiries-page" className="min-w-0">
    <h1 className="text-2xl font-medium">Inquiries</h1><p className="mt-2 text-sm text-admin-text-secondary">Messages from the NegOSu contact page. Contact the sender using their email address, then close the inquiry.</p>
    <FormMessage error={error ? "Unable to load inquiries. Please try again." : query.error} message={query.message}/>
    <ListTabs id="admin-inquiries-tabs" baseHref="/admin/inquiries" query={{}} value={status} options={[{value:"new",label:"New"},{value:"closed",label:"Closed"}]}/>
    {!error ? <><div className="mt-5 space-y-3">{data?.slice(0,20).map(row => <article id={`admin-inquiry-${row.id}`} key={row.id} className="min-w-0 rounded-xl border border-admin-border bg-admin-surface p-4 [overflow-wrap:anywhere]">
      <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="font-medium">{row.subject}</h2><p className="mt-1 text-sm">{row.name} · <a id={`inquiry-email-${row.id}`} className="underline" href={`mailto:${encodeURIComponent(row.email)}`}>{row.email}</a></p><p className="mt-1 text-xs text-admin-text-secondary">{new Intl.DateTimeFormat("en-PH", {dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Manila"}).format(new Date(row.created_at))} · Philippine time</p></div>
      {row.status === "new" ? <form action={closeInquiry}><input type="hidden" name="id" value={row.id}/><SubmitButton id={`inquiry-close-${row.id}`} size="sm" variant="secondary" pendingText="Closing…">Close inquiry</SubmitButton></form> : null}</div>
      <details className="mt-3"><summary id={`inquiry-message-${row.id}`} className="cursor-pointer text-sm font-medium">Read message</summary><p className="mt-3 whitespace-pre-wrap text-sm">{row.message}</p></details>
    </article>)}</div>{!data?.length ? <p id="admin-inquiries-empty" className="mt-6 text-sm">No {status} inquiries.</p> : null}
    <nav id="admin-inquiries-pagination" aria-label="Inquiry pages" className="mt-5 flex items-center justify-between gap-3 text-sm">{page > 1 ? <Link id="inquiries-previous" href={`/admin/inquiries?status=${status}&page=${page-1}`} className="underline">Previous</Link> : <span/>}<span>Page {page}</span>{(data?.length ?? 0)>20 ? <Link id="inquiries-next" href={`/admin/inquiries?status=${status}&page=${page+1}`} className="underline">Next</Link> : <span/>}</nav></> : null}
  </main>;
}
