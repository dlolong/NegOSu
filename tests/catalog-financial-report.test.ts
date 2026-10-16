import test from "node:test";
import assert from "node:assert/strict";
import {catalogReportTable,reportCategories,type CatalogReport} from "@/modules/core/reporting/catalog-report";
import {loadCategoryTableData} from "@/modules/core/reporting/category-report";
import {creditReportCsv,type CreditSnapshot} from "@/modules/platform/trial-credits";
import type {SupabaseClient} from "@supabase/supabase-js";
import type {OrganizationMembership} from "@/lib/auth/context";
for(const category of ["promos","rooms"] as const) test(`${category} shows prices and full report totals independently of 50 visible rows`,async()=>{
 const data:CatalogReport={category,count:51,summary:{amount:51000,revenue:25500},rows:Array.from({length:51},(_,i)=>({id:String(i),name:`Item ${i}`,branch:"Main",status:"active",price:1000,bookings:1,rates:[{label:"3 hours",priceCentavos:1000}],amount:1000,revenue:500}))};
 const calls:unknown[][]=[];
 const db={rpc:async(name:string,args:unknown)=>{calls.push([name,args]);return {data,error:null};}} as unknown as SupabaseClient;
 const member={organizationId:"org",branchId:"branch",industry:"hospitality",currency:"PHP",role:"owner"} as OrganizationMembership;
 const result=await loadCategoryTableData({db,member,category,start:"2026-10-10"});
 assert.equal(result.denied,false);if(!result.denied){assert.equal(result.failed,false);assert.equal(result.rows.length,50);assert.deepEqual(result.summary,{sales:51000,revenue:25500});}
 assert.deepEqual(calls,[["get_catalog_financial_report",{p_org:"org",p_branch:"branch",p_start:"2026-10-10",p_end:"2026-10-16",p_category:category}]]);
 assert.match(catalogReportTable(data,"PHP").rows[0].cells.price,/10.00/);
 assert.match(creditReportCsv({payload:{kind:"catalog"},report:data} as CreditSnapshot),/51000,25500/);
});
test("promos are available across verticals and rooms only in hospitality",()=>{
 for(const industry of ["salon","automotive","pet_care","hospitality"]) {assert.ok(reportCategories(industry).includes("promos"));assert.equal(reportCategories(industry).includes("rooms"),industry==="hospitality");}
});
