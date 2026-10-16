import { CommandCenter } from "@/components/command-center/command-center";
import { DashboardDiscovery } from "@/components/dashboard-discovery";
import { getDashboardContext } from "@/lib/auth/context";
import { getSharedCommandCenterSnapshot } from "@/modules/core/command-center/command-center.runtime";
import { getPetCommandCenter } from "@/modules/pet-care/command-center/runtime";

export async function PetOverview({ branch }: { branch?: string }) {
  const { activeMembership: m, profile } = await getDashboardContext();
  if (!["owner", "manager"].includes(m.role)) return null;
  let snapshot;
  try { snapshot = await getPetCommandCenter(await getSharedCommandCenterSnapshot(branch)); }
  catch { return <div id="pet-dashboard-error" role="alert" className="rounded-xl border p-4">Grooming activity could not be loaded. Open Appointments to continue working.</div>; }
  return <div id="pet-care-dashboard"><CommandCenter snapshot={snapshot} firstName={profile.fullName.split(" ")[0]} branches={m.branches} todayTitle="Today’s grooming" todayDescription="Pets, owners, services and assigned staff." todayVerticalId="pet-care-today" staffDescription="Active staff profiles in this view." discovery={<DashboardDiscovery/>} quickActions={[
      { id: "new-appointment", label: "Book appointment", primary: true, description: "Schedule grooming", href: "/dashboard/pet-care/appointments?dialog=create" },
      { id: "add-walk-in", label: "Add walk-in", primary: true, description: "Check in a pet", href: "/dashboard/pet-care/appointments?dialog=walk-in" },
      { id: "pets", label: "Pets", description: "Manage pets and owners", href: "/dashboard/pet-care/pets" },
    ]}/></div>;
}
