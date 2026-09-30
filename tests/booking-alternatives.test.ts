import test from "node:test";
import assert from "node:assert/strict";
import {proposeAlternativeSchema,respondAlternativeSchema,alternativeError} from "../modules/core/scheduling/booking-alternatives";
const id="11111111-1111-4111-8111-111111111111";
test("alternatives validate a local date, bounded message and explicit staff identity",()=>{
 const offer={id,version:0,startsAt:"2026-10-15T10:30",staffId:null,resourceId:null,message:"Try another time"};
 assert.ok(proposeAlternativeSchema.safeParse(offer).success);
 for(const patch of [{id:"other"},{version:-1},{startsAt:"2026-10-15"},{staffId:"Staff Name"},{message:"x".repeat(1001)}])assert.equal(proposeAlternativeSchema.safeParse({...offer,...patch}).success,false);
});
test("client responses require a private token, exact positive version and accept or cancel",()=>{
 const response={token:"a".repeat(64),version:1,action:"accept"};
 assert.ok(respondAlternativeSchema.safeParse(response).success);
 assert.ok(respondAlternativeSchema.safeParse({...response,action:"cancel"}).success);
 for(const patch of [{token:id},{version:0},{version:1.2},{action:"confirm"}])assert.equal(respondAlternativeSchema.safeParse({...response,...patch}).success,false);
});
test("alternative errors do not expose raw database details",()=>{
 assert.match(alternativeError({code:"40001"}),/changed/);
 assert.match(alternativeError({code:"PGRST202"}),/0108/);
 assert.match(alternativeError({code:"22023"}),/no longer available/);
});
