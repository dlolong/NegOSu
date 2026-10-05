import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { listingDate, listingDateEnd, listingOrSearch, listingPattern, listingSearch } from "../lib/listing-query";
import { recordMatches, recordText } from "../lib/record-table-search";
test("search treats wildcards literally and bounds input", () => {
  assert.equal(listingPattern("  50%_off  "), "%50\\%\\_off%");
  assert.equal(listingSearch("x".repeat(500)).length, 120);
  const input = 'name,phone.eq.secret)"';
  assert.equal(listingOrSearch(["customer_name","product_name"], input), `customer_name.ilike.${JSON.stringify(listingPattern(input))},product_name.ilike.${JSON.stringify(listingPattern(input))}`);
  assert.equal(listingOrSearch(["unsafe,field"], "abc"), "");
});
test("date filters reject invalid days and use an exclusive end boundary", () => {
  assert.equal(listingDate("2026-02-30"), undefined);
  assert.equal(listingDate("2026-2-1"), undefined);
  assert.equal(listingDate("2028-02-29"), "2028-02-29");
  assert.equal(listingDateEnd("2026-12-31"), "2027-01-01T00:00:00.000Z");
});
test("local list search matches displayed nested text without indexing hidden input values", () => {
  const cells = { name: createElement("strong", null, "Facial treatment"), status: "Completed", action: createElement("input", {type:"hidden",value:"private-key"}) };
  assert.equal(recordMatches(cells, " FACIAL "), true);
  assert.equal(recordMatches(cells, "completed"), true);
  assert.equal(recordMatches(cells, "private-key"), false);
  assert.equal(recordText([null, false, 3, createElement("span", null, "items")]), "  3 items");
});
