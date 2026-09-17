import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import manifest from "../app/manifest";

test("install manifest uses supplied PNG assets with their actual square dimensions", () => {
  const result = manifest();
  assert.equal(result.name, "NegOSu");
  assert.equal(result.display, "standalone");
  assert.equal(result.start_url, "/dashboard");
  assert.equal(result.scope, "/");
  assert.ok(result.icons?.length);
  for (const icon of result.icons!) {
    const png = readFileSync(new URL(`../public${icon.src}`, import.meta.url));
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
    assert.equal(width, height);
    assert.equal(icon.sizes, `${width}x${height}`);
    assert.equal(icon.type, "image/png");
    assert.equal(icon.purpose, "any");
  }
});
