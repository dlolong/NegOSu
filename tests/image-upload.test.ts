import test from "node:test";
import assert from "node:assert/strict";
import { imageFileType, imageUploadAccess, imageUploadAllowed, MAX_IMAGE_BYTES } from "../modules/platform/image-upload";
test("image uploads require explicit effective plan feature and capacity", () => {
 for (const value of [null, {}, { features: { image_uploads: true } }, { features: { image_uploads: false }, limits: { storage_mb: 100 } }, { features: { image_uploads: true }, limits: { storage_mb: 0 } }]) assert.equal(imageUploadAllowed(value), false);
 assert.equal(imageUploadAllowed({ features: { image_uploads: true }, limits: { storage_mb: 1000 } }), true);
 assert.equal(imageUploadAllowed({ features: { image_uploads: true }, limits: { storage_mb: -1 } }), true);
});
test("paid plans with missing upload configuration are not asked to buy another plan", () => {
 assert.equal(imageUploadAccess({ planId: "free", features: {}, limits: {} }), "upgrade");
 for (const planId of ["starter", "business", "pro", "multi_branch"]) {
  assert.equal(imageUploadAccess({ planId, features: {}, limits: {} }), "unavailable");
  assert.equal(imageUploadAccess({ planId, features: { image_uploads: true }, limits: {} }), "unavailable");
  assert.equal(imageUploadAccess({ planId, features: { image_uploads: false }, limits: { storage_mb: 1000 } }), "unavailable");
  assert.equal(imageUploadAccess({ planId, features: { image_uploads: true }, limits: { storage_mb: 1000 } }), "allowed");
 }
 for (const storage_mb of [null, "1000", 0, -2, Infinity, NaN, 0.5]) {
  assert.equal(imageUploadAccess({ planId: "starter", features: { image_uploads: true }, limits: { storage_mb } }), "unavailable");
 }
 assert.equal(imageUploadAccess(null), "unavailable");
});
test("file signatures and size are validated independently of client extension", () => {
 const png = Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,0]);
 assert.equal(imageFileType(png)?.mime, "image/png");
 assert.equal(imageFileType(Uint8Array.from([255,216,255,0,0,0,0,0,0,0,0,0]))?.extension, "jpg");
 assert.equal(imageFileType(new TextEncoder().encode("RIFF0000WEBPdata"))?.mime, "image/webp");
 assert.equal(imageFileType(new TextEncoder().encode("<svg>unsafe</svg>")), null);
 assert.equal(imageFileType(new Uint8Array(0)), null);
 assert.equal(imageFileType(new Uint8Array(MAX_IMAGE_BYTES+1)), null);
});
