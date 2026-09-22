import { PlatformOverview } from "@/components/platform-admin";
import { loadAdminOverview } from "@/modules/platform/admin-reader";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const query = await searchParams;
  const livemode = query.mode !== "test";
  const data = await loadAdminOverview(livemode);
  return <main id="platform-admin-overview"><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-medium">Platform overview</h1><p className="mt-1 text-sm text-admin-text-secondary">Account growth, subscription activity, and billing attention.</p></div><form action="/admin" className="flex items-end gap-2"><label className="text-xs">Payment environment<select id="admin-overview-mode" name="mode" defaultValue={livemode ? "live" : "test"} className="mt-1 block rounded-lg border border-admin-border bg-admin-surface p-2 text-sm"><option value="live">Live payments</option><option value="test">Test payments</option></select></label><button id="admin-overview-apply" className="rounded-lg bg-brand-primary px-3 py-2 text-sm text-white">Apply</button></form></div><PlatformOverview data={data} livemode={livemode}/></main>;
}
