import test from "node:test";
import assert from "node:assert/strict";
import { petAppointmentPersistenceError } from "../modules/pet-care/scheduling-errors";
import { normalizeActionError } from "../lib/errors/action-error";

test("Pet scheduling errors retain actionable hours, pet, staff, and resource guidance", () => {
  for (const [code, message, expected] of [
    ["P0001", "Grooming appointment is outside branch hours", /operating hours/],
    ["23P01", "This pet already has a grooming appointment at that time", /pet already has/],
    ["P0001", "Assign a groomer and grooming resource", /Select a groomer/],
    ["P0001", "The assigned groomer is busy", /already booked/],
    ["P0001", "Grooming resource capacity exceeded", /fully booked/],
  ] as const) assert.match(normalizeActionError(petAppointmentPersistenceError({ code, message }), "fallback"), expected);
});
test("Pet scheduling infrastructure errors preserve diagnostic causes without exposing database text", () => {
  const source = { code: "42703", message: 'column "private_column" does not exist' };
  const error = petAppointmentPersistenceError(source);
  assert.equal(error.cause, source);
  assert.equal(normalizeActionError(error, "Unable to save"), "Unable to save");
});
