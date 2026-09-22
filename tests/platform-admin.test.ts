import test from "node:test";
import assert from "node:assert/strict";
import { isPlatformAdmin, adminPageNumber } from "../modules/platform/admin-access";
import { statusChart, chartMaximum } from "../modules/platform/chart-data";

const admin = "83100000-0000-4000-8000-000000000001";
const other = "83100000-0000-4000-8000-000000000002";

test("platform access requires an exact trusted UUID and fails closed on bad configuration", () => {
  assert.equal(isPlatformAdmin(admin, ` ${other}, ${admin} `), true);
  assert.equal(isPlatformAdmin(admin, other), false);
  assert.equal(isPlatformAdmin(admin, undefined), false);
  assert.equal(isPlatformAdmin(undefined, admin), false);
  assert.equal(isPlatformAdmin(admin, `${admin},owner`), false);
  assert.equal(isPlatformAdmin("owner", "owner"), false);
  assert.equal(isPlatformAdmin(admin.slice(0, -1), admin), false);
});

test("directory pagination is bounded and rejects malformed input", () => {
  for (const input of [undefined, [], "0", "-1", "1.5", "1e3", "1000000", "1 OR true"]) assert.equal(adminPageNumber(input), 1);
  assert.equal(adminPageNumber("2"), 2);
  assert.equal(adminPageNumber("999999"), 999999);
});

test("status charts count only provided authorized records without changing them", () => {
  const records = Object.freeze([Object.freeze({ status: "in_service" }), Object.freeze({ status: "confirmed" }), Object.freeze({ status: "in_service" })]);
  assert.deepEqual(statusChart(records), [{ label: "confirmed", value: 1 }, { label: "in service", value: 2 }]);
  assert.deepEqual(statusChart([]), []);
  assert.equal(chartMaximum([]), 1);
  assert.equal(chartMaximum([{ label: "Empty", value: 0 }]), 1);
  assert.equal(chartMaximum([{ label: "Visits", value: 5 }]), 5);
});
