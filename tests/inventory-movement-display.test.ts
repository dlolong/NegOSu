import assert from "node:assert/strict";
import test from "node:test";
import { movementPreview } from "../lib/inventory-movement-display";

test("stock additions preview the quantity added, including opening and adjustment", () => {
  for (const type of ["purchase", "return", "opening", "adjustment"]) {
    assert.deepEqual(movementPreview("5", "2.125", type), { change: 2.125, after: 7.125 });
  }
});

test("usage and waste preview deductions and expose insufficient stock", () => {
  for (const type of ["usage", "waste"]) {
    assert.deepEqual(movementPreview(5, "1.25", type), { change: -1.25, after: 3.75 });
    assert.deepEqual(movementPreview(1, "2", type), { change: -2, after: -1 });
  }
});

test("previews retain thousandth precision without floating point artifacts", () => {
  assert.deepEqual(movementPreview(0.1, "0.2", "purchase"), { change: 0.2, after: 0.3 });
  assert.deepEqual(movementPreview("0.003", "0.002", "usage"), { change: -0.002, after: 0.001 });
});

test("incomplete or invalid quantities never show a misleading preview", () => {
  for (const quantity of ["", "-1", "0", "abc", "Infinity", "0.0001", "1000000000"]) {
    assert.equal(movementPreview(5, quantity, "purchase"), null);
  }
  assert.equal(movementPreview(NaN, "1", "purchase"), null);
  assert.equal(movementPreview(5, "1", "unknown"), null);
  assert.equal(movementPreview(5, "1", "toString"), null);
});
