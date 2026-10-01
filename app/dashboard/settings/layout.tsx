import { SettingsNavigation } from "@/components/settings-navigation";
import { getDashboardContext } from "@/lib/auth/context";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const { activeMembership } = await getDashboardContext();
  return <div id="settings-workspace" className="mx-auto w-full min-w-0 max-w-7xl space-y-6">
    <SettingsNavigation industry={activeMembership.industry}/>
    <div id="settings-workspace-content" className="min-w-0">{children}</div>
  </div>;
}
