import React from "react";
import { createRoot } from "react-dom/client";
import { HospitalityReportFilters } from "@/components/hospitality/report-filters";
import { PaymentsLayout } from "@/components/payments-layout";
import { RecordTable } from "@/components/record-table";
import { Tabs } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-patterns";

const query = new URLSearchParams(location.search);
const mode = query.get("mode") === "report" ? "report" : query.get("mode") === "history" ? "history" : "payments";
const preset = query.get("preset") === "custom" ? "custom" : "30d";
const start = query.get("start") ?? "2026-09-01", end = query.get("end") ?? "2026-09-18";
const filters = <HospitalityReportFilters advanced={true} mode={mode} section={query.get("section") ?? "collections"} branchName="Main branch" branches={[{ id: "main", name: "Main branch" }]} scope={{ filters: { preset, branch: "main", start, end }, branch: "main", range: { start, end } }}/>;

const records = <><button id="payment-fixture-outside" type="button" className="mt-4 min-h-11">Outside the filters</button><RecordTable reportSearch id="fixture-payments-table" caption="Payments" columns={[{key:"name",label:"Guest"},{key:"amount",label:"Amount"}]} rows={[{id:"ana",cells:{name:"Ana",amount:"₱100.00"}},{id:"ben",cells:{name:"Ben",amount:"₱200.00"}}]}/><div className="h-[1200px]">Payment records</div></>;
createRoot(document.getElementById("root")!).render(<div id="payment-fixture-scroll" className="h-[calc(100dvh-2rem)] overflow-y-auto">
 {mode === "payments" ? <PaymentsLayout id="hospitality-payments-page" headerId="hospitality-payments-header" description="Guest collections and balances." localSearch tabs={<Tabs id="payment-fixture-tabs" ariaLabel="Payment views" items={[{id:"collections-tab",label:"Collections",active:true,href:"?section=collections"},{id:"deposits-tab",label:"Deposits",href:"?section=deposits"}]}/>} toolbar={filters} summary={<p id="payment-fixture-period" className="mt-4">Activity period: {start} to {end}</p>}>{records}</PaymentsLayout> : <><PageHeader id="hospitality-payments-header" title="Payments"/>{filters}<p id="payment-fixture-period">Activity period: {start} to {end}</p>{records}</>}
</div>);
