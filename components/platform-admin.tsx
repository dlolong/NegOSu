import Link from "next/link";
import { RecordTable } from "@/components/record-table";
import { DashboardChart } from "@/components/dashboard-chart";
import type { AdminOverview, AdminRow, AdminSection } from "@/modules/platform/admin-reader";

export const platformLinks = [
  ["", "Overview"], ["signups", "Signups"], ["businesses", "Businesses"],
  ["subscriptions", "Subscriptions"], ["payments", "Payments"], ["events", "Billing events"], ["plans", "Plan catalog"],
] as const;

export function PlatformAdminNavigation() {
  return <nav id="platform-admin-navigation" aria-label="Platform administration" className="my-5 flex flex-wrap gap-2">{platformLinks.map(([path, label]) => <Link id={`platform-admin-nav-${path || "overview"}`} key={path} href={`/admin${path ? `/${path}` : ""}`} className="rounded-lg border border-admin-border bg-admin-surface px-3 py-2 text-sm font-medium text-admin-text hover:bg-brand-tint">{label}</Link>)}</nav>;
}

export function PlatformOverview({ data, livemode }: { data: AdminOverview; livemode: boolean }) {
  const cards = [
    ["Registered accounts", data.users, "/admin/signups"],
    ["Businesses", data.businesses, "/admin/businesses"],
    ["Active businesses", data.activeBusinesses, "/admin/businesses?status=active"],
    ["Collected · 30 days", money(data.collected), `/admin/payments?status=paid&mode=${livemode ? "live" : "test"}`],
  ] as const;
  return <>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{cards.map(([label, value, href]) => <Link href={href} key={label} className="min-w-0 rounded-xl border border-admin-border bg-admin-surface p-4"><p className="text-xs text-admin-text-secondary">{label}</p><strong className="mt-2 block break-words text-base font-medium sm:text-2xl">{value}</strong></Link>)}</div>
    <section id="platform-admin-attention" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4"><h2 className="font-medium text-amber-950">Needs attention</h2><div className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm text-amber-950"><span>{data.unverifiedUsers} accounts awaiting email verification</span><Link id="admin-past-due-link" className="underline" href="/admin/subscriptions?status=past_due">{data.pastDue} past-due subscriptions</Link><Link id="admin-review-orders-link" className="underline" href={`/admin/payments?status=review&mode=${livemode ? "live" : "test"}`}>{data.reviewOrders} payments to review</Link><Link id="admin-webhook-errors-link" className="underline" href="/admin/events?status=error">{data.webhookErrors} billing event errors</Link></div></section>
    <div className="grid min-w-0 gap-4 lg:grid-cols-2"><DashboardChart id="admin-signups-chart" title="Account signups" description="Last 30 calendar days · UTC · Includes accounts without a business." points={data.signups}/><DashboardChart id="admin-payments-chart" title={`${livemode ? "Live" : "Test"} payment collections`} description="Last 30 calendar days · UTC · Paid PayMongo plan orders only; gross receipts, before fees or refunds." currency="PHP" points={data.payments}/></div>
    <DashboardChart id="admin-plans-chart" title="Subscription plan distribution" description="Stored subscription plans across all statuses. Expired or cancelled access may fall back to Free; this is not recurring revenue." points={data.plans}/>
  </>;
}

function value(row: AdminRow, key: string) { return row[key] == null ? "—" : String(row[key]); }
function date(input: unknown) { return input ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(String(input))) : "—"; }
function money(input: unknown) { return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(Number(input ?? 0) / 100); }
function organization(row: AdminRow) {
  const related = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
  return related && typeof related === "object" && "name" in related ? String(related.name) : value(row, "organization_id");
}

export function PlatformDirectory({ section, rows, baseHref }: { section: AdminSection; rows: AdminRow[]; baseHref?: string }) {
  const headers: Record<AdminSection, [string, string, string]> = {
    signups: ["Account", "Activity · UTC", "Verification"], businesses: ["Business", "Created · UTC", "Status"],
    subscriptions: ["Business / plan", "Period ends · UTC", "Status"], payments: ["Business / order", "Payment · UTC", "Amount / status"],
    events: ["Billing event", "Received · UTC", "Processing"], plans: ["Plan", "Annual price", "Monthly price"],
  };
  const [primary, detail, status] = headers[section];
  return <RecordTable id={`admin-${section}-table`} caption={primary} columns={[{ key: "primary", label: primary }, { key: "detail", label: detail, secondary: true }, { key: "status", label: status, align: "right" }]} rows={rows.map(row => {
    let title: string, subtitle: string, detail: React.ReactNode, status: React.ReactNode;
    const id = value(row, section === "subscriptions" ? "organization_id" : "id");
    switch (section) {
      case "signups": title = value(row, "email"); subtitle = value(row, "full_name"); detail = <>Joined {date(row.created_at)}<br/>Last sign-in {date(row.last_sign_in_at)}</>; status = row.email_confirmed_at ? "Verified" : "Unverified"; break;
      case "businesses": title = value(row, "name"); subtitle = `${value(row, "industry")} · ${value(row, "slug")}`; detail = date(row.created_at); status = value(row, "status"); break;
      case "subscriptions": title = organization(row); subtitle = `${value(row, "plan_id")} · ${value(row, "provider")} · ${value(row, "billing_interval")}`; detail = <>{date(row.current_period_end)}{row.cancel_at_period_end ? <p>Cancels at period end</p> : null}</>; status = value(row, "status"); break;
      case "payments": title = organization(row); subtitle = `${value(row, "plan_name")} · ${value(row, "billing_interval")} · ${value(row, "kind")}`; detail = <>Created {date(row.created_at)}<br/>Paid {date(row.paid_at)}</>; status = <>{money(row.amount_centavos)}<span className="block text-xs capitalize">{value(row, "status")} · {row.livemode ? "Live" : "Test"}</span></>; break;
      case "events": title = value(row, "event_type"); subtitle = value(row, "provider"); detail = date(row.created_at); status = value(row, "processing_status"); break;
      case "plans": title = value(row, "name"); subtitle = `${row.is_active ? "Active" : "Inactive"}${row.is_custom ? " · Custom" : ""}`; detail = row.yearly_price_centavos == null ? "Not offered" : money(row.yearly_price_centavos); status = money(row.monthly_price_centavos); break;
    }
    return { id: `admin-${section}-${id}`, cells: { primary: <><strong className="text-sm">{title}</strong><p className="mt-1 text-xs capitalize text-admin-text-secondary">{subtitle}</p><p className="mt-1 break-all font-mono text-[10px] text-admin-text-muted">{id}</p></>, detail, status: <><span className="text-xs capitalize">{status}</span>{baseHref && ["signups", "businesses", "subscriptions", "plans"].includes(section) ? <Link id={`admin-manage-${section}-${id}`} href={`${baseHref}&edit=${encodeURIComponent(id)}`} className="mt-2 block text-xs font-medium text-brand-primary underline">{section === "signups" || section === "businesses" ? "Delete" : "Edit"}</Link> : null}</> }, mobile: detail };
  })}/>;
}
