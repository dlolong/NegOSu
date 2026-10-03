import assert from "node:assert/strict";
import test from "node:test";
import { serviceSchema } from "../lib/operations";

const service = { name: "Hair treatment", categoryId: "", description: "", shortDescription: "", code: "", durationMinutes: "30", basePrice: "250", isAddOn: false, parentServiceId: "" };
test("service photos allow safe URLs, clearing, and older submissions", () => {
  assert.equal(serviceSchema.parse(service).thumbnailUrl, undefined);
  assert.equal(serviceSchema.parse({ ...service, thumbnailUrl: "" }).thumbnailUrl, "");
  assert.equal(serviceSchema.parse({ ...service, thumbnailUrl: " https://example.test/photo.jpg " }).thumbnailUrl, "https://example.test/photo.jpg");
});
test("service photos reject unsafe protocols, embedded credentials, and oversized URLs", () => {
  for (const thumbnailUrl of ["javascript:alert(1)", "data:image/png;base64,abc", "https://user:secret@example.test/photo.jpg", "https://example.test/" + "a".repeat(2048)]) {
    assert.equal(serviceSchema.safeParse({ ...service, thumbnailUrl }).success, false);
  }
});
