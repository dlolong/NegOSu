import { createRoot } from "react-dom/client";
import { PlatformAdminNavigation, PlatformOverview, PlatformDirectory } from "@/components/platform-admin";
import { DashboardChart } from "@/components/dashboard-chart";
const empty = new URLSearchParams(location.search).get("empty") === "1";
const points = Array.from({ length: 30 }, (_, index) => ({ label: `Sep ${index + 1}`, value: empty ? 0 : index % 7 * 100 }));
createRoot(document.getElementById("root")!).render(<>
  <h1>NegOSu Platform</h1><PlatformAdminNavigation/>
  <PlatformOverview livemode data={{ users: 120, businesses: 80, activeBusinesses: 72, unverifiedUsers: 4, pastDue: 2, reviewOrders: 1, webhookErrors: 3, collected: 129900, signups: points, payments: points, plans: [{ label: "Starter", value: 32 }, { label: "Free", value: 48 }] }}/>
  <PlatformDirectory section="signups" rows={empty ? [] : [{ id: "98100000-0000-4000-8000-000000000001", email: "long-account-name@example-business.local", full_name: "Example Account", created_at: "2026-09-22T00:00:00Z", last_sign_in_at: null, email_confirmed_at: null }]}/>
  <DashboardChart id="fixture-staff-chart" title="Appointment status" description="Current branch · Today" points={empty ? [] : [{ label: "confirmed", value: 5 }, { label: "in service", value: 3 }]}/>
</>);
