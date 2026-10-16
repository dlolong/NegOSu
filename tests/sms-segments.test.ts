import test from "node:test";
import assert from "node:assert/strict";
import { smsSegments } from "@/lib/notifications/sms-segments";
test("GSM single and concatenated boundaries", () => {
  for (const [length, segments] of [[0,0],[160,1],[161,2],[306,2],[307,3]]) assert.equal(smsSegments("a".repeat(length)).segments, segments);
});
test("GSM extended alphabet uses escape septets", () => {
  assert.deepEqual(smsSegments("^{}\\[~]|€\f"), {encoding:"GSM-7",units:20,segments:1});
  assert.equal(smsSegments("€".repeat(81)).segments,2);
});
test("Unicode uses UTF-16 units including emoji", () => {
  assert.deepEqual(smsSegments("界".repeat(70)), {encoding:"UTF-16",units:70,segments:1});
  assert.equal(smsSegments("界".repeat(71)).segments,2);
  assert.equal(smsSegments("😀".repeat(35)).segments,1);
  assert.equal(smsSegments("😀".repeat(36)).segments,2);
  assert.equal(smsSegments("a".repeat(159)+"’").encoding,"UTF-16");
});

test("multipart boundaries never split escape sequences or surrogate pairs", () => {
  assert.equal(smsSegments("€".repeat(153)).segments,3);
  assert.equal(smsSegments("😀".repeat(67)).segments,3);
});
