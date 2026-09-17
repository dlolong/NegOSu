import assert from "node:assert/strict";
import test from "node:test";
import { availableShiftPreferences, shiftPreferenceKey } from "../modules/hospitality/shift-preferences";
const cashier = "10000000-0000-4000-8000-000000000001";
const housekeeper = "10000000-0000-4000-8000-000000000002";
const raw = JSON.stringify({ cashierStaffId: cashier, housekeeperStaffId: housekeeper });
const scope = { userId: "user-a", organizationId: "org-a", branchId: "branch-a" };
test("shift preferences are isolated by user, workspace and branch", () => {
  const keys = [scope, { ...scope, userId: "user-b" }, { ...scope, organizationId: "org-b" }, { ...scope, branchId: "branch-b" }].map(shiftPreferenceKey);
  assert.equal(new Set(keys).size, 4);
  assert.match(keys[0], /^negosu:shift-staff:v1:/);
});
test("check-in and checkout can reuse the same two available staff", () => {
  assert.deepEqual(availableShiftPreferences(raw, [cashier, housekeeper]), { cashierStaffId: cashier, housekeeperStaffId: housekeeper });
});
test("inactive, moved or inaccessible staff are removed individually", () => {
  assert.deepEqual(availableShiftPreferences(raw, [housekeeper]), { cashierStaffId: "", housekeeperStaffId: housekeeper });
  assert.deepEqual(availableShiftPreferences(raw, []), { cashierStaffId: "", housekeeperStaffId: "" });
});
for (const bad of ["", "bad json", "null", "[]", "{}", '{"cashierStaffId":42,"housekeeperStaffId":null}']) test(`malformed preferences safely start blank (${bad})`, () => {
  assert.deepEqual(availableShiftPreferences(bad, [cashier, housekeeper]), { cashierStaffId: "", housekeeperStaffId: "" });
});
test("a stored name or invalid ID cannot become a selection", () => {
  assert.deepEqual(availableShiftPreferences(JSON.stringify({ cashierStaffId: "Owner", housekeeperStaffId: housekeeper }), ["Owner", housekeeper]), { cashierStaffId: "", housekeeperStaffId: housekeeper });
});
test("clearing one field preserves the other choice", () => {
  assert.deepEqual(availableShiftPreferences(JSON.stringify({ cashierStaffId: "", housekeeperStaffId: housekeeper }), [cashier, housekeeper]), { cashierStaffId: "", housekeeperStaffId: housekeeper });
});
