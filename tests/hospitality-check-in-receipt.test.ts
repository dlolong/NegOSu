import { test } from "node:test";
import assert from "node:assert/strict";
import { checkInReceiptAmounts } from "../modules/hospitality/check-in-receipt";
const rate = { priceCentavos: 100000, finalCentavos: 80000, currency: "PHP", label: "12 hours", durationMinutes: 720 };
const arrival = { tendered: 120000, deposit: 20000, method: "cash" };
test("receipt separates discounted room payment, refundable deposit and change", () => {
  const result = checkInReceiptAmounts(rate, arrival)!;
  assert.equal(result.payment, 80000); assert.equal(result.deposit, 20000);
  assert.equal(result.total, 100000); assert.equal(result.change, 20000);
});
test("receipt accepts exact noncash settlement and zero room payment", () => {
  assert.equal(checkInReceiptAmounts(rate, { ...arrival, method: "gcash", tendered: 100000 })?.change, 0);
  const result = checkInReceiptAmounts({ ...rate, finalCentavos: 0 }, { ...arrival, tendered: 20000 });
  assert.equal(result?.payment, 0); assert.equal(result?.total, 20000);
});
test("old paid arrivals without final price or deposit use original rate", () => {
  const { finalCentavos: _, ...original } = rate; void _;
  assert.equal(checkInReceiptAmounts(original, { tendered: 100000, method: "cash" })?.total, 100000);
});
test("missing or inconsistent snapshots never fabricate a receipt", () => {
  assert.equal(checkInReceiptAmounts(null, arrival), null);
  assert.equal(checkInReceiptAmounts(rate, {}), null);
  assert.equal(checkInReceiptAmounts(rate, { ...arrival, tendered: 1 }), null);
  assert.equal(checkInReceiptAmounts(rate, { ...arrival, method: "card" }), null);
  assert.equal(checkInReceiptAmounts(rate, { ...arrival, deposit: -1 }), null);
});
