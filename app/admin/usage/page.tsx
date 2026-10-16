import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { creditUsageSchema } from "@/modules/platform/credits";
import { Button } from "@/components/ui/button";

export default async function UsagePage({ searchParams }: { searchParams: Promise<{ organization?: string; q?: string }> }) {
  await requirePlatformAdmin();
  const query = await searchParams, db = createAdminClient();
  const term = (query.q ?? "").trim().slice(0, 80).replace(/[%_\\]/g, "");
  const organizations = await db.from("organizations").select("id,name").ilike("name", `%${term}%`).order("name").limit(25);
  const selected = z.uuid().safeParse(query.organization);
  const result = selected.success ? await db.rpc("platform_credit_usage", { p_org: selected.data }) : null;
  const usage = creditUsageSchema.safeParse(result?.data);
  return <main id="platform-credit-usage" className="mt-5 space-y-4"><h1 className="text-xl font-medium">Business usage credits</h1><p className="text-sm">View balances and configured allowances. No balance adjustments are available here.</p>
    <form className="flex flex-wrap gap-2"><label>Find a business<input id="platform-credit-search" name="q" defaultValue={term} className="ml-2 rounded border p-2"/></label><Button id="platform-credit-search-button">Search</Button></form>
    <form className="flex flex-wrap gap-2"><input type="hidden" name="q" value={term}/><label>Business<select id="platform-credit-business" name="organization" defaultValue={selected.success ? selected.data : ""} className="ml-2 max-w-full rounded border p-2"><option value="">Choose a business</option>{organizations.data?.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}</select></label><Button id="platform-credit-view">View usage</Button></form>
    {organizations.error || result?.error ? <p role="alert">Usage could not be loaded.</p> : null}
    {usage.success ? <section id="platform-credit-balance" className="rounded border bg-white p-4"><p>Plan: {String(result?.data?.plan ?? "Unknown")}</p><p>{usage.data.remaining} available · {usage.data.reserved} reserved</p><p>{usage.data.oneTimeRemaining} one-time credits remaining</p><p>Status: {usage.data.status}</p>{usage.data.nextRefresh ? <p>Period allowance: {usage.data.monthlyAllowance} · Ends {usage.data.nextRefresh.slice(0,10)}</p> : <p>Recurring allowance is not configured.</p>}</section> : null}
  </main>;
}
