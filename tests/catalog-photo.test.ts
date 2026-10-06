import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { updateCatalogPhoto } from "../modules/core/catalog/photo";
const id = "a1000000-0000-4000-8000-000000000001";
const actor = { role: "owner", organizationId: "org", branchId: "branch", industry: "salon" };
const input = { kind: "product", id, url: "https://images.test/new.jpg", previousUrl: null };
function database(data: unknown = { id }, error: unknown = null) {
  const calls: Array<[string, ...unknown[]]> = [];
  const chain = {
    from(value: string) { calls.push(["from", value]); return chain; },
    update(value: unknown) { calls.push(["update", value]); return chain; },
    select(value: string) { calls.push(["select", value]); return chain; },
    eq(key: string, value: unknown) { calls.push(["eq", key, value]); return chain; },
    is(key: string, value: unknown) { calls.push(["is", key, value]); return chain; },
    async maybeSingle() { return { data, error }; },
    async rpc(name: string, value: unknown) { calls.push(["rpc", name, value]); return { error }; },
  };
  return { db: chain as unknown as SupabaseClient, calls };
}
test("photo saves reject unauthorized roles, invalid IDs and unsafe URLs before database access", async () => {
  const { db, calls } = database();
  assert.ok((await updateCatalogPhoto(db, { ...actor, role: "viewer" }, input)).error);
  for (const change of [{ id: "bad" }, { url: "javascript:alert(1)" }, { url: "https://user:password@images.test/a.jpg" }, { kind: "other" }]) assert.ok((await updateCatalogPhoto(db, actor, { ...input, ...change })).error);
  assert.equal(calls.length, 0);
});
test("product photo saves only update the image in the actor's organization and branch, with a concurrency check", async () => {
  const { db, calls } = database();
  assert.deepEqual(await updateCatalogPhoto(db, actor, input), {});
  assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(["update", { thumbnail_url: input.url }])));
  assert.ok(calls.some(call => call[0] === "eq" && call[1] === "organization_id" && call[2] === "org"));
  assert.ok(calls.some(call => call[0] === "eq" && call[1] === "branch_id" && call[2] === "branch"));
  assert.ok(calls.some(call => call[0] === "is" && call[1] === "thumbnail_url" && call[2] === null));
});
test("missing, cross-scope and concurrently modified records fail without exposing raw database errors", async () => {
  for (const error of [null, { message: "secret SQL details", code: "42501" }]) {
    const { db } = database(null, error);
    const result = await updateCatalogPhoto(db, actor, input);
    assert.ok(result.error);
    assert.ok(!result.error.includes("secret"));
  }
});
test("service photo removal keeps the organization-wide service scope and compares the prior image", async () => {
  const { db, calls } = database();
  assert.deepEqual(await updateCatalogPhoto(db, actor, { ...input, kind: "service", url: "", previousUrl: "https://images.test/old.jpg" }), {});
  assert.ok(calls.some(call => call[0] === "from" && call[1] === "services"));
  assert.ok(calls.some(call => call[0] === "update" && (call[1] as { thumbnail_url: unknown }).thumbnail_url === null));
  assert.ok(calls.some(call => call[0] === "eq" && call[1] === "thumbnail_url" && call[2] === "https://images.test/old.jpg"));
  assert.ok(!calls.some(call => call[1] === "branch_id"));
});
test("promo photos preserve authoritative fields and use version checked RPC; stale images are rejected", async () => {
  const promo = { id, name: "Offer", description: "Keep", image_url: null, version: 7, price_centavos: 1234, status: "active", valid_from: null, valid_through: null, components: [{ kind: "service" }], is_public: true };
  const { db, calls } = database(promo);
  assert.deepEqual(await updateCatalogPhoto(db, actor, { ...input, kind: "promo", price: 1, version: 1 }), {});
  const rpc = calls.find(call => call[0] === "rpc")!;
  assert.equal(rpc[1], "save_commerce_promo_details");
  const payload = rpc[2] as Record<string, unknown>;
  assert.equal(payload.p_version, 7); assert.equal(payload.p_price, 1234); assert.equal(payload.p_is_public, true);
  assert.equal(payload.p_org, "org"); assert.equal(payload.p_branch, "branch"); assert.equal(payload.p_image_url, input.url);
  const stale = database({ ...promo, image_url: "https://images.test/other.jpg" });
  assert.ok((await updateCatalogPhoto(stale.db, actor, { ...input, kind: "promo" })).error);
  assert.ok(!stale.calls.some(call => call[0] === "rpc"));
});
