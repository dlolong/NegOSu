import test from "node:test";
import assert from "node:assert/strict";
import { creditReportPayloadSchema, creditReportRequestSchema, creditReportCsv, creditReportSections, trialCreditsSchema, type CreditSnapshot } from "../modules/platform/trial-credits";
import { imageUploadAccess } from "../modules/platform/image-upload";
const payload = { kind: "clients", action: "csv_export", start: "2026-10-01", end: "2026-10-15", branch: null };
test("credit requests validate idempotency keys, bounded filters and dates", () => {
  assert.equal(creditReportRequestSchema.safeParse({ requestId: "invalid", payload }).success, false);
  for (const patch of [{ end: "2026-09-01" }, { start: "2021-01-01" }, { branch: "not-a-branch" }, { client: "x".repeat(121) }, { purchaseKind: "discount" }, { action: "free" }, { maxCost: 2 }, { maxCost: -1 }]) assert.equal(creditReportPayloadSchema.safeParse({ ...payload, ...patch }).success, false);
  assert.equal(creditReportPayloadSchema.parse({ ...payload, client: " Alex " }).client, "Alex");
});
test("credit balances must come from valid bounded server data", () => {
  for (const remaining of [-1, 101, 0.5, "100", null]) assert.equal(trialCreditsSchema.safeParse({ initial: 100, remaining }).success, false);
  assert.equal(trialCreditsSchema.parse({ initial: 100, remaining: 0 }).remaining, 0);
  assert.equal(imageUploadAccess({ planId: "free", trialCredits: { remaining: 100 } }), "upgrade");
  for (const remaining of [0, -1, 101, "1", 0.5]) assert.equal(imageUploadAccess({ planId: "free", trialCredits: { remaining } }), "upgrade");
  assert.equal(imageUploadAccess({ planId: "starter", features: { image_uploads: true }, limits: { storage_mb: 1000 }, trialCredits: { remaining: 0 } }), "allowed");
});
test("client CSV retains totals, staff, included products and formula escaping", () => {
  const snapshot: CreditSnapshot = { id: "id", createdAt: "2026-10-15T00:00:00Z", cost: 1, remaining: 99, payload: creditReportPayloadSchema.parse(payload), report: {
    count: 1, summary: { records: 1, total: 10000, paid: 6000, balance: 4000 }, rows: [{ key: "client", clientId: null, name: "=Danger", lastActivity: "2026-10-14", records: 1, branches: ["Main"], total: 10000, paid: 6000, balance: 4000, staff: [{ id: "staff", name: "Jamie, Jr." }], items: [{ kind: "service", name: "Facial", quantity: 1, unit: "", included: false }, { kind: "product", name: "Care oil", quantity: 1, unit: "bottle", included: true }] }],
  } };
  const csv = creditReportCsv(snapshot);
  assert.ok(csv.startsWith("\uFEFF")); assert.ok(csv.includes("'=Danger")); assert.ok(csv.includes('"Jamie, Jr."'));
  assert.ok(csv.includes("Care oil × 1 bottle (promo inclusion)")); assert.ok(csv.includes("10000,6000,4000"));
  assert.equal(creditReportSections(snapshot)[1].rows.length, 1);
});
test("hospitality snapshots exclude internal identifiers from CSV", () => {
  const snapshot: CreditSnapshot = { id: "id", createdAt: "2026-10-15", cost: 0, remaining: 0, payload: creditReportPayloadSchema.parse({ ...payload, kind: "hospitality" }), report: { occupied: 1, vacant: 2, cleaning: 0, inactive: 0, checkIns: 1, checkOuts: 0, inHouse: 1, rowCount: 1, page: 1, rows: [{ id: "secret-row-id", branch_id: "secret-branch-id", room: "Room 1", guest: "Guest" }] } };
  const csv = creditReportCsv(snapshot);
  assert.ok(csv.includes("Room 1")); assert.ok(!csv.includes("secret"));
});
