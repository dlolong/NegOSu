import React from "react";
import { createRoot } from "react-dom/client";
import { HospitalityReportFilters } from "@/components/hospitality/report-filters";
import { PageHeader } from "@/components/page-patterns";

const query = new URLSearchParams(location.search);
const mode = query.get("mode") === "report" ? "report" : query.get("mode") === "history" ? "history" : "payments";
const preset = query.get("preset") === "custom" ? "custom" : "month";
const start = query.get("start") ?? "2026-09-01", end = query.get("end") ?? "2026-09-18";
const filters = <HospitalityReportFilters mode={mode} section={query.get("section") ?? "collections"} branchName="Main branch" branches={[{ id: "main", name: "Main branch" }]} scope={{ filters: { preset, branch: "main", start, end }, branch: "main", range: { start, end } }}/>;

createRoot(document.getElementById("root")!).render(<div id="payment-fixture-scroll" className="h-[calc(100dvh-2rem)] overflow-y-auto">
  <PageHeader id="hospitality-payments-header" title="Payments" description="Guest collections and balances." action={mode === "payments" ? filters : undefined}/>
  {mode !== "payments" ? filters : null}
  <p id="payment-fixture-period" className="mt-4">Activity period: {start} to {end}</p>
  <button id="payment-fixture-outside" type="button" className="mt-4 min-h-11">Outside the filters</button>
  <div className="mt-4 h-[1200px] rounded-xl border bg-white p-4">Payment records</div>
</div>);
