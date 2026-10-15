import { createRoot } from "react-dom/client";
import { ClientPurchases } from "@/components/reports/client-purchases";
import { clientPurchaseQuerySchema, type ClientPurchaseReport } from "@/modules/core/reporting/client-purchase-report";
const params = Object.fromEntries(new URLSearchParams(location.search));
document.getElementById("root")!.className = "mx-auto max-w-7xl min-w-0 p-4";
const filters = clientPurchaseQuerySchema.parse(params);
const report: ClientPurchaseReport = {
  count: 51, summary: { records: 60, total: 150000, paid: 100000, balance: 50000 },
  rows: [{ key: "client", clientId: "81000000-0000-4000-8000-000000000001", name: "Alex with a long client name", lastActivity: "2026-10-15", records: 2, branches: ["Main", "Second branch"], total: 15000, paid: 10000, balance: 5000, staff: params.unassigned ? [] : [{ id: "81000000-0000-4000-8000-000000000002", name: "Jamie Cruz" }, { id: "81000000-0000-4000-8000-000000000003", name: "Taylor Santos" }], items: [
    { kind: "service", name: "Premium treatment", quantity: 1, unit: "", included: false },
    { kind: "product", name: "Care oil", quantity: 1.5, unit: "bottle", included: false },
    { kind: "product", name: "Promo sample", quantity: 1, unit: "piece", included: true },
  ] }],
};
createRoot(document.getElementById("root")!).render(<ClientPurchases filters={filters} range={{ start: filters.start ?? "2026-10-01", end: filters.end ?? "2026-10-15" }} branches={[{ id: "81000000-0000-4000-8000-000000000001", name: "Main" }]} currency="PHP" report={params.empty ? { count: 0, summary: { records: 0, total: 0, paid: 0, balance: 0 }, rows: [] } : report}/>);
