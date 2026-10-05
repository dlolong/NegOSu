import test from "node:test";
import assert from "node:assert/strict";
import { appointmentListRange } from "../lib/appointment-list-range";
const now=new Date("2026-10-05T04:00:00Z");
test("default includes the previous thirty calendar days and future appointments",()=>{
 const range=appointmentListRange({},"Asia/Manila",now)!;
 assert.equal(range.from,"2026-09-05"); assert.equal(range.start.toISOString(),"2026-09-04T16:00:00.000Z"); assert.equal(range.end,undefined);
});
test("custom inclusive dates use branch timezone and override agenda tabs",()=>{
 const range=appointmentListRange({from:"2026-03-08",to:"2026-03-08",view:"week"},"America/New_York",now)!;
 assert.equal(range.end!.getTime()-range.start.getTime(),23*60*60*1000);
});
test("invalid dates and reversed ranges fail closed",()=>{
 for(const query of [{from:"2026-02-30"},{from:"2026-10-05",to:"2026-10-01"},{date:"invalid"},{to:"bad"}]) assert.equal(appointmentListRange(query,"Asia/Manila",now),null);
});
test("legacy day links and week tabs keep their bounded ranges",()=>{
 const day=appointmentListRange({date:"2026-10-01"},"Asia/Manila",now)!;
 assert.equal(day.to,"2026-10-01");
 const week=appointmentListRange({view:"week"},"Asia/Manila",now)!;
 assert.equal(week.to,"2026-10-11");
});
