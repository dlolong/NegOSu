import assert from "node:assert/strict";
import test from "node:test";
import { parseCatalogPrice } from "../modules/core/commerce/pricing";
import { promoSchema } from "../modules/core/commerce/promos";

test("catalog prices become exact JSON-safe numbers for product and promo saves", () => {
  for (const [input, expected] of [["0", 0], ["12.50", 1250], ["0.01", 1], ["1,234.56", 123456], ["100000000", 10000000000]] as const) {
    const price = parseCatalogPrice(input);
    assert.equal(price, expected);
    assert.doesNotThrow(() => JSON.stringify({ p_price: price }));
    assert.ok(promoSchema.shape.priceCentavos.safeParse(price).success);
  }
});

test("catalog rejects invalid prices and out-of-range bigint amounts before conversion", () => {
  for (const input of ["", "-1", "1.234", "100000000.01", "9007199254740993", "abc", "Infinity"]) assert.equal(parseCatalogPrice(input), null);
});
