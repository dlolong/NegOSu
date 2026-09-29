import test from "node:test";
import assert from "node:assert/strict";
import { publicServiceThumbnailSchema } from "../lib/public-booking";
const serviceId = "a1000000-0000-4000-8000-000000000001";
test("service thumbnail validation supports saving and clearing without changing service identity", () => {
  assert.deepEqual(publicServiceThumbnailSchema.parse({ serviceId, thumbnailUrl: " https://example.test/photo.jpg " }), { serviceId, thumbnailUrl: "https://example.test/photo.jpg" });
  assert.equal(publicServiceThumbnailSchema.parse({ serviceId, thumbnailUrl: "" }).thumbnailUrl, "");
  for (const thumbnailUrl of ["javascript:alert(1)", "data:image/png;base64,xx", "https://user:password@example.test/photo.jpg", "not-a-url", "https://example.test/" + "x".repeat(2048)]) assert.equal(publicServiceThumbnailSchema.safeParse({ serviceId, thumbnailUrl }).success, false);
  assert.equal(publicServiceThumbnailSchema.safeParse({ serviceId: "invalid", thumbnailUrl: "" }).success, false);
});
