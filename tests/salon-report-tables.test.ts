import test from "node:test";
import assert from "node:assert/strict";
import { bookingReportTable } from "@/modules/core/reporting/booking-tables";
import { creditReportSections } from "@/modules/platform/trial-credits";
import type { CreditSnapshot } from "@/modules/platform/trial-credits";
import type { OwnerReport } from "@/lib/reporting";
const report: OwnerReport = {startDate:"2026-10-10",endDate:"2026-10-16",summary:{grossSalesCentavos:15000,paymentsReceivedCentavos:12000,outstandingCentavos:3000,jobsCompleted:1,averageTicketCentavos:10000,customersServed:1,repeatCustomers:0,newCustomers:1},daily:[],services:[],categories:[],technicians:[],branches:[],salonDetails:{appointments:[{id:"visit",starts_at:"2026-10-16T00:00:00Z",timezone:"Asia/Manila",client:"Alex",staff:"Jo, Sam",products:"Shampoo × 2",total:15000,status:"completed"}],payments:[{id:"receipt",paid_at:"2026-10-16T00:00:00Z",timezone:"Asia/Manila",method:"cash",status:"paid",amount:12000}]}};
test("salon table keeps one appointment with client, staff, products and full total",()=>{
 const table=bookingReportTable(report,"bookings","PHP");
 assert.equal(table.rows.length,1);assert.equal(table.rows[0].cells.client,"Alex");assert.equal(table.rows[0].cells.staff,"Jo, Sam");assert.equal(table.rows[0].cells.products,"Shampoo × 2");assert.match(table.rows[0].cells.total!,/150/);
});
test("salon CSV includes appointment and payment detail with centavo totals",()=>{
 const sections=creditReportSections({payload:{kind:"overview"},report} as CreditSnapshot);
 assert.deepEqual(sections.find(s=>s.title==="Appointments")?.rows[0],["2026-10-16T00:00:00Z","Alex","Jo, Sam","Shampoo × 2",15000,"completed"]);
 assert.equal(sections.find(s=>s.title==="Payments")?.rows[0][3],12000);
});
test("salon payments stay distinct from sales and preserve receipt status",()=>{
 assert.equal(bookingReportTable(report,"payments","PHP").rows[0].cells.status,"paid");
 assert.equal(report.summary.grossSalesCentavos,15000);assert.equal(report.summary.paymentsReceivedCentavos,12000);
});

test("salon defaults use authorized report RPC and keep totals across all rows",async()=>{
 const {loadCategoryTableData}=await import("@/modules/core/reporting/category-report");
 const calls:unknown[][]=[];
 const db={rpc:async(name:string,args:unknown)=>{calls.push([name,args]);return {data:report,error:null};}} as unknown as import("@supabase/supabase-js").SupabaseClient;
 const member={organizationId:"org",branchId:"branch",timezone:"Asia/Manila",industry:"salon",currency:"PHP",role:"owner"} as import("@/lib/auth/context").OrganizationMembership;
 const data=await loadCategoryTableData({db,member,category:"payments",start:"2026-10-10"});
 assert.equal(data.denied,false);
 if(!data.denied) {assert.equal(data.failed,false);assert.deepEqual(data.summary,{sales:15000,revenue:12000});}
 assert.deepEqual(calls,[["get_appointment_report",{p_organization_id:"org",p_branch_id:"branch",p_start_date:"2026-10-10",p_end_date:"2026-10-16"}]]);
});

for (const industry of ["automotive","pet_care"] as const) test(`${industry} booking columns, default RPC and CSV use the vertical contract`,async()=>{
 const {loadCategoryTableData}=await import("@/modules/core/reporting/category-report");
 const data:OwnerReport={...report,salonDetails:undefined,bookingDetails:{...report.salonDetails!,industry}};
 const table=bookingReportTable(data,"bookings","PHP",industry);
 assert.equal(table.columns.find(c=>c.key==="client")?.label,industry==="automotive"?"Customer":"Pet owner");
 assert.equal(table.columns.find(c=>c.key==="staff")?.label,industry==="automotive"?"Technicians":"Grooming staff");
 assert.equal(table.rows[0].cells.staff,"Jo, Sam");
 const calls:unknown[][]=[];
 const db={rpc:async(name:string,args:unknown)=>{calls.push([name,args]);return {data,error:null};}} as unknown as import("@supabase/supabase-js").SupabaseClient;
 const member={organizationId:"org",branchId:"branch",timezone:"Asia/Manila",industry,currency:"PHP",role:"owner"} as import("@/lib/auth/context").OrganizationMembership;
 const loaded=await loadCategoryTableData({db,member,category:"bookings",start:"2026-10-10"});
 assert.equal(loaded.denied,false);if(!loaded.denied) {assert.equal(loaded.failed,false);assert.deepEqual(loaded.rows,table.rows);}
 assert.deepEqual(calls,[[industry==="automotive"?"get_owner_report":"get_appointment_report",{p_organization_id:"org",p_branch_id:"branch",p_start_date:"2026-10-10",p_end_date:"2026-10-16"}]]);
 const csv=creditReportSections({payload:{kind:"overview"},report:data} as CreditSnapshot);
 assert.equal(csv.find(s=>s.title==="Appointments")?.columns[1],industry==="automotive"?"Customer":"Pet owner");
});
