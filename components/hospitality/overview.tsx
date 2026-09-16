import Link from "next/link";
import { redirect } from "next/navigation";
import { CommandCenter } from "@/components/command-center/command-center";
import { getSharedCommandCenterSnapshot } from "@/modules/core/command-center/command-center.runtime";
import { hospitalityContext, loadHospitalityWorkspace } from "@/modules/hospitality/runtime";
import { resolveReportRange, reportQuerySchema } from "@/lib/reporting";
import { LoadError } from "./shared";
export async function HospitalityOverview({ branch }: { branch?: string }) {
  const { activeMembership: m, profile, db } = await hospitalityContext();
  if (!["owner", "manager"].includes(m.role)) redirect("/dashboard/hospitality/rooms");
  let shared; let staffError = false;
  try {
    shared = await getSharedCommandCenterSnapshot(branch);
    const range = resolveReportRange(reportQuerySchema.parse({ preset: "today" }), m.timezone);
    const report = await loadHospitalityWorkspace({ branch: shared.scope.mode === "all" ? null : shared.scope.selectedBranchId, ...range, section: "stays", mode: "overview" });
    const staff = await db.from("organization_staff_profiles").select("id,full_name,job_function").eq("organization_id", m.organizationId).eq("is_active", true).limit(10);
    shared.metrics = [
      { key: "occupied", label: "Occupied now", value: report.occupied, valueKind: "count" },
      { key: "vacant", label: "Available now", value: report.vacant, valueKind: "count", href: "/dashboard/hospitality/rooms" },
      { key: "cleaning", label: "Cleaning now", value: report.cleaning, valueKind: "count", href: "/dashboard/hospitality/rooms" },
      { key: "check_ins", label: "Check-ins today", value: report.checkIns, valueKind: "count" },
      { key: "check_outs", label: "Checkouts today", value: report.checkOuts, valueKind: "count" },
      ...(report.finance ? [
        { key: "collections", label: "Collected today", value: report.finance.collected, valueKind: "currency" as const, href: "/dashboard/payments?section=collections&preset=today" },
        { key: "outstanding", label: "Outstanding now", value: report.finance.outstanding, valueKind: "currency" as const, href: "/dashboard/payments" },
      ] : []),
    ];
    shared.actions = [
      ...(report.finance?.checkedOutDebt ? [{ id: "checkout-balances", code: "outstanding", priority: "medium" as const, title: `${report.finance.checkedOutDebt} checked-out stay(s) with balances`, description: "Guest balances remain collectible after checkout.", href: "/dashboard/payments" }] : []),
      ...(report.lowStock ? [{ id: "low-stock", code: "low_stock", priority: "medium" as const, title: `${report.lowStock} low-stock product(s)`, description: "Review shared inventory and restock supplies.", href: "/dashboard/inventory" }] : []),
    ];
    shared.operations = report.rows.slice(0, 10).map(row => ({ id: String(row.id), title: String(row.room), subject: String(row.guest), startsAt: String(row.checked_in_at), status: row.checked_out_at ? "checked_out" : "in_house", href: `/dashboard/hospitality/stays/${row.id}`, branchId: String(row.branch_id) }));
    shared.staff = (staff.data ?? []).map(s => ({ id: s.id, displayName: s.full_name, status: "active", context: s.job_function ?? "Staff profile", href: "/dashboard/settings/staff" }));
    shared.branchTimezones = Object.fromEntries(shared.branchPerformance.map(b => [b.branchId, b.timezone]));
    shared.branchPerformance = [];
    staffError = Boolean(staff.error);
  } catch { return <LoadError>Unable to load Overview. Open Rooms to continue front-desk work.</LoadError>; }
    return <div id="hospitality-overview-page"><CommandCenter snapshot={shared} organizationName={m.organizationName} firstName={profile.fullName.split(" ")[0]} branches={m.branches} todayTitle="In house and today’s activity" todayDescription="Current stays plus check-ins and checkouts today." todayVerticalId="hospitality-overview-stays" staffDescription="Active staff profiles. No live attendance tracking. Room cleaning status is managed in Rooms." sectionErrors={staffError ? { staff: "Staff profiles could not be loaded." } : {}} quickActions={[{ id: "rooms", label: "Rooms", description: "Check in or view occupancy", href: "/dashboard/hospitality/rooms" }, { id: "guests", label: "Guests", description: "Manage guest profiles", href: "/dashboard/customers" }, { id: "payments", label: "Payments", description: "Record guest collections", href: "/dashboard/payments" }]}/><HospitalitySetup/></div>;
}
export function HospitalitySetup() {
  return <section id="hospitality-setup-checklist" className="mx-auto mt-4 max-w-7xl rounded-xl border border-admin-border bg-white p-4 shadow-sm"><h2 className="text-lg">Get started · Apartelle & Inn</h2><p className="mt-1 text-sm text-slate-500">Configure room rates, then select the stay period and collect payment at check-in. Guest details are optional.</p><ol className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">{[["Business & branches", "/dashboard/settings/branches"], ["Add rooms", "/dashboard/hospitality/rooms?dialog=room"], ["Add staff", "/dashboard/settings/staff"], ["Choose a room, collect payment & check in", "/dashboard/hospitality/rooms"], ["Review reports", "/dashboard/reports"], ["Set up inventory (optional)", "/dashboard/inventory"]].map(([label, href], i) => <li key={href}><Link className="block rounded-lg border border-slate-200 p-3 text-brand-primary hover:bg-slate-50" href={href}>{i + 1}. {label}</Link></li>)}</ol></section>;
}
