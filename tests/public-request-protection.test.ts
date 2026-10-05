import assert from "node:assert/strict";
import test from "node:test";
import { publicRequestRateKey, publicBookingProtectionError } from "../lib/public-request-protection";
import { publicOrderError } from "../modules/core/commerce/public-product-orders";

test("rate identity is stable across proxy formatting and missing headers", () => {
  assert.equal(publicRequestRateKey(" 192.0.2.1, 10.0.0.1"), publicRequestRateKey("192.0.2.1"));
  assert.equal(publicRequestRateKey(null), publicRequestRateKey(""));
  assert.match(publicRequestRateKey("192.0.2.1"), /^[a-f0-9]{64}$/);
  assert.notEqual(publicRequestRateKey("192.0.2.1"), publicRequestRateKey("192.0.2.2"));
});
test("booking duplicate and rate rejections explain how to proceed without leaking diagnostics", () => {
  for (const error of [{code:"P0409"}, {message:"A similar booking request is already pending"}]) {
    assert.match(publicBookingProtectionError(error)!, /already pending/);
  }
  for (const error of [{code:"54000"}, {message:"Too many booking requests"}]) {
    assert.match(publicBookingProtectionError(error)!, /try again later/);
  }
  assert.equal(publicBookingProtectionError({message:"private SQL diagnostic"}), null);
  assert.match(publicOrderError("P0409"), /already pending/);
});
