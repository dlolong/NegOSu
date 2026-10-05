import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { staffRoleLabelForIndustry } from "@/lib/rbac";
import { loadStaffManagementDirectory } from "@/modules/core/staff/staff.runtime";
import { historyPage } from "@/modules/core/crm/client-reminders";
import { loadStaffWorkHistory, type StaffWork } from "@/modules/core/staff/work-history";
import { StaffWorkHistory } from "@/components/staff-work-history";
import { PageHeader } from "@/components/page-patterns";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { staffAccessStatusLabel } from "@/app/dashboard/settings/staff/staff-forms";

type Query = { q?: string; from?: string; to?: string; page?: string };
export default async function Page({ params, searchParams }: { params: Promise<{ staffId: string }>; searchParams: Promise<Query> }) {
  const [{ staffId }, query, { activeMembership: m }, db] = await Promise.all([params, searchParams, getDashboardContext(), createClient()]);
  // Staff management remains owner-only, including its private contact details.
  if (!z.uuid().safeParse(staffId).success || m.role !== "owner") notFound();
  const [directory, branches] = await Promise.all([
    loadStaffManagementDirectory(m.organizationId).catch(() => null),
    db.from("branches").select("id,name").eq("organization_id", m.organizationId),
  ]);
  const back = <Button asChild variant="ghost"><Link id="staff-detail-back" href="/dashboard/settings/staff">Back to Staff</Link></Button>;
  if (!directory) return <main><PageHeader id="staff-detail-error-header" title="Staff details" back={back}/><p role="alert">Staff details could not be loaded. Please try again.</p></main>;
  const staff = directory.items.find(item => item.id === staffId);
  if (!staff) notFound();
  const page = historyPage(query.page);
  const history = await loadStaffWorkHistory(db, m, staffId, page, query);
  const branchNames = !staff.branchIds.length ? "All operational branches" : (branches.data ?? []).filter(b => staff.branchIds.includes(b.id)).map(b => b.name).join(", ") || "Branch details unavailable";
  return <main id="staff-detail-page" className="mx-auto min-w-0 max-w-5xl [overflow-wrap:anywhere]">
    <PageHeader id="staff-detail-header" title={staff.fullName} description={staff.jobFunction || "Staff profile"} back={back} action={directory.supportsIndependentProfiles ? <Button asChild variant="secondary"><Link id="staff-detail-edit" href={`/dashboard/settings/staff?dialog=edit&staffId=${staff.id}`}>Edit staff</Link></Button> : undefined}/>
    <Card id="staff-details" className="mt-4 grid min-w-0 gap-5 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:p-5">
      <div className="flex flex-col items-center justify-center rounded-xl bg-brand-tint p-6 text-center"><span aria-hidden="true" className="flex size-20 items-center justify-center rounded-full bg-white text-2xl font-medium text-brand-primary-strong">{staff.fullName.split(/\s+/).slice(0, 2).map(word => word[0]).join("")}</span><p className="mt-3 font-medium">{staff.fullName}</p><p className="mt-1 text-sm text-admin-text-secondary">{staff.isActive ? "Active" : "Inactive"}</p></div>
      <div><dl className="grid gap-4 text-sm sm:grid-cols-2">{[
        ["Job function", staff.jobFunction || "Not set"], ["Specialties", staff.specializations.join(", ") || "Not set"],
        ["Email", staff.email || "Not provided"], ["Mobile", staff.mobile || "Not provided"],
        ["Work locations", branches.error ? "Could not load locations" : branchNames], ["System access", staffAccessStatusLabel(staff.systemAccessStatus)],
        ["Access role", staff.role ? staffRoleLabelForIndustry(staff.role, m.industry) : "No login role"],
      ].map(([label, value]) => <div key={label}><dt className="text-admin-text-secondary">{label}</dt><dd className="font-medium">{value}</dd></div>)}</dl></div>
    </Card>
    <StaffWorkHistory staffId={staffId} branchName={m.branchName} industry={m.industry} timezone={m.timezone} query={query} page={page} rows={(history.data ?? []) as StaffWork[]} error={Boolean(history.error)}/>
  </main>;
}
