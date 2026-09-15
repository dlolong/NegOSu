import test from "node:test";
import assert from "node:assert/strict";
import { reportActionError } from "../lib/errors/action-error";

test("action diagnostics serialize operation and code without logging database details or customer data", () => {
  const original = console.error, calls: unknown[][] = [];
  console.error = (...args: unknown[]) => { calls.push(args); };
  try {
    const result = reportActionError("appointment.save", new Error("private customer data", { cause: { code: "23503", message: "private SQL details" } }), "Please try again.");
    assert.equal(result, "Please try again.");
    assert.equal(calls[0][0], "server_action.failure");
    assert.equal(typeof calls[0][1], "string");
    assert.deepEqual(JSON.parse(calls[0][1] as string), { operation: "appointment.save", category: "Error", code: "23503" });
    assert.doesNotMatch(JSON.stringify(calls), /private/);
  } finally { console.error = original; }
});

test("missing-column diagnostics log identifiers but reject arbitrary database text", () => {
  const original = console.error, calls: unknown[][] = [];
  console.error = (...args: unknown[]) => { calls.push(args); };
  try {
    for (const message of ['column "service_id" does not exist', 'record "new" has no field "appointment_id"', 'private customer data']) {
      reportActionError("appointment.save", new Error("private", { cause: { code: "42703", message } }), "Try again");
    }
    assert.deepEqual(calls.map(call => JSON.parse(call[1] as string).schema), ['missing column "service_id"', 'missing field new.appointment_id', 'missing database column']);
    assert.doesNotMatch(JSON.stringify(calls), /private/);
  } finally { console.error = original; }
});
