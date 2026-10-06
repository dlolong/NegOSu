import assert from "node:assert/strict";
import test from "node:test";
import { clearFiltersHref } from "../lib/clear-filters";
test("clear stays hidden without effective filters", () => {
 for (const url of ["/inventory","/inventory?status=all&q=","/inventory?tab=history&page=2"]) assert.equal(clearFiltersHref(url,["q","status"]),null);
});
test("clear removes filters and page while preserving navigation context", () => {
 assert.equal(clearFiltersHref("/inventory?tab=history&category=Skin&q=cream&page=3",["category","q"]),"/inventory?tab=history");
 assert.equal(clearFiltersHref("/inventory?start=2026-10-01&end=2026-10-31&branch=all",["start","end","branch"]),"/inventory");
});
