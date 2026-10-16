import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrganizationMembership } from "@/lib/auth/context";
import { loadCategoryTableData } from "@/modules/core/reporting/category-report";
const member = {organizationId:"org",branchId:"branch",timezone:"Asia/Manila",industry:"salon",currency:"PHP",role:"owner"} as OrganizationMembership;
for(const category of ["payments","bookings"] as const) test(`${category} hospitality default uses scoped canonical workspace`,async()=>{
 const calls:unknown[][]=[];
 const db={rpc:async(name:string,args:unknown)=>{calls.push([name,args]);return {data:{rows:[],rowCount:0},error:null};}} as unknown as SupabaseClient;
 const result=await loadCategoryTableData({db,member:{...member,industry:"hospitality"},category,start:"2026-10-10"});
 assert.equal(result.denied,false);if(!result.denied) assert.equal(result.failed,false);
 assert.deepEqual(calls,[["get_hospitality_workspace",{p_org:"org",p_branch:"branch",p_start:"2026-10-10",p_end:"2026-10-16",p_section:category==="payments"?"collections":"stays",p_page:1,p_mode:"report"}]]);
});
test("restricted roles cannot load finance category tables",async()=>{
 const db={from:()=>{throw new Error("must not query");},rpc:()=>{throw new Error("must not query");}} as unknown as SupabaseClient;
 for(const category of ["payments","products"] as const) assert.deepEqual(await loadCategoryTableData({db,member:{...member,role:"viewer"},category,start:"2026-10-10"}),{denied:true});
});
for (const category of ["products","clients","services","staff"] as const) test(`${category} reads fixed recent window without generating a paid snapshot`,async()=>{
 const calls:unknown[][]=[];
 const db={rpc:async(name:string,args:unknown)=>{calls.push([name,args]);return {data:{count:1,summary:{records:1,total:100,paid:100,balance:0},rows:[{key:"one",clientId:null,name:"Client",lastActivity:"2026-10-16",records:1,branches:["Main"],total:100,paid:100,balance:0,staff:[],items:[{kind:"product",name:"Shampoo",quantity:1,unit:"bottle",included:false}]}]},error:null};}} as unknown as SupabaseClient;
 const result=await loadCategoryTableData({db,member,category,start:"2026-10-10"});
 assert.equal(result.denied,false);
 if(!result.denied) {assert.equal(result.failed,false);assert.equal(result.rows.length,1);}
 assert.deepEqual(calls,[["get_recent_client_purchases",{p_org:"org",p_branch:"branch",p_kind:category==="products"?"product":category==="services"?"service":"all",p_page:1}]]);
});
