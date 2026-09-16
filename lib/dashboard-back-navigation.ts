/** Stable parent routes work for direct links and never depend on browser history. */
export function dashboardBackDestination(pathname: string, salon = false, industry?: string): { href: string; label: string } | null {
  const parts = pathname.replace(/\/$/, "").split("/").filter(Boolean);
  if (parts[0] !== "dashboard" || parts.length < 3) return null;
  const section = parts[1];
  if (section === "hospitality" && parts[2] === "stays" && parts[3]) {
    return parts[4] === "receipt" ? { href: `/dashboard/hospitality/stays/${parts[3]}?tab=charges`, label: "Back to stay" } : { href: "/dashboard/hospitality/rooms", label: "Back to rooms" };
  }
  // Salon appointment forms provide a Close control to the same destination.
  if (salon && section === "appointments" && (parts[2] === "new" || parts[3] === "edit")) return null;
  if (section === "settings") {
    if (parts.length > 3 && ["branches", "resources"].includes(parts[2])) return { href: `/dashboard/settings/${parts[2]}`, label: parts[2] === "branches" ? "Back to branches" : "Back to resources" };
    return { href: "/dashboard/settings", label: "Back to settings" };
  }
  const labels: Record<string, string> = { services: salon ? "treatments" : "services", customers: industry === "hospitality" ? "guests" : salon ? "clients" : "customers", vehicles: "vehicles", appointments: "appointments", queue: "queue", jobs: "Job Orders", estimates: "Job Orders", invoices: "payments" };
  if (!labels[section]) return null;
  // These pages already have explicit context-aware Back controls.
  if ((section === "customers" && parts[2] === "import") || (section === "jobs" && parts[3] === "work") || (section === "vehicles" && parts[3] === "history")) return null;
  if (parts.length > 3 && ["edit", "preferences"].includes(parts[3])) return { href: `/dashboard/${section}/${parts[2]}`, label: "Back to details" };
  const parent = section === "estimates" ? "jobs" : section === "invoices" ? "payments" : section;
  return { href: `/dashboard/${parent}`, label: `Back to ${labels[section]}` };
}
