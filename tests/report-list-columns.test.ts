import test from "node:test";
import assert from "node:assert/strict";
import { reportListColumns } from "../modules/core/reporting/table-columns";
test("report lists show record amounts and prices without duplicate revenue",()=>{
 const columns=[{key:"name",label:"Name"},{key:"total",label:"Total billed"},{key:"paid",label:"Revenue collected"},{key:"amount",label:"Total amount"},{key:"revenue",label:"Revenue"},{key:"charges",label:"Charges"},{key:"price",label:"Price"},{key:"balance",label:"Balance"}];
 assert.deepEqual(reportListColumns(columns).map(c=>c.key),["name","total","amount","charges","price","balance"]);
 assert.equal(reportListColumns(columns).find(c=>c.key==="total")?.label,"Amount");
 assert.deepEqual(reportListColumns([{key:"amount",label:"Amount"}]),[{key:"amount",label:"Amount"}]);
});

test("catalog rows distinguish missing dates/prices from zero-priced items", async()=>{
 const {catalogReportTable}=await import("../modules/core/reporting/catalog-report");
 const report={category:"promos" as const,count:2,summary:{amount:0,revenue:0},rows:[{id:"one",name:"Missing",branch:"Main",status:"active",amount:0,revenue:0},{id:"two",name:"Free",branch:"Main",status:"active",price:0,amount:0,revenue:0}]};
 const table=catalogReportTable(report,"PHP");
 assert.equal(table.rows[0].cells.date,"—");
 assert.equal(table.rows[0].cells.price,"—");
 assert.match(table.rows[1].cells.price,/0\.00/);
});
