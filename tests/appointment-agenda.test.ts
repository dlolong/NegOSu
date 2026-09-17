import assert from "node:assert/strict";
import test from "node:test";
import { appointmentAgendaRange, zonedDateTimeToUtc } from "../lib/operations";

test("invalid calendar dates and nonexistent local times are rejected", () => {
  for (const date of ["2026-13-01", "2026-02-30", "not-a-date", "2026-00-01"]) {
    assert.equal(appointmentAgendaRange(date, 1, "Asia/Manila"), null);
    assert.equal(zonedDateTimeToUtc(`${date}T10:00`, "Asia/Manila"), null);
  }
  assert.equal(zonedDateTimeToUtc("2026-03-08T02:30", "America/New_York"), null);
});

test("agenda boundaries follow local calendar days across daylight saving", () => {
  for (const [date, hours] of [["2026-03-08", 23], ["2026-11-01", 25]] as const) {
    const range = appointmentAgendaRange(date, 1, "America/New_York")!;
    assert.equal((range.end.valueOf() - range.start.valueOf()) / 3600000, hours);
  }
  const week = appointmentAgendaRange("2026-12-28", 7, "Asia/Manila")!;
  assert.equal(week.start.toISOString(), "2026-12-27T16:00:00.000Z");
  assert.equal(week.end.toISOString(), "2027-01-03T16:00:00.000Z");
});
