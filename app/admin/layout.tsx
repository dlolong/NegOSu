import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { PlatformAdminNavigation } from "@/components/platform-admin";
import { signOut } from "@/app/auth/actions";
import { SubmitButton } from "@/components/submit-button";

export const metadata = { title: "Platform Admin | NegOSu", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformAdmin();
  return <div className="min-h-screen bg-admin-canvas text-admin-text"><div className="mx-auto max-w-7xl p-4 sm:p-6"><header className="flex flex-wrap items-center justify-between gap-3 border-b border-admin-border pb-4"><div><Link id="platform-admin-home" href="/admin" className="text-xl font-semibold">NegOSu <span className="text-brand-primary">Platform</span></Link><p className="mt-1 text-xs text-admin-text-secondary">SaaS administration · Read-only oversight</p></div><div className="flex flex-wrap items-center gap-3"><Link id="platform-admin-workspace" href="/dashboard" className="text-sm underline">Business workspace</Link><form action={signOut}><SubmitButton id="platform-admin-sign-out" variant="secondary" size="sm" pendingText="Signing out…">Sign out</SubmitButton></form></div></header><PlatformAdminNavigation/>{children}</div></div>;
}
