import test from "node:test";
import assert from "node:assert/strict";
import { statusColor } from "../lib/status-colors";
test("status colors distinguish major workflow states", () => {
 const colors=["completed","confirmed","in_progress","pending","cancelled","inactive"].map(statusColor);
 assert.ok(colors.every(Boolean));
 assert.equal(new Set(colors).size,colors.length);
});
test("status labels normalize separators and casing without guessing descriptive text", () => {
 assert.equal(statusColor("In progress"),statusColor("in_progress"));
 assert.equal(statusColor("No-show"),statusColor("no_show"));
 assert.equal(statusColor("Technician assigned"),undefined);
});

test("every appointment status has a distinct explicit color", () => {
 const colors = ["requested","confirmed","checked_in","queued","in_service","completed","cancelled","no_show"].map(statusColor);
 assert.ok(colors.every(Boolean));
 assert.equal(new Set(colors).size,colors.length);
});
