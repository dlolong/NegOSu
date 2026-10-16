import test from "node:test";
import assert from "node:assert/strict";
import { createLookupCache } from "../lib/lookup-cache";
test("lookup choices expire and empty successful results are reusable", () => {
 let time=0; const cache=createLookupCache<string[]>(30,2,()=>time);
 cache.set("empty",[]); assert.deepEqual(cache.get("empty"),[]);
 time=30; assert.equal(cache.get("empty"),undefined);
});
test("lookup cache bounds memory and isolates controls", () => {
 const a=createLookupCache<string>(100,2), b=createLookupCache<string>(100,2);
 a.set("one","1");a.set("two","2");a.set("three","3");
 assert.equal(a.get("one"),undefined);assert.equal(a.get("two"),"2");assert.equal(b.get("two"),undefined);
});
