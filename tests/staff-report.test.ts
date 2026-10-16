import test from "node:test";
import assert from "node:assert/strict";
import { staffReportSchema,staffReportTable,staffTransactionRows,staffReportTotal } from "../modules/core/reporting/staff-report";
import { creditReportCsv,creditReportPayloadSchema } from "../modules/platform/trial-credits";

const report=staffReportSchema.parse({rows:[
  {key:"appointment:visit:staff-one",staff:"Jamie",occurred_at:"2026-10-15T18:00:00Z",timezone:"Asia/Manila",transaction:"Haircut",client:"Alex",price:50000},
  {key:"appointment:visit:staff-two",staff:"Pat",occurred_at:"2026-10-15T18:00:00Z",timezone:"Asia/Manila",transaction:"Haircut",client:"Alex",price:50000},
]});
test("staff rows combine participants and show each transaction price once",()=>{
 const table=staffReportTable(report,"PHP");
 assert.deepEqual(table.columns.map(c=>c.label),["Staff","Date and time","Transaction","Client / guest","Price"]);
 assert.equal(new Set(table.rows.map(r=>r.id)).size,1);
 assert.match(table.rows[0].cells.date,/Oct 16, 2026/);
 assert.match(table.rows[0].cells.price,/500\.00/);
 assert.equal(table.rows[0].cells.staff,"Jamie, Pat");
 assert.equal(table.rows[0].id,"appointment:visit");
 assert.deepEqual(staffReportTable({rows:[]},"PHP").rows,[]);
});
test("staff filtered snapshots and CSV preserve transaction details without total/revenue sections",()=>{
 const payload=creditReportPayloadSchema.parse({kind:"staff",action:"csv_export",branch:null,start:"2026-10-01",end:"2026-10-16",maxCost:0});
 const csv=creditReportCsv({id:"snapshot",payload,report,cost:0,remaining:0,createdAt:"2026-10-16T00:00:00Z"});
 assert.match(csv,/Staff transactions/);assert.match(csv,/Price centavos/);assert.match(csv,/Jamie/);assert.match(csv,/50000/);
 assert.doesNotMatch(csv,/Total amount|Revenue|Totals/);
 assert.match(csv,/"Jamie, Pat"/);
 assert.equal(csv.match(/50000/g)?.length,1);
});

test("staff grouping preserves distinct transactions with identical labels and amounts",()=>{
 const rows=staffTransactionRows({rows:[...report.rows,report.rows[0],{...report.rows[0],key:"appointment:other-visit:staff-one"},{...report.rows[0],key:"job:visit:staff-one"}]});
 assert.equal(rows.length,3);
 assert.equal(rows[0].staff,"Jamie, Pat");
 assert.equal(rows[0].price,50000);
 assert.equal(rows[1].key,"appointment:other-visit");
 assert.equal(rows[2].key,"job:visit");
});

test("staff total counts a shared transaction once across all pages",()=>{
 assert.equal(staffReportTotal(report),50000);
 assert.equal(staffReportTotal({rows:[...report.rows,{...report.rows[0],key:"appointment:another:staff-one",price:70000}]}),120000);
 assert.equal(staffReportTotal({rows:[]}),0);
});
