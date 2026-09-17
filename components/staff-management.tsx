
import { RecordTable } from "@/components/record-table";
import { RecordLink } from "@/components/record-item";
import { Plus as PlusIcon, Save as SaveIcon, KeyRound, Pencil, Info } from "lucide-react";

import { FormActions } from "@/components/form-actions";
import Link from "next/link";


import {
  createStaffProfileInvitation,
  saveStaffProfile,
  updateStaffProfileAccess,
} from "@/app/dashboard/settings/staff/actions";
import {
  staffAccessStatusLabel,
  staffContactLabel,
  staffJobFunctionSuggestions,
} from "@/app/dashboard/settings/staff/staff-forms";
import { SubmitButton } from "@/components/submit-button";
import { StaffBranchFieldset as BranchFieldset } from "@/components/staff-branch-fieldset";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { displayPhone } from "@/lib/crm";
import { staffRoleLabelForIndustry, staffRoleOptionsForIndustry } from "@/lib/rbac";
import type { StaffManagementItem } from "@/modules/core/staff";

export type StaffManagementIndustry = "automotive" | "salon" | "pet_care" | "hospitality";

export type StaffProfileRow = StaffManagementItem & {
  todayCount?: number;
  nextAt?: string | null;
};

export type StaffBranch = { id: string; name: string };

const automotivePermissions = [
  ["Owner", "Manage", "Manage", "Manage", "Manage", "Manage", "Manage"],
  ["Manager", "Manage", "Manage", "Manage", "Manage", "Manage", "Manage"],
  ["Service Advisor", "Manage", "Manage", "Manage", "—", "—", "—"],
  ["Technician", "Read", "—", "Assigned", "—", "—", "—"],
  ["Cashier", "Read", "—", "—", "Manage", "—", "—"],
  ["Viewer", "Read", "—", "—", "—", "—", "—"],
] as const;

const salonPermissions = [
  ["Owner", "Manage", "Manage", "Manage", "Manage", "Manage"],
  ["Manager", "Manage", "Manage", "Manage", "Manage", "Manage"],
  ["Front Desk / Coordinator", "Manage", "Manage", "Manage", "—", "—"],
  ["Service Provider", "Read", "Assigned", "Read", "—", "—"],
  ["Cashier", "Read", "—", "Read", "—", "—"],
  ["Viewer", "Read", "Read", "Read", "—", "—"],
] as const;

export function StaffProfileForm({ profile, branches, industry, prefix }: {
  profile?: StaffProfileRow;
  branches: StaffBranch[];
  industry: StaffManagementIndustry;
  prefix: string;
}) {
  const suggestions = staffJobFunctionSuggestions[industry];
  return <form id={`${prefix}-form`} action={saveStaffProfile} className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
    <input type="hidden" name="staffId" value={profile?.id ?? ""}/>
    <label className="text-sm font-medium sm:col-span-2">Full name <span aria-hidden="true">*</span>
      <Input id={`${prefix}-name-input`} name="fullName" required maxLength={120} defaultValue={profile?.fullName ?? ""} className="mt-2" autoComplete="name"/>
    </label>
    <label className="text-sm font-medium">Email <span className="font-normal text-slate-500">(optional)</span>
      <Input id={`${prefix}-email-input`} name="email" type="email" maxLength={254} defaultValue={profile?.email ?? ""} className="mt-2" autoComplete="email"/>
      <span className="mt-1 block text-xs font-normal text-slate-500">Optional — used for Staff notifications or account invitations when available.</span>
    </label>
    <label className="text-sm font-medium">Mobile <span className="font-normal text-slate-500">(optional)</span>
      <Input id={`${prefix}-mobile-input`} name="mobile" type="tel" inputMode="tel" maxLength={40} defaultValue={profile?.mobile ?? ""} placeholder="09xx xxx xxxx" className="mt-2" autoComplete="tel"/>
      <span className="mt-1 block text-xs font-normal text-slate-500">Optional — used for Staff notifications when available.</span>
    </label>
    <p className="-mt-2 text-xs text-slate-500 sm:col-span-2">Contact details are optional and do not create a login. System access is managed separately.</p>
    <label className="text-sm font-medium">Job function <span className="font-normal text-slate-500">(optional)</span>
      <Input id={`${prefix}-job-function-input`} name="jobFunction" list={`${prefix}-job-function-suggestions`} maxLength={80} defaultValue={profile?.jobFunction ?? ""} className="mt-2" placeholder={industry === "hospitality" ? "e.g. Receptionist" : industry === "pet_care" ? "e.g. Groomer" : industry === "salon" ? "e.g. Senior Stylist" : "e.g. Master Technician"}/>
      <datalist id={`${prefix}-job-function-suggestions`}>{suggestions.map((suggestion) => <option key={suggestion} value={suggestion}/>)}</datalist>
    </label>
    <label className="text-sm font-medium">Specialties <span className="font-normal text-slate-500">(optional)</span>
      <Input id={`${prefix}-specializations-input`} name="specializations" maxLength={1_000} defaultValue={profile?.specializations.join(", ") ?? ""} className="mt-2" placeholder={industry === "hospitality" ? "Guest service, supplies" : industry === "pet_care" ? "Coat care, nail trimming" : industry === "salon" ? "Hair color, facials" : "Diagnostics, electrical"}/>
    </label>
    <label className="text-sm font-medium">Operational status
      <select id={`${prefix}-status-select`} name="isActive" defaultValue={String(profile?.isActive ?? true)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3">
        <option value="true">Active</option><option value="false">Inactive</option>
      </select>
    </label>
    <div className="hidden sm:block"/>
    <BranchFieldset id={`${prefix}-branches`} branches={branches} selected={profile?.branchIds ?? []} label="Operational branches"/>
    <FormActions id={`${prefix}-actions`} cancelHref="/dashboard/settings/staff" cancelId={`${prefix}-cancel-button`}><SubmitButton id={`${prefix}-save-button`} pendingText="Saving…"><SaveIcon aria-hidden="true" size={16} className="shrink-0"/>{profile ? "Save profile" : "Add staff"}</SubmitButton></FormActions>
  </form>;
}

export function StaffAccessForm({ profile, branches, industry, prefix }: {
  profile: StaffProfileRow;
  branches: StaffBranch[];
  industry: StaffManagementIndustry;
  prefix: string;
}) {
  const roleOptions = staffRoleOptionsForIndustry(industry);
  const linked = Boolean(profile.membershipId);
  const selectedBranches = profile.accessBranchIds ?? [];
  if (!linked) return <form id={`${prefix}-form`} action={createStaffProfileInvitation} className="grid min-w-0 grid-cols-1 gap-4">
    <input type="hidden" name="staffId" value={profile.id}/>
    <label className="text-sm font-medium">Login email
      <Input id={`${prefix}-login-email-input`} name="loginEmail" type="email" required maxLength={254} defaultValue={profile.email ?? ""} className="mt-2" autoComplete="email"/>
      <span className="mt-1 block text-xs font-normal text-slate-500">This identifies the account that may accept the invitation. It can differ from the Staff contact email.</span>
    </label>
    <RoleSelect id={`${prefix}-role-select`} name="role" defaultValue={profile.role ?? "viewer"} industry={industry}/>
    <BranchFieldset id={`${prefix}-branches`} branches={branches} selected={selectedBranches} label="System access branches"/>
    <label className="text-sm font-medium">Invitation expires in
      <select id={`${prefix}-expiry-select`} name="expiresHours" defaultValue="72" className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3">
        <option value="24">24 hours</option><option value="72">3 days</option><option value="168">7 days</option>
      </select>
    </label>
    <FormActions id={`${prefix}-actions`} cancelHref="/dashboard/settings/staff" cancelId={`${prefix}-cancel-button`}><SubmitButton id={`${prefix}-save-button`} pendingText="Creating…"><PlusIcon aria-hidden="true" size={16} className="shrink-0"/>{profile.systemAccessStatus === "pending" ? "Replace invitation" : "Create invitation"}</SubmitButton></FormActions>
  </form>;

  return <form id={`${prefix}-form`} action={updateStaffProfileAccess} className="grid min-w-0 grid-cols-1 gap-4">
    <input type="hidden" name="staffId" value={profile.id}/>
    <RoleSelect id={`${prefix}-role-select`} name="role" defaultValue={profile.role ?? roleOptions[0]?.value ?? "viewer"} industry={industry}/>
    <label className="text-sm font-medium">System access status
      <select id={`${prefix}-status-select`} name="isActive" defaultValue={profile.systemAccessStatus === "active" ? "true" : "false"} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3">
        <option value="true">Active</option><option value="false">Disabled</option>
      </select>
      <span className="mt-1 block text-xs font-normal text-slate-500">This changes login access only. The Staff profile remains available according to its operational status.</span>
    </label>
    <BranchFieldset id={`${prefix}-branches`} branches={branches} selected={selectedBranches} label="System access branches"/>
    <FormActions id={`${prefix}-actions`} cancelHref="/dashboard/settings/staff" cancelId={`${prefix}-cancel-button`}><SubmitButton id={`${prefix}-save-button`} pendingText="Saving…"><SaveIcon aria-hidden="true" size={16} className="shrink-0"/>Save system access</SubmitButton></FormActions>
  </form>;
}

export function StaffDirectoryViews({ staff, branches, timezone, industry, prefix, managementAvailable = true }: {
  staff: StaffProfileRow[];
  branches: StaffBranch[];
  timezone: string;
  industry: StaffManagementIndustry;
  prefix: string;
  managementAvailable?: boolean;
}) {
  return <RecordTable id={industry === "salon" ? "salon-staff-table" : "staff-table"} caption="Staff directory" className="mt-4" empty="No staff profiles match this view." columns={[{key:"staff",label:"Staff"},{key:"function",label:industry === "hospitality" ? "Job function" : "Function / schedule",secondary:true},{key:"status",label:"Profile",secondary:true},{key:"access",label:"System access",secondary:true},{key:"actions",label:"Actions",align:"right"}]} rows={staff.map(profile=>({id:`${prefix}-row-${profile.id}`,cells:{
    staff:<><RecordLink id={`${prefix}-link-${profile.id}`} href={`/dashboard/settings/staff?dialog=${managementAvailable?"edit":"view"}&staffId=${profile.id}`}>{profile.fullName}</RecordLink><StaffContactLines profile={profile}/><small className="block text-admin-text-muted">{branchNames(profile.branchIds,branches)}</small></>,
    function:<><strong>{profile.jobFunction||"Not set"}</strong><p className="text-xs text-admin-text-muted">{profile.specializations.join(", ")}</p>{industry !== "hospitality" ? <p className="mt-1 text-xs">{profile.todayCount??0} appointments · {profile.nextAt?formatTime(profile.nextAt,timezone):"No upcoming visit"}</p> : null}</>,status:<ProfileStatus active={profile.isActive}/>,access:<AccessStatus id={`${prefix}-access-status-${profile.id}`} profile={profile} industry={industry}/>,actions:<StaffActions profile={profile} prefix={prefix} managementAvailable={managementAvailable}/>,
  },mobile:<><p>{profile.jobFunction||"Job function not set"}</p>{industry !== "hospitality" ? <p>{profile.todayCount??0} appointments · {profile.nextAt?formatTime(profile.nextAt,timezone):"No upcoming visit"}</p> : null}<ProfileStatus active={profile.isActive}/><AccessStatus id={`${prefix}-access-status-${profile.id}-mobile`} profile={profile} industry={industry}/></>}))}/>;
}

export function PermissionMatrix({ industry, prefix }: { industry: StaffManagementIndustry; prefix: string }) {
  const headings = industry === "hospitality" ? ["Access role", "Guests", "Check-in/out", "Charges & payments", "Inventory", "Settings"] : industry === "pet_care" ? ["Access role", "Pet owners", "Appointments", "Services", "Inventory", "Settings"] : industry === "salon" ? ["Access role", "Clients", "Appointments", "Treatments", "Inventory", "Settings"] : ["Access role", "Customers", "Appointments", "Jobs", "Finance", "Inventory", "Settings"];
  const rows = industry === "hospitality" ? [["Owner", "Manage", "Manage", "Manage", "Manage", "Manage"], ["Manager", "Manage", "Manage", "Manage", "Manage", "Business settings"], ["Front Desk", "Manage", "Manage", "View", "—", "—"], ["Operations Staff", "View", "View", "—", "—", "—"], ["Cashier", "View", "View", "Manage", "—", "—"], ["Viewer", "View", "View", "—", "—", "—"]] : industry !== "automotive" ? salonPermissions : automotivePermissions;
  return <aside id={`${prefix}-permission-matrix`} aria-labelledby={`${prefix}-permission-info-title`} className="mt-4 min-w-0 rounded-xl border border-admin-border bg-admin-surface-muted p-3 text-sm text-admin-text-secondary">
    <div className="flex items-start gap-2"><Info aria-hidden="true" size={16} className="mt-0.5 shrink-0"/><div className="min-w-0"><h2 id={`${prefix}-permission-info-title`} className="text-sm font-medium">About access permissions</h2><p className="mt-1 text-xs">Access roles control what staff can do in the system. They are separate from job functions and apply within assigned access branches.</p></div></div>
    <details id={`${prefix}-permission-details`} className="mt-2">
      <summary id={`${prefix}-permission-toggle`} className="min-h-11 cursor-pointer content-center text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary">View permission matrix</summary>
    <div className="mt-4 hidden overflow-hidden rounded-xl border md:block"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs normal-case text-slate-500"><tr>{headings.map((heading) => <th className="px-3 py-2" key={heading}>{heading}</th>)}</tr></thead><tbody className="divide-y">{rows.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td className="px-3 py-2" key={`${row[0]}-${index}`}>{cell}</td>)}</tr>)}</tbody></table></div>
    <div className="mt-3 grid gap-2 md:hidden">{rows.map((row) => <details className="rounded-xl border p-3" key={row[0]}><summary className="cursor-pointer font-medium">{row[0]}</summary><dl className="mt-2 grid grid-cols-2 gap-2 text-xs">{headings.slice(1).map((heading, index) => <div key={heading}><dt className="text-slate-500">{heading}</dt><dd className="font-medium">{row[index + 1]}</dd></div>)}</dl></details>)}</div>
    </details>
  </aside>;
}

function RoleSelect({ id, name, defaultValue, industry }: { id: string; name: string; defaultValue: string; industry: StaffManagementIndustry }) {
  return <label className="text-sm font-medium">Access role
    <select id={id} name={name} defaultValue={defaultValue} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3">{staffRoleOptionsForIndustry(industry).map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select>
    <span className="mt-1 block text-xs font-normal text-slate-500">Permissions are separate from the Staff job function.</span>
  </label>;
}

function StaffActions({ profile, prefix, managementAvailable }: { profile: StaffProfileRow; prefix: string; managementAvailable: boolean }) {
  const owner = profile.role === "owner";
  if (!managementAvailable) return <span id={`${prefix}-read-only-${profile.id}`} className="inline-flex min-h-9 items-center px-2 text-xs font-medium text-slate-500">Temporarily read-only</span>;
  return <div className="flex flex-wrap justify-end gap-2"><Button id={`${prefix}-edit-${profile.id}`} asChild size="sm" variant="secondary"><Link href={`/dashboard/settings/staff?dialog=edit&staffId=${profile.id}`}><Pencil size={14}/>Edit</Link></Button>{owner ? <span className="inline-flex min-h-9 items-center px-2 text-xs font-medium text-slate-500">Owner access protected</span> : <Button id={`${prefix}-access-${profile.id}`} asChild size="sm" variant="secondary"><Link href={`/dashboard/settings/staff?dialog=access&staffId=${profile.id}`}><KeyRound size={14}/>{profile.membershipId ? "Access" : "Grant access"}</Link></Button>}</div>;
}

function AccessStatus({ id, profile, industry }: { id: string; profile: StaffProfileRow; industry: StaffManagementIndustry }) {
  const status = profile.systemAccessStatus;
  const color = status === "active" ? "bg-emerald-100 text-emerald-800" : status === "pending" ? "bg-amber-100 text-amber-900" : "bg-slate-200 text-slate-700";
  return <div id={id}><span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${color}`}>{staffAccessStatusLabel(status)}</span><small className="mt-1 block text-slate-500">{profile.role ? staffRoleLabelForIndustry(profile.role, industry) : "No permission role"}</small></div>;
}

function ProfileStatus({ active }: { active: boolean }) {
  return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>{active ? "Active" : "Inactive"}</span>;
}

function StaffContactLines({ profile, mobile = false }: { profile: StaffProfileRow; mobile?: boolean }) {
  const className = mobile ? "block truncate font-medium" : "block text-slate-500";
  if (!profile.email && !profile.mobile) return <small className={className}>No contact details</small>;
  return <>
    <small className={className}>{staffContactLabel(profile.email, "No email")}</small>
    <small className={className}>{profile.mobile ? displayPhone(profile.mobile) : "No mobile"}</small>
  </>;
}

function branchNames(ids: string[], branches: StaffBranch[]) {
  if (!ids.length) return "All operational branches";
  return branches.filter((branch) => ids.includes(branch.id)).map((branch) => branch.name).join(", ") || "Restricted branches";
}

function formatTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-PH", { timeZone: timezone, hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
