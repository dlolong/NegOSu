import assert from "node:assert/strict";
import test from "node:test";
import { resolveArrivalTime, resolvePastBookingTimes } from "../modules/hospitality/arrival-time";
const now = new Date("2026-10-03T10:30:00Z");

test("manual arrival uses the branch timezone, not the browser or server zone", () => {
  assert.equal(resolveArrivalTime("2026-10-03T18:30", "Asia/Manila", now), now.toISOString());
  assert.equal(resolveArrivalTime("2026-10-02T09:15", "Asia/Manila", now), "2026-10-02T01:15:00.000Z");
  assert.equal(resolveArrivalTime("2026-10-03T01:00", "America/New_York", now), "2026-10-03T05:00:00.000Z");
});
test("manual arrival rejects future dates and malformed calendar values", () => {
  for (const value of ["", "2026-02-30T10:00", "2026-10-03", "2026-10-03T18:30Z", "2026-10-03T18:31", "2027-01-01T00:00"])
    assert.throws(() => resolveArrivalTime(value, "Asia/Manila", now));
});
test("nonexistent local daylight-saving times cannot silently become another time", () => {
  assert.throws(() => resolveArrivalTime("2026-03-08T02:30", "America/New_York", now));
});


test("past bookings allow an in-house arrival or a completed historical interval", () => {
  assert.deepEqual(resolvePastBookingTimes("2026-10-02T12:00", null, "Asia/Manila", now), { arrival: "2026-10-02T04:00:00.000Z", departure: null });
  assert.deepEqual(resolvePastBookingTimes("2026-10-02T12:00", "2026-10-02T15:00", "Asia/Manila", now), { arrival: "2026-10-02T04:00:00.000Z", departure: "2026-10-02T07:00:00.000Z" });
});
test("past bookings reject current/future arrival and missing, reversed or future checkout", () => {
  assert.throws(() => resolvePastBookingTimes("2026-10-03T18:30", null, "Asia/Manila", now));
  for (const end of ["", "2026-10-02T11:59", "2026-10-02T12:00", "2026-10-04T00:00"])
    assert.throws(() => resolvePastBookingTimes("2026-10-02T12:00", end, "Asia/Manila", now));
});
