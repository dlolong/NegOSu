"use client";
import { PaymentTotals } from "./payment-totals";
import { useState } from "react";
import { RecordTable } from "@/components/record-table";
import { Button } from "@/components/ui/button";
import { staffReportNote, staffReportTable, staffReportTotal, type StaffReport } from "@/modules/core/reporting/staff-report";

export function StaffTransactions({report,currency}:{report:StaffReport;currency:string}) {
  const [page,setPage]=useState(1);
  const table=staffReportTable(report,currency),pages=Math.max(1,Math.ceil(table.rows.length/50));
  return <section className="space-y-3">
    <PaymentTotals sales={staffReportTotal(report)} revenue={0} currency={currency}/>
    <p className="text-xs text-admin-text-secondary">{staffReportNote}</p>
    <RecordTable reportSearch id="reports-staff-table" caption="Staff transactions" columns={table.columns} rows={table.rows.slice((page-1)*50,page*50)} empty="No completed staff transactions in this period."/>
    <nav aria-label="Staff report pages" className="flex items-center justify-between gap-2">
      <Button id="reports-staff-previous" variant="secondary" disabled={page===1} onClick={()=>setPage(page-1)}>Previous</Button>
      <span className="text-sm">Page {page} of {pages}</span>
      <Button id="reports-staff-next" variant="secondary" disabled={page===pages} onClick={()=>setPage(page+1)}>Next</Button>
    </nav>
  </section>;
}
