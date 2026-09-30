import { CompactFilters } from "@/components/compact-filters";

import { Search as SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VehicleForm } from "@/components/crm-forms";
import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

export default async function Page({ searchParams }: { searchParams: Promise<{ customerId?: string; customerQ?: string; error?: string; warning?: string; duplicateId?: string }> }) {
  const [params, { activeMembership }, supabase] = await Promise.all([searchParams, getDashboardContext(), createClient()]);
  const customerQ = params.customerQ?.trim().replace(/[,%()]/g, " ").slice(0, 100);
  let query = supabase.from("customers").select("id,full_name").eq("organization_id", activeMembership.organizationId).eq("is_archived", false).order("full_name").limit(100);
  if (customerQ) query = query.or(`full_name.ilike.%${customerQ}%,phone.ilike.%${customerQ}%,email.ilike.%${customerQ}%`);
  const { data } = await query;
  return <main id="vehicle-create-page" className="mx-auto max-w-3xl"><p className="text-sm font-medium text-brand-primary">Vehicles</p><h1 className="mt-1 text-3xl font-medium">Add vehicle</h1><p className="mt-2 text-zinc-600">Only owner, make, and model are required.</p><CompactFilters id="vehicle-customer-search-form" searchLabel="Find a customer" search={<input id="vehicle-customer-search-input"  name="customerQ" defaultValue={params.customerQ} placeholder="Find customer by name, mobile, or email" type="search" enterKeyHint="search" className="min-h-11 w-full min-w-0 rounded-ui-md border border-admin-border bg-admin-surface px-3 py-2 text-sm"/>} searchValue={params.customerQ}><Button id="vehicle-customer-search-button" type="submit" variant="secondary"><SearchIcon aria-hidden="true" size={16} className="shrink-0"/>Find</Button></CompactFilters><div id="vehicle-create-form-container" className="mt-6"><VehicleForm customers={data ?? []} presetCustomerId={params.customerId} {...params}/></div></main>;
}
