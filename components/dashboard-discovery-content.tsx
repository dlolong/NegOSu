import Link from "next/link";
import { ArrowUpRight, Bell, Globe, Sparkles } from "lucide-react";
import type { dashboardFeaturePreviews, publicWebsiteSummary } from "@/lib/dashboard-discovery";
import { Badge } from "@/components/ui/badge";

export function DashboardDiscoveryContent({ website, canManage, features, acceptsBookings = true }: {
  acceptsBookings?: boolean;
  website: ReturnType<typeof publicWebsiteSummary> | null;
  canManage: boolean;
  features: ReturnType<typeof dashboardFeaturePreviews>;
}) {
  const published = website?.status === "published";
  return <section id="dashboard-discovery" aria-label="Your website and useful features" className="grid min-w-0 gap-3">
    <Link id="dashboard-reminders-shortcut" href="/dashboard/customers/reminders?status=scheduled" className="flex min-w-0 items-center gap-3 rounded-xl border border-admin-border bg-admin-surface p-4 hover:bg-brand-tint focus-visible:ring-2 focus-visible:ring-brand-primary">
      <Bell size={20} aria-hidden="true" className="shrink-0 text-brand-primary"/>
      <span className="min-w-0 flex-1"><span className="block font-medium text-admin-text">Reminders</span><span className="block text-sm text-admin-text-secondary">View all scheduled client follow-ups.</span></span>
      <ArrowUpRight size={17} aria-hidden="true" className="shrink-0 text-brand-primary"/>
    </Link>
    {website ? <div id="dashboard-public-website" className="min-w-0 rounded-xl border border-brand-border bg-brand-tint/40 p-4">
      <div className="flex flex-wrap items-center gap-2"><Globe size={18} aria-hidden="true" className="text-brand-primary"/><h2 className="font-medium text-admin-text">Your public website</h2><Badge id="dashboard-website-status" variant={published ? "success" : "neutral"}>{published ? "Published" : website.status === "draft" ? "Not published" : website.status === "inactive" ? "Not available" : "Status unavailable"}</Badge></div>
      <p className="mt-2 text-sm text-slate-600">{published ? (acceptsBookings ? "Share your services and let customers request a booking online." : "Share your property, photos, locations and contact details with guests.") : website.status === "draft" ? (acceptsBookings ? "Give customers a place to discover your services and request a booking." : "Give guests a place to discover your property and contact you about a stay.") : website.status === "inactive" ? "Your website is unavailable while your business account is inactive." : "We couldn’t check publication status. Open website settings to try again."}</p>
      <div id="dashboard-website-url" className="mt-2 text-sm font-medium text-admin-text [overflow-wrap:anywhere]">{published ? <a id="dashboard-website-public-link" href={website.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{website.url}<span className="sr-only"> (opens in a new tab)</span></a> : <><span className="font-normal text-slate-600">Website address: </span>{website.url}</>}</div>
      {canManage ? <Link id="dashboard-website-settings-link" href="/dashboard/settings/public-page" className="mt-3 inline-flex min-h-10 items-center gap-1 text-sm font-medium text-brand-primary-strong underline underline-offset-4">{website.status === "draft" ? "Set up your website" : "Manage website"}<ArrowUpRight size={16} aria-hidden="true"/></Link> : !published ? <p className="mt-2 text-sm text-slate-600">Your owner or manager can manage this website.</p> : null}
    </div> : null}
    {features.length ? <div className="min-w-0 rounded-xl border border-admin-border bg-admin-surface p-4"><h2 className="flex items-center gap-2 font-medium text-admin-text"><Sparkles size={18} aria-hidden="true" className="text-brand-primary"/>More you can do</h2><div className="mt-1 divide-y divide-admin-border">{features.map(feature => <Link id={`dashboard-discover-${feature.key}`} key={feature.key} href={feature.href} className="group flex min-h-12 items-center gap-3 rounded-lg py-2 hover:bg-slate-50"><span className="min-w-0 flex-1"><span className="block text-sm font-medium text-admin-text">{feature.label}</span><span className="block text-xs text-slate-600">{feature.description}</span></span><ArrowUpRight size={17} aria-hidden="true" className="shrink-0 text-brand-primary"/></Link>)}</div></div> : null}
  </section>;
}
