import test from "node:test";
import assert from "node:assert/strict";
import { publicBookingHref,publicBookingSelection,publicPromoAppliesOn,type PublicPromo } from "../lib/public-promos";
import {promoSchema} from "../modules/core/commerce/promos";
const a="10000000-0000-4000-8000-000000000001",b="10000000-0000-4000-8000-000000000002";
const services=[{id:a,name:"Haircut",description:null,durationMinutes:30,priceCentavos:10000,category:null},{id:b,name:"Color",description:null,durationMinutes:60,priceCentavos:25000,category:null}];
const promo:PublicPromo={id:"offer",serviceId:a,branchId:"main",name:"Cut and shampoo",description:"",imageUrl:null,version:1,priceCentavos:15000,currency:"PHP",durationMinutes:30,validFrom:"2026-10-01",validThrough:"2026-10-31",inclusions:[]};
test("public promo replaces one service price while preserving other services and duration",()=>{
 const result=publicBookingSelection(services,[promo],"main",[a,b],["offer"]);
 assert.equal(result.priceCentavos,40000);assert.equal(result.durationMinutes,90);assert.equal(result.services.length,2);
 assert.equal(publicBookingSelection(services,[promo],"main",[],["offer"]).services[0].id,a);
 assert.equal(publicBookingSelection(services,[promo,{...promo,id:"second"}],"main",[],["offer","second"]).promos.length,1);
});
test("public promo selection discards wrong branch, missing service and unknown offers",()=>{
 assert.equal(publicBookingSelection(services,[promo],"other",[],["offer"]).promos.length,0);
 assert.equal(publicBookingSelection([], [promo],"main",[],["offer"]).promos.length,0);
 assert.equal(publicBookingSelection(services,[promo],"main",[],["unknown"]).services.length,0);
});
test("promo eligibility uses inclusive scheduled local date and wizard links preserve selection",()=>{
 for(const date of ["2026-10-01","2026-10-31"])assert.ok(publicPromoAppliesOn(promo,date));
 for(const date of ["2026-09-30","2026-11-01"])assert.equal(publicPromoAppliesOn(promo,date),false);
 const url=new URL(publicBookingHref("salon","main",[a,b],["offer"],{step:3,date:"2026-10-02",month:"2026-10"}),"https://example.test");
 assert.deepEqual(url.searchParams.getAll("services"),[a,b]);assert.deepEqual(url.searchParams.getAll("promos"),["offer"]);assert.equal(url.searchParams.get("step"),"3");
});
test("promo image URLs reject executable schemes and embedded credentials",()=>{
 const value={name:"Haircut bundle",description:"",priceCentavos:15000,status:"active",validFrom:null,validThrough:null,components:[{kind:"service",referenceId:a,quantity:"1",unit:"service"},{kind:"product",referenceId:b,quantity:"1",unit:"bottle"}]};
 for(const imageUrl of ["", "https://example.test/photo.jpg"])assert.ok(promoSchema.safeParse({...value,imageUrl,isPublic:true}).success);
 for(const imageUrl of ["javascript:alert(1)","data:image/svg+xml,test","https://user:password@example.test/photo.jpg"])assert.equal(promoSchema.safeParse({...value,imageUrl}).success,false);
 assert.equal(promoSchema.parse(value).isPublic,false);
});

test("multi-service bundle charges once, sums durations and excludes overlapping offers",()=>{
 const bundle={...promo,serviceIds:[a,b],priceCentavos:29999};
 const result=publicBookingSelection(services,[bundle,{...promo,id:"overlap"}],"main",[a,b],["offer","overlap"]);
 assert.equal(result.priceCentavos,29999);
 assert.equal(result.durationMinutes,90);
 assert.deepEqual(result.services.map(s=>s.id),[a,b]);
 assert.equal(result.promos.length,1);
 assert.equal(publicBookingSelection(services.slice(0,1),[bundle],"main",[],["offer"]).promos.length,0);
});
