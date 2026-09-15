import test from "node:test";
import assert from "node:assert/strict";
import { walkInErrorMessage } from "../lib/errors/walk-in-error";

test("walk-in failures explain unavailable branch services and customer/vehicle mismatches", () => {
  assert.match(walkInErrorMessage({ code: "P0001", message: "Service is unavailable at this branch" }), /change the branch/);
  assert.match(walkInErrorMessage({ code: "P0001", message: "Appointment vehicle/customer mismatch" }), /customer's vehicle/);
  assert.match(walkInErrorMessage({ code: "42501" }), /access/);
  assert.match(walkInErrorMessage({ code: "PGRST202" }), /update the system/);
});
test("walk-in errors never expose unknown database messages or diagnostic details", () => {
  for (const code of ["P0001", "XX000", "23503", undefined]) {
    const message = walkInErrorMessage({ code, message: "Secret customer: select * from public.appointments" });
    assert.doesNotMatch(message, /Secret|select|public\./);
    assert.match(message, /entries have been kept/);
  }
  assert.match(walkInErrorMessage({ code: "23505" }), /Check the queue/);
});
