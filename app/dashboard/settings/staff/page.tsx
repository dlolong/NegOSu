import { RecordTable } from "@/components/record-table";
import { ListTabs } from "@/components/list-tabs";
import { RecordLink } from "@/components/record-item";
import { X as XIcon, Plus } from "lucide-react";
import Link from "next/link";


import { revokeInvitation } from "@/app/dashboard/settings/staff/actions";
import { FormMessage } from "@/components/form-message";
import { FormDialog } from "@/components/management-ui";
import { PageHeader } from "@/components/page-patterns";
import {
  PermissionMatrix,
  StaffAccessForm,
  StaffDirectoryViews,
  StaffProfileForm,
  type StaffBranch,
  type StaffManagementIndustry,
  type StaffProfileRow,
} from "@/components/staff-management";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDashboardContext } from "@/lib/auth/context";
import { zonedDateTimeToUtc } from "@/lib/operations";
import { staffRoleLabelForIndustry } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import {
  listOperationalStaffDirectory,
  listStaffScheduleAssignments,
  loadStaffManagementDirectory,
  type StaffManagementDirectory,
  type StaffScheduleAssignment,
} from "@/modules/core/staff/staff.runtime";

type Params = {
  tab?: string;
  dialog?: "create" | "edit" | "access" | "view";
  staffId?: string;
  message?: string;
  error?: string;
  invite?: string;
};

type InvitationRow = {
  id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  created_at: string;
};

export default async function StaffPage({ searchParams }: { searchParams: Promise<Params> }) {
  const [parameters, { activeMembership }, supabase] = await Promise.all([searchParams, getDashboardContext(), createClient()]);
  const industry: StaffManagementIndustry = activeMembership.industry === "hospitality" ? "hospitality" : activeMembership.industry === "pet_care" ? "pet_care" : activeMembership.industry === "salon" ? "salon" : "automotive";
  const prefix = industry === "salon" ? "salon-staff" : "staff";

  if (activeMembership.role !== "owner" && industry === "salon") {
    return <SalonStaffDailySchedule organizationId={activeMembership.organizationId} branchId={activeMembership.branchId} branchName={activeMembership.branchName} timezone={activeMembership.timezone} selectedStaffId={parameters.staffId}/>;
  }
  if (activeMembership.role !== "owner") return <main id={`${prefix}-page`} className="mx-auto max-w-4xl"><PageHeader id={`${prefix}-page-header`} eyebrow="Organization team" title="Staff"/><Card className="mt-6 p-6">Only organization owners can manage Staff profiles and system access.</Card></main>;

  const window = localDayWindow(activeMembership.timezone);
  const [staffResult, branchResult, invitationResult, assignmentResult] = await Promise.all([
    loadStaffManagementDirectory(activeMembership.organizationId)
      .then((data) => ({ data, error: false }))
      .catch(() => ({ data: { items: [] as StaffProfileRow[], supportsIndependentProfiles: false } satisfies StaffManagementDirectory, error: true })),
    supabase.from("branches").select("id,name").eq("organization_id", activeMembership.organizationId).eq("is_active", true).order("name"),
    supabase.from("staff_invitations").select("id,email,role,status,expires_at,created_at").eq("organization_id", activeMembership.organizationId).order("created_at", { ascending: false }),
    industry === "hospitality" ? Promise.resolve({ data: [] as StaffScheduleAssignment[], error: false }) : listStaffScheduleAssignments({
      organizationId: activeMembership.organizationId,
      branchId: activeMembership.branchId,
      startsAt: window.start.toISOString(),
      endsAt: window.end.toISOString(),
    }).then((data) => ({ data, error: false })).catch(() => ({ data: [] as StaffScheduleAssignment[], error: true })),
  ]);
  const profileManagementAvailable = !staffResult.error && !branchResult.error && staffResult.data.supportsIndependentProfiles;
  const branches = (branchResult.data ?? []) as StaffBranch[];
  const schedules = scheduleByStaff(assignmentResult.data);
  const staff = staffResult.data.items.map((profile) => ({
    ...profile,
    branchIds: profile.branchIds ?? [],
    accessBranchIds: profile.accessBranchIds ?? [],
    specializations: profile.specializations ?? [],
    todayCount: schedules.get(profile.id)?.count ?? 0,
    nextAt: schedules.get(profile.id)?.next ?? null,
  }));
  const selected = staff.find(({ id }) => id === parameters.staffId);
  const selectionError = !profileManagementAvailable && parameters.dialog && parameters.dialog !== "view"
    ? "Staff changes are currently unavailable. Please try again or contact your administrator."
    : (parameters.dialog === "edit" || parameters.dialog === "access") && !selected
    ? "Staff profile not found."
    : parameters.dialog === "access" && selected?.role === "owner" ? "Owner system access is protected." : undefined;
  const loadError = staffResult.error || branchResult.error ? "Unable to load Staff profiles." : invitationResult.error || assignmentResult.error ? "Some Staff context could not be loaded." : undefined;

  return <main id={`${prefix}-page`} className="mx-auto min-w-0 max-w-7xl">
    <PageHeader id={`${prefix}-page-header`} eyebrow="Organization team" title="Staff" description="Manage operational Staff profiles independently from login access." action={profileManagementAvailable ? <Button id={`${prefix}-create-button`} asChild><Link href="/dashboard/settings/staff?dialog=create"><Plus size={17}/>Add Staff</Link></Button> : undefined}/>
    <FormMessage error={parameters.error ?? selectionError ?? loadError} message={parameters.message}/>
    {!staffResult.error && !staffResult.data.supportsIndependentProfiles ? <Card id={`${prefix}-compatibility-notice`} className="mt-5 border-status-warning/25 bg-status-warning-tint p-4 text-sm text-status-warning">Staff records are available in read-only mode. An administrator needs to complete the workspace setup to enable profile changes. Existing staff and system access remain unchanged.</Card> : null}
    {parameters.invite ? <Card id={`${prefix}-invitation-link`} className="mt-5 border-brand-border bg-brand-tint p-5"><h2 className="font-medium">Secure invitation link</h2><p className="mt-1 text-sm text-slate-600">Send this link only to the login email entered for this invitation. It expires automatically and can be used once.</p><code id={`${prefix}-invitation-link-value`} className="mt-3 block break-all rounded-lg bg-white p-3 text-sm">{parameters.invite}</code></Card> : null}

    <ListTabs id={`${prefix}-tabs`} baseHref="/dashboard/settings/staff" query={parameters} parameter="tab" value={parameters.tab==="invitations"?"invitations":"directory"} options={[{value:"directory",label:"Directory",count:staff.length},{value:"invitations",label:"Invitations",count:invitationResult.data?.length??0}]}/>
    {parameters.tab!=="invitations" ? <section id={`${prefix}-directory`} className="mt-4 min-w-0"><div><h2 className="font-medium">Staff directory</h2><p className="text-sm text-slate-600">Contact details are optional. Operational status and system access are managed separately.</p></div>{staffResult.error ? <p id={`${prefix}-load-error`} role="alert" className="mt-4 text-sm text-slate-600">The Staff directory could not be loaded. <Link href="/dashboard/settings/staff" className="font-medium underline">Try again</Link></p> : <StaffDirectoryViews staff={staff} branches={branches} timezone={activeMembership.timezone} industry={industry} prefix={prefix} managementAvailable={profileManagementAvailable}/>}</section> : <InvitationHistory invitations={(invitationResult.data ?? []) as InvitationRow[]} timezone={activeMembership.timezone} industry={industry} prefix={prefix}/>}

    <PermissionMatrix industry={industry} prefix={prefix}/>

    {parameters.dialog === "view" && selected ? <FormDialog id={`${prefix}-details-dialog`} title={selected.fullName} closeHref="/dashboard/settings/staff" size="md"><dl className="space-y-4 text-sm">{[["Function", selected.jobFunction || "Not set"], ["Specializations", selected.specializations.join(", ") || "Not set"], ["Status", selected.isActive ? "Active" : "Inactive"]].map(([label,value])=><div key={label}><dt className="text-admin-text-muted">{label}</dt><dd className="[overflow-wrap:anywhere]">{value}</dd></div>)}</dl></FormDialog> : null}
    {profileManagementAvailable && parameters.dialog === "create" ? <FormDialog id={`${prefix}-create-dialog`} title="Add Staff" description="Create an operational profile now. Email, mobile, and login access are optional." closeHref="/dashboard/settings/staff" size="lg"><StaffProfileForm branches={branches} industry={industry} prefix={`${prefix}-create`}/></FormDialog> : null}
    {profileManagementAvailable && parameters.dialog === "edit" && selected ? <FormDialog id={`${prefix}-edit-dialog`} title={`Edit ${selected.fullName}`} description="Profile and operational availability are independent from login access." closeHref="/dashboard/settings/staff" size="lg"><StaffProfileForm profile={selected} branches={branches} industry={industry} prefix={`${prefix}-edit`}/></FormDialog> : null}
    {profileManagementAvailable && parameters.dialog === "access" && selected && selected.role !== "owner" ? <FormDialog id={`${prefix}-access-dialog`} title={`${selected.membershipId ? "Manage" : "Grant"} system access`} description={`Set login permissions for ${selected.fullName} without changing the Staff profile.`} closeHref="/dashboard/settings/staff" size="md"><StaffAccessForm profile={selected} branches={branches} industry={industry} prefix={`${prefix}-access`}/></FormDialog> : null}
  </main>;
}

async function SalonStaffDailySchedule({ organizationId, branchId, branchName, timezone, selectedStaffId }: {
  organizationId: string;
  branchId: string;
  branchName: string;
  timezone: string;
  selectedStaffId?: string;
}) {
  const window = localDayWindow(timezone);
  const [staffResult, assignmentResult] = await Promise.all([
    listOperationalStaffDirectory(organizationId)
      .then((data) => ({ data, error: false }))
      .catch(() => ({ data: [], error: true })),
    listStaffScheduleAssignments({ organizationId, branchId, startsAt: window.start.toISOString(), endsAt: window.end.toISOString() })
      .then((data) => ({ data, error: false }))
      .catch(() => ({ data: [] as StaffScheduleAssignment[], error: true })),
  ]);
  const schedule = scheduleTimesByStaff(assignmentResult.data);
  const staff = staffResult.data.filter((profile) => !profile.branchIds.length || profile.branchIds.includes(branchId));
  const selected = staff.find(profile => profile.staffId === selectedStaffId);
  return <main id="salon-staff-page" className="mx-auto min-w-0 max-w-6xl"><PageHeader id="salon-staff-page-header" eyebrow={branchName} title="Staff daily schedule" description="Today’s Salon assignment context. Organization owners manage profiles and system access."/>
    <FormMessage error={staffResult.error || assignmentResult.error ? "Unable to load the Staff schedule." : undefined}/>
    <div id="salon-staff-today-schedule" className="mt-5"><RecordTable id="salon-staff-schedule-table" caption="Staff daily schedule" columns={[{key:"name",label:"Staff"},{key:"times",label:"Assigned times",secondary:true},{key:"count",label:"Visits",align:"right"}]} rows={staff.map(profile=>{const visits=schedule.get(profile.staffId)??[];return {id:`salon-staff-schedule-${profile.staffId}`,cells:{name:<><RecordLink id={`salon-staff-schedule-link-${profile.staffId}`} href={`/dashboard/settings/staff?staffId=${profile.staffId}`}>{profile.fullName}</RecordLink><p className="text-xs text-admin-text-secondary">{profile.jobFunction??"Staff"}</p></>,times:visits.length?visits.map(value=>formatTime(value,timezone)).join(" · "):"No assigned visits",count:visits.length},mobile:<p>{visits.length?visits.map(value=>formatTime(value,timezone)).join(" · "):"No assigned visits"}</p>};})}/></div>
    {selected ? <FormDialog id="salon-staff-schedule-dialog" title={selected.fullName} closeHref="/dashboard/settings/staff" size="md"><p className="text-sm text-admin-text-muted">{selected.jobFunction || "Staff"} · {branchName}</p><h3 className="mt-4 font-medium">Today&apos;s assigned visits</h3><ul className="mt-3 space-y-2">{(schedule.get(selected.staffId) ?? []).map((value,index)=><li key={`${value}-${index}`} className="rounded-xl border border-admin-border p-3 text-sm">{formatTime(value, timezone)}</li>)}</ul>{!schedule.get(selected.staffId)?.length ? <p className="mt-3 text-sm">No assigned visits today.</p> : null}</FormDialog> : null}
  </main>;
}

function InvitationHistory({ invitations, timezone, industry, prefix }: { invitations: InvitationRow[]; timezone: string; industry: StaffManagementIndustry; prefix: string }) {
  return <section id={`${prefix}-invitations`} className="mt-4 min-w-0"><h2 className="font-medium">System access invitations</h2><p className="mt-1 text-sm text-admin-text-secondary">Review invitations and revoke pending access when needed.</p><RecordTable id={`${prefix}-invitations-table`} className="mt-4" caption="System access invitations" empty="No system access invitations yet." columns={[{key:"email",label:"Login email"},{key:"role",label:"Role",secondary:true},{key:"expires",label:"Expires",secondary:true},{key:"action",label:"Status / action",align:"right"}]} rows={invitations.map(invitation=>({id:`${prefix}-invitation-${invitation.id}`,cells:{email:<strong>{invitation.email}</strong>,role:staffRoleLabelForIndustry(invitation.role,industry),expires:new Intl.DateTimeFormat("en-PH",{dateStyle:"medium",timeStyle:"short",timeZone:timezone}).format(new Date(invitation.expires_at)),action:<div className="space-y-2"><span className="text-xs capitalize">{invitation.status}</span>{invitation.status==="pending"&&<form action={revokeInvitation}><input type="hidden" name="invitationId" value={invitation.id}/><SubmitButton id={`${prefix}-revoke-invitation-${invitation.id}`} pendingText="Revoking…" variant="destructive" size="sm"><XIcon size={16} aria-hidden="true"/>Revoke</SubmitButton></form>}</div>},mobile:<><p>{staffRoleLabelForIndustry(invitation.role,industry)}</p><p>Expires {new Intl.DateTimeFormat("en-PH",{dateStyle:"medium",timeZone:timezone}).format(new Date(invitation.expires_at))}</p></>}))}/></section>;
}

function scheduleByStaff(rows: StaffScheduleAssignment[]) {
  const result = new Map<string, { count: number; next: string | null }>();
  for (const row of rows) {
    const appointment = row.appointment;
    if (!appointment?.starts_at) continue;
    const current = result.get(row.staffId) ?? { count: 0, next: null };
    current.count += 1;
    if (Date.parse(appointment.starts_at) > Date.now() && (!current.next || appointment.starts_at < current.next)) current.next = appointment.starts_at;
    result.set(row.staffId, current);
  }
  return result;
}

function scheduleTimesByStaff(rows: StaffScheduleAssignment[]) {
  const result = new Map<string, string[]>();
  for (const row of rows) {
    const appointment = row.appointment;
    if (!appointment?.starts_at) continue;
    result.set(row.staffId, [...(result.get(row.staffId) ?? []), appointment.starts_at].sort());
  }
  return result;
}

function localDayWindow(timezone: string) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
  const [year, month, day] = today.split("-").map(Number);
  const next = new Date(Date.UTC(year!, month! - 1, day! + 1));
  const nextDay = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
  return { start: zonedDateTimeToUtc(`${today}T00:00`, timezone)!, end: zonedDateTimeToUtc(`${nextDay}T00:00`, timezone)! };
}

function formatTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-PH", { timeZone: timezone, hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
