import test from "node:test";
import assert from "node:assert/strict";
import { inventoryReportQuery, inventoryReportRange } from "../lib/inventory-report";
test("inventory periods use calendar boundaries including leap years and Monday weeks", () => {
  assert.deepEqual(inventoryReportRange("day", "2026-10-05"), { start: "2026-10-05", end: "2026-10-05" });
  assert.deepEqual(inventoryReportRange("week", "2026-01-01"), { start: "2025-12-29", end: "2026-01-04" });
  assert.deepEqual(inventoryReportRange("month", "2024-02-20"), { start: "2024-02-01", end: "2024-02-29" });
  assert.deepEqual(inventoryReportRange("year", "2026-10-05"), { start: "2026-01-01", end: "2026-12-31" });
});
test("inventory report rejects malformed dates, branch IDs and invalid pagination", () => {
  for (const input of [{date:"2026-02-30"},{branch:"bad"},{page:1.5},{page:0},{period:"all"}]) assert.equal(inventoryReportQuery.safeParse(input).success,false);
  assert.equal(inventoryReportQuery.parse({}).period,"month");
});
test("month picker accepts a month and resolves its first day", () => {
  assert.equal(inventoryReportQuery.parse({date:"2026-10"}).date,"2026-10-01");
  assert.equal(inventoryReportQuery.safeParse({date:"2026-13"}).success,false);
});
test("custom ranges require ordered complete dates within the database limit", () => {
  for (const input of [{start:"2026-10-01"},{start:"2026-10-06",end:"2026-10-01"},{start:"2025-01-01",end:"2026-12-01"}]) assert.equal(inventoryReportQuery.safeParse(input).success,false);
  assert.ok(inventoryReportQuery.safeParse({start:"2026-09-28",end:"2026-10-02"}).success);
});
test("daily columns cross month and year boundaries inclusively", async () => {
  const {inventoryReportDays} = await import("../lib/inventory-report");
  assert.deepEqual(inventoryReportDays("2026-12-30","2027-01-02"),["2026-12-30","2026-12-31","2027-01-01","2027-01-02"]);
  assert.deepEqual(inventoryReportDays("2026-10-06","2026-10-06"),["2026-10-06"]);
});

test("product search trims whitespace and bounds input", () => {
  assert.equal(inventoryReportQuery.parse({q:"  cleanser  "}).q,"cleanser");
  assert.equal(inventoryReportQuery.safeParse({q:"x".repeat(121)}).success,false);
});
