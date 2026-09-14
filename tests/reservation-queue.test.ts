import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadReservationQueue } from "../lib/reservation-queue";
import { privateEstimateResponseHeaders, queueDisplayResponseHeaders } from "../lib/private-route-security";
import { GET as retiredPublicQueue } from "../app/api/public/queue/[slug]/[branchId]/route";

const token = "a".repeat(64);
function database(data: unknown, error: unknown = null) {
  const calls: unknown[] = [];
  return { calls, db: { rpc: async (name: string, args: unknown) => { calls.push([name, args]); return { data, error }; } } as unknown as SupabaseClient };
}

test("reservation queue resolves all scope from the token without browser-supplied business or branch IDs", async () => {
  const snapshot = { industry: "salon", branchName: "Reserved branch", serving: [], waiting: [] };
  const { db, calls } = database(snapshot);
  assert.deepEqual(await loadReservationQueue(token, db), snapshot);
  assert.deepEqual(calls, [["get_reservation_queue", { p_booking_token: token }]]);
});

test("invalid reservation credentials cannot reach the database", async () => {
  const { db, calls } = database(null);
  for (const value of ["", "salon-slug", "../queue", "a".repeat(63), "a".repeat(65), "G".repeat(64)]) {
    await assert.rejects(loadReservationQueue(value, db), { status: 400 });
  }
  assert.equal(calls.length, 0);
});

test("ineligible reservations fail closed and database failures are not exposed", async () => {
  await assert.rejects(loadReservationQueue(token, database(null).db), { status: 404 });
  await assert.rejects(loadReservationQueue(token, database(null, { message: "private SQL details" }).db), error => {
    assert.equal((error as { status: number }).status, 503);
    assert.doesNotMatch(String(error), /private SQL details/);
    return true;
  });
});

test("retired slug-and-branch API returns no queue without consulting a database", async () => {
  const response = await retiredPublicQueue();
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "This customer queue is unavailable." });
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
});

test("reservation queue HTML and API are private, uncacheable, unindexed, and do not send referrers", () => {
  for (const path of [`/booking/${token}/queue`, `/api/booking/${token}/queue`, "/shop/my-salon/queue", "/api/public/queue/my-salon/branch"]) {
    assert.deepEqual(privateEstimateResponseHeaders(path), queueDisplayResponseHeaders);
  }
  assert.equal(queueDisplayResponseHeaders["Referrer-Policy"], "no-referrer");
  assert.equal(privateEstimateResponseHeaders("/shop/my-salon"), null);
});

test("storefront exposes no queue links and the retired page cannot render queue data", () => {
  const shop = readFileSync("app/shop/[slug]/page.tsx", "utf8");
  assert.doesNotMatch(shop, /OpenQueueDisplay|View customer queue|\/queue/);
  const retiredPage = readFileSync("app/shop/[slug]/queue/page.tsx", "utf8");
  assert.match(retiredPage, /notFound\(\)/);
  assert.doesNotMatch(retiredPage, /rpc\(|loadReservationQueue|CustomerQueueDisplay/);
});
