import React from "react";
import { createRoot } from "react-dom/client";
import { PageHeader, SectionHeader } from "@/components/page-patterns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

createRoot(document.getElementById("root")!).render(<div className="grid gap-5">
  <PageHeader id="typography-page" title="Payments" description="Review payments and outstanding balances." action={<Button id="typography-action">Record payment</Button>}/>
  <SectionHeader id="typography-section" title="Payment details" description="Use the same text hierarchy throughout the workspace."/>
  <p id="typography-body">Body text stays regular. <strong id="typography-emphasis">Important information</strong> has a consistent emphasis.</p>
  <fieldset className="grid min-w-0 gap-3 rounded-xl border bg-white p-4">
    <legend id="typography-legend">Payment information</legend>
    <label id="typography-label" className="text-sm font-medium">Reference<Input id="typography-input" defaultValue="PAY-001" className="mt-1"/><small id="typography-help" className="font-normal">Use the reference on your receipt.</small></label>
    <label>Method<select id="typography-select" className="block w-full rounded-xl border p-2" defaultValue="cash"><option value="cash">Cash</option></select></label>
    <label>Notes<textarea id="typography-textarea" className="block w-full rounded-xl border p-2" defaultValue="Payment received"/></label>
    <label>Date<Input id="typography-date" type="date" defaultValue="2026-09-18"/></label>
  </fieldset>
  <Table><TableHeader><TableRow><TableHead id="typography-table-head">Reference</TableHead><TableHead>Amount</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell id="typography-table-cell">PAY-001</TableCell><TableCell><strong id="typography-total">₱1,000.00</strong></TableCell></TableRow></TableBody></Table>
  <details><summary id="typography-summary" className="min-h-11">Additional information</summary><p>Regular supporting text.</p></details>
  <section><h3 id="typography-plain-heading">Public page heading</h3><p id="typography-secondary" className="text-admin-text-muted">Secondary text uses color rather than extra weight.</p></section>
  <a id="typography-link" className="font-medium" href="#typography-page">Back to payments</a>
</div>);
