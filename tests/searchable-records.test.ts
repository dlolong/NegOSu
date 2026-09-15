import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createQuickCategory, createQuickService } from "../lib/quick-catalog";
import { searchRecords } from "../lib/record-lookup";
import { createVisitPet } from "../modules/pet-care/quick-pet";
const org="13000000-0000-4000-8000-000000000001",id="53000000-0000-4000-8000-000000000001",categoryId="63000000-0000-4000-8000-000000000001";
const actor={organizationId:org,role:"owner",industry:"pet_care"};
const service={requestId:id,name:"Bath",categoryId:"",basePrice:"125.50",durationMinutes:"30"};
type Result={data:unknown;error:null|{code:string}};
function database(responses:Result[]) {
 const calls:Array<{table:string;operation:string;args:unknown[]}>=[];
 const db={from(table:string){const chain:Record<string,unknown>={};for(const operation of ["select","eq","in","or","ilike","order","insert"]){chain[operation]=(...args:unknown[])=>{calls.push({table,operation,args});return chain;};}for(const operation of ["single","maybeSingle","limit"]){chain[operation]=async(...args:unknown[])=>{calls.push({table,operation,args});return responses.shift()??{data:null,error:null};};}return chain;}} as unknown as SupabaseClient;
 return {db,calls};
}
test("catalog creation rejects non-admin actors and invalid input before writes",async()=>{
 const {db,calls}=database([]);
 for(const role of ["advisor","viewer","cashier","technician"]){assert.ok((await createQuickService(service,{...actor,role},db)).error);assert.ok((await createQuickCategory({requestId:id,name:"Baths"},{...actor,role},db)).error);}
 for(const change of [{name:""},{durationMinutes:0},{durationMinutes:1.5},{basePrice:"-1"},{basePrice:"1.001"},{basePrice:"1000000001"},{categoryId:"unsafe"},{requestId:"invalid"}])assert.ok((await createQuickService({...service,...change},actor,db)).error);
 assert.equal(calls.length,0);
});
test("quick service converts money and writes only to actor tenant",async()=>{
 const {db,calls}=database([{data:{id,name:"Bath"},error:null}]);
 assert.equal((await createQuickService({...service,organizationId:"forged",is_add_on:true},actor,db)).data?.id,id);
 assert.deepEqual(calls.find(call=>call.operation==="insert")?.args[0],{id,organization_id:org,name:"Bath",category_id:null,base_price_centavos:12550,duration_minutes:30,is_active:true,is_add_on:false});
});
test("quick service rejects foreign or inactive category and does not create a partial service",async()=>{
 const {db,calls}=database([{data:null,error:null}]);
 assert.ok((await createQuickService({...service,categoryId},actor,db)).error);
 assert.ok(calls.some(call=>call.operation==="eq"&&call.args[0]==="organization_id"&&call.args[1]===org));
 assert.ok(calls.some(call=>call.operation==="eq"&&call.args[0]==="is_active"&&call.args[1]===true));
 assert.ok(!calls.some(call=>call.operation==="insert"));
});
test("service retry reuses only its own unchanged record",async()=>{
 const row={id,name:"Bath",category_id:null,base_price_centavos:12550,duration_minutes:30};
 for(const changed of [false,true]){const {db,calls}=database([{data:null,error:{code:"23505"}},{data:{...row,duration_minutes:changed?60:30},error:null}]);const result=await createQuickService(service,actor,db);assert.equal(Boolean(result.data),!changed);assert.ok(calls.some(call=>call.operation==="eq"&&call.args[0]==="organization_id"&&call.args[1]===org));}
});
test("category retry handles its matching insert but does not select a same-name record with another request id",async()=>{
 const matching=database([{data:null,error:{code:"23505"}},{data:{id,name:"Baths"},error:null}]);
 assert.equal((await createQuickCategory({requestId:id,name:"Baths"},actor,matching.db)).data?.id,id);
 const conflict=database([{data:null,error:{code:"23505"}},{data:null,error:null}]);
 assert.match((await createQuickCategory({requestId:id,name:"Baths"},actor,conflict.db)).error??"",/already exists/);
});
test("customer search is tenant scoped, active only, bounded and includes contact fields",async()=>{
 const {db,calls}=database([{data:[{id,full_name:"Maria",phone:"09171234567",email:null}],error:null}]);
 const result=await searchRecords({kind:"customer",query:"0917",organizationId:"forged"},actor,db);
 assert.equal(result.data?.[0].name,"Maria");assert.match(result.data?.[0].keywords??"",/0917/);
 assert.ok(calls.some(call=>call.operation==="eq"&&call.args[0]==="organization_id"&&call.args[1]===org));
 assert.ok(calls.some(call=>call.operation==="eq"&&call.args[0]==="is_archived"&&call.args[1]===false));
 assert.ok(calls.some(call=>call.operation==="limit"&&call.args[0]===50));
 assert.ok(calls.some(call=>call.operation==="or"&&String(call.args[0]).includes("phone.ilike")));
});
test("service search uses category matches while scoping both queries",async()=>{
 const {db,calls}=database([{data:[{id:categoryId}],error:null},{data:[{id,name:"Bath",base_price_centavos:12550,duration_minutes:30,service_categories:{name:"Grooming"}}],error:null}]);
 const result=await searchRecords({kind:"service",query:"Grooming"},actor,db);
 assert.equal(result.data?.[0].keywords,"Grooming");assert.equal(calls.filter(call=>call.operation==="eq"&&call.args[0]==="organization_id"&&call.args[1]===org).length,2);
 assert.ok(calls.some(call=>call.operation==="or"&&String(call.args[0]).includes(`category_id.in.(${categoryId})`)));
});
test("search errors are explicit rather than missing-record results",async()=>{
 const {db}=database([{data:null,error:{code:"42501"}}]);
 assert.ok((await searchRecords({kind:"customer",query:"Maria"},actor,db)).error);
 const invalid=database([]);assert.ok((await searchRecords({kind:"secrets",query:""},actor,invalid.db)).error);assert.equal(invalid.calls.length,0);
});
test("vehicle search restricts owner and vertical and escapes filter syntax",async()=>{
 const wrong=database([]);assert.deepEqual((await searchRecords({kind:"vehicle",query:"",scopeId:id},actor,wrong.db)).data,[]);assert.equal(wrong.calls.length,0);
 const {db,calls}=database([{data:[],error:null}]);await searchRecords({kind:"vehicle",scopeId:id,query:"x%,(y)_"},{...actor,industry:"automotive"},db);
 assert.ok(calls.some(call=>call.operation==="eq"&&call.args[0]==="customer_id"&&call.args[1]===id));
 assert.ok(!calls.some(call=>call.operation==="or"&&String(call.args[0]).includes("(y)")));
});
test("quick pet enforces operator role, vertical, owner tenant and retries",async()=>{
 const input={requestId:id,customer_id:categoryId,name:"Milo",species:"dog"};
 const denied=database([]);assert.ok((await createVisitPet(input,{...actor,role:"cashier"},denied.db)).error);assert.ok((await createVisitPet(input,{...actor,industry:"salon"},denied.db)).error);assert.equal(denied.calls.length,0);
 const foreign=database([{data:null,error:null}]);assert.ok((await createVisitPet(input,actor,foreign.db)).error);assert.ok(!foreign.calls.some(call=>call.operation==="insert"));
 const retry=database([{data:{id:categoryId,full_name:"Maria"},error:null},{data:null,error:{code:"23505"}},{data:{id,customer_id:categoryId,name:"Milo",species:"dog"},error:null}]);assert.deepEqual((await createVisitPet(input,actor,retry.db)).data,{id,name:"Milo · Maria"});
});

test("punctuated customer names and full vehicle labels search each term without losing identity",async()=>{
 const customer=database([{data:[],error:null}]);await searchRecords({kind:"customer",query:"Doe, Jane (Jr.)"},actor,customer.db);
 const customerFilters=customer.calls.filter(call=>call.operation==="or").map(call=>String(call.args[0]));assert.equal(customerFilters.length,3);assert.ok(customerFilters[0].includes("%Doe%"));assert.ok(customerFilters[1].includes("%Jane%"));
 const vehicle=database([{data:[],error:null}]);await searchRecords({kind:"vehicle",query:"Toyota Vios",scopeId:id},{...actor,industry:"automotive"},vehicle.db);assert.equal(vehicle.calls.filter(call=>call.operation==="or").length,2);
});
