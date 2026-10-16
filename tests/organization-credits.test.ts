import test from "node:test";
import assert from "node:assert/strict";
import { creditUsageSchema, creditOperationResultSchema, creditStatusMessage } from "@/modules/platform/credits";
import { presentLivePlans } from "@/modules/platform/plan-catalog";
import { reportQuerySchema, resolveReportScope } from "@/lib/reporting";
const usage={remaining:73,allowance:100,reserved:0,oneTimeRemaining:73,monthlyRemaining:0,monthlyAllowance:0,nextRefresh:null,periodStart:null,periodKey:"one-time",status:"NORMAL"};
test("credit usage requires authoritative typed amounts and supports no recurring configuration",()=>{
 assert.equal(creditUsageSchema.parse(usage).oneTimeRemaining,73);
 assert.equal(creditUsageSchema.parse(usage).nextRefresh,null);
 for(const value of [-1,0.5,"73",null])assert.equal(creditUsageSchema.safeParse({...usage,remaining:value}).success,false);
 assert.equal(creditOperationResultSchema.safeParse({code:"UNEXPECTED"}).success,false);
 for(const status of ["LOW","CRITICAL","EMPTY"] as const)assert.ok(creditStatusMessage(status).length>0);
});
test("public catalog claims reflect configured features, capacity and approved allowance only",()=>{
 const row={id:"starter",name:"Live plan",monthly_price_centavos:12345,yearly_price_centavos:null,is_custom:false,limits:{branches:3,staff:9},features:{advanced_reports:false,image_uploads:false},monthly_credits:null,credit_grant_policy:null};
 const plan=presentLivePlans([row])[0];assert.equal(plan.name,"Live plan");assert.equal(plan.monthlyPriceCentavos,12345);
 assert.equal(presentLivePlans([{...row,id:"new-approved-plan"}])[0].id,"new-approved-plan");
 assert.ok(plan.highlights.includes("3 branch(es)"));assert.ok(!plan.highlights.some(x=>/Direct image|Detailed reports|credits per/.test(x)));
 assert.ok(!presentLivePlans([{...row,monthly_credits:12}])[0].highlights.some(x=>/credits per/.test(x)));
 assert.ok(presentLivePlans([{...row,monthly_credits:12,credit_grant_policy:"calendar_month_utc"}])[0].highlights.includes("12 credits per configured month"));
});
test("Free report dates include full month and recent custom periods without all-branch access",()=>{
 const id="81000000-0000-4000-8000-000000000001",member={branchId:id,timezone:"Asia/Manila",branches:[{id}]},now=new Date("2026-01-31T08:00:00Z");
 const month=resolveReportScope(reportQuerySchema.parse({preset:"month"}),member,false,now);
 assert.deepEqual(month.range,{start:"2026-01-01",end:"2026-01-31"});assert.equal(month.branch,id);
 const custom=resolveReportScope(reportQuerySchema.parse({preset:"custom",start:"2026-01-04",end:"2026-01-07"}),member,false,now);
 assert.deepEqual(custom.range,{start:"2026-01-04",end:"2026-01-07"});
});
