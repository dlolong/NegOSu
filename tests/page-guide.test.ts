import test from "node:test";
import assert from "node:assert/strict";
import {pageGuide,guideStorageKey} from "../lib/guides/tours";
test("guides cover only the intended dashboard and checkout pages",()=>{
 for(const path of ["/dashboard","/dashboard/pet-care","/dashboard/checkout/new","/dashboard/checkout/123","/dashboard/checkout/123/payment"])assert.ok(pageGuide(path));
 for(const path of ["/dashboard/settings","/shop/test","/dashboard/checkout/123/receipt","/dashboard/checkout/123/other"])assert.equal(pageGuide(path),null);
});
test("completion is scoped by membership, industry, role and versioned guide",()=>{
 const key=guideStorageKey("member","salon","owner","dashboard");
 assert.match(key,/v1/);
 for(const args of [["other","salon","owner","dashboard"],["member","pet_care","owner","dashboard"],["member","salon","cashier","dashboard"],["member","salon","owner","checkout"]])assert.notEqual(guideStorageKey(...args as [string,string,string,string]),key);
});
test("tours stay short and checkout guidance separates handover from payment",()=>{
 for(const path of ["/dashboard","/dashboard/checkout/new","/dashboard/checkout/123","/dashboard/checkout/123/payment"]){const guide=pageGuide(path)!;assert.ok(guide.steps.length<=5);assert.equal(new Set(guide.steps.map(s=>s.element)).size,guide.steps.length);}
 assert.match(JSON.stringify(pageGuide("/dashboard/checkout/123")),/Payment alone does not deduct/);
});
