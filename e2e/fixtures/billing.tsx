import { createRoot } from "react-dom/client";
import { BillingOverviewContent } from "@/components/billing-overview";
import type { BillingOverview } from "@/lib/billing/overview";
const mode = new URLSearchParams(location.search).get("mode") ?? "missing-setup";
const configured = mode === "configured";
const overview: BillingOverview = {
  plans: [{ id: "starter", name: "Starter", monthly_price_centavos: 49900, yearly_price_centavos: 499000, limits: { branches: 1, staff: 5, monthly_jobs: 250 }, features: { public_page: true }, is_custom: false, matchesCatalog: true, provider_monthly_price_id: configured ? "price_month" : null, provider_yearly_price_id: configured ? "price_year" : null }],
  subscription: null, effective: configured ? { planId: "free", planName: "Free", graceEndsAt: null } : null,
  catalogUnavailable: mode === "catalog-error", subscriptionUnavailable: mode === "subscription-error", paymentSetupAvailable: configured,
};
if (mode === "catalog-error" || mode === "empty") overview.plans = [];
createRoot(document.getElementById("root")!).render(<BillingOverviewContent overview={overview} organizationName="Example business" industry="salon" params={{}}/>);
