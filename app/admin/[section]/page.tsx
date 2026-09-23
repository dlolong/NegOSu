import { PlatformAdminForm } from "@/components/platform-admin-form";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformDirectory } from "@/components/platform-admin";
import { adminSections, loadAdminDirectory, loadAdminPlanOptions, statusOptions, type AdminSection, type AdminQuery } from "@/modules/platform/admin-reader";

export default async function AdminDirectoryPage({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<AdminQuery> }) {
  const [{ section: rawSection }, query] = await Promise.all([params, searchParams]);
  if (!Object.hasOwn(adminSections, rawSection)) notFound();
  const section = rawSection as AdminSection;
  const data = await loadAdminDirectory(section, query);
  const base = `/admin/${section}`;
  const pageHref = (page: number) => `${base}?${new URLSearchParams({ page: String(page), q: data.term, status: data.status, mode: data.livemode ? "live" : "test" })}`;
  const selected = ["signups", "businesses", "subscriptions", "plans"].includes(section) ? data.rows.find(row => String(section === "subscriptions" ? row.organization_id : row.id) === query.edit) : undefined;
  const plans = selected && section === "subscriptions" ? await loadAdminPlanOptions() : [];
  const field = "mt-1 block w-full rounded-lg border border-admin-border bg-admin-surface p-2 text-sm";
  return <main id={`platform-admin-${section}`}><h1 className="text-2xl font-medium">{adminSections[section]}</h1><p className="mt-1 text-sm text-admin-text-secondary">{section === "payments" ? "PayMongo SaaS plan orders. Live and test orders are kept separate. Customer-service payments stay in their business workspace." : section === "events" ? "Provider billing events across live and test environments. Error details and provider payloads are withheld." : section === "subscriptions" ? "Stored subscription state across all businesses. Plan access can expire independently of the stored status." : "Platform-wide records. All timestamps are shown in UTC."}</p>
    <form id={`admin-${section}-filters`} action={base} className="my-4 flex flex-wrap items-end gap-3">
      {section === "signups" || section === "businesses" ? <label className="min-w-0 flex-1 text-xs sm:max-w-sm">{section === "signups" ? "Search email or name" : "Search business name"}<input id="admin-directory-search" className={field} name="q" maxLength={120} defaultValue={data.term}/></label> : null}
      {statusOptions[section].length ? <label className="text-xs">Status<select id="admin-directory-status" className={field} name="status" defaultValue={data.status}><option value="">All statuses</option>{statusOptions[section].map(status => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label> : null}
      {section === "payments" ? <label className="text-xs">Environment<select id="admin-directory-mode" className={field} name="mode" defaultValue={data.livemode ? "live" : "test"}><option value="live">Live</option><option value="test">Test</option></select></label> : null}
      {section !== "plans" ? <><button id="admin-directory-apply" className="rounded-lg bg-brand-primary px-4 py-2 text-sm text-white">Apply</button><Link id="admin-directory-reset" href={base} className="py-2 text-sm underline">Reset</Link></> : null}
    </form>
    <p id="admin-directory-count" className="mb-3 text-xs text-admin-text-secondary">{data.total.toLocaleString()} matching records · Page {data.page} of {Math.max(1, Math.ceil(data.total / 25))}</p>
    <PlatformDirectory section={section} rows={data.rows} baseHref={pageHref(data.page)}/>
    {selected ? <PlatformAdminForm section={section} row={selected} plans={plans} requestId={crypto.randomUUID()} closeHref={pageHref(data.page)}/> : null}
    <nav aria-label="Directory pages" className="mt-4 flex flex-wrap items-center justify-between gap-3">{data.page > 1 ? <Link id="admin-directory-previous" className="rounded-lg border border-admin-border px-4 py-2 text-sm" href={pageHref(data.page - 1)}>Previous</Link> : <span/>}{data.page * 25 < data.total ? <Link id="admin-directory-next" className="rounded-lg border border-admin-border px-4 py-2 text-sm" href={pageHref(data.page + 1)}>Next</Link> : null}</nav>
  </main>;
}
