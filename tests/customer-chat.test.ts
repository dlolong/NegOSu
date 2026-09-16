import test from "node:test";
import assert from "node:assert/strict";
import { publicChatSchema, staffChatSchema, chatBookingNote, chatStorageKey, type ChatSnapshot } from "../modules/core/chat/contracts";
import { resolveIndustryConfig } from "../modules/platform/industry";
import { navigationForIndustry } from "../modules/platform/navigation";

const start = { operation: "start", slug: "test-business", token: "a".repeat(64), branchId: "40800000-0000-4000-8000-000000000001", customerName: "Jane Doe", body: "Do you offer this service?", requestId: "50800000-0000-4000-8000-000000000001" };
test("customer chat validates bounded messages and opaque tokens", () => {
 assert.ok(publicChatSchema.safeParse(start).success);
 for (const overrides of [{ body: "x".repeat(301) }, { body: "  " }, { token: "not-a-token" }, { branchId: "other" }, { requestId: "invalid" }, { customerName: "J" }, { slug: "../private" }]) assert.equal(publicChatSchema.safeParse({ ...start, ...overrides }).success, false);
 assert.ok(publicChatSchema.safeParse({ ...start, operation: "send", body: "x".repeat(300) }).success);
});
test("staff replies and operations are constrained", () => {
 assert.ok(staffChatSchema.safeParse({ operation: "reply", id: start.branchId, requestId: start.requestId, body: "x".repeat(1000) }).success);
 assert.equal(staffChatSchema.safeParse({ operation: "reply", id: start.branchId, requestId: start.requestId, body: "x".repeat(1001) }).success, false);
 assert.equal(staffChatSchema.safeParse({ operation: "delete", id: start.branchId }).success, false);
});
test("booking handoff includes only bounded customer notes, not staff replies", () => {
 const snapshot = { messages: [{ sender: "staff", body: "Internal routing response" }, ...Array.from({ length: 5 }, () => ({ sender: "customer", body: "x".repeat(400) }))] } as ChatSnapshot;
 const note = chatBookingNote(snapshot);
 assert.ok(note.length < 1000); assert.equal(note.includes("Internal"), false); assert.equal(note.split("\n").length, 4);
 assert.notEqual(chatStorageKey("one"), chatStorageKey("two"));
});
test("all industries offer the same permission-scoped customer inbox", () => {
 for (const industry of ["automotive", "salon", "pet_care"]) {
  const inbox = navigationForIndustry(resolveIndustryConfig(industry)).find(item => item.key === "inbox");
  assert.equal(inbox?.href, "/dashboard/inbox"); assert.equal(inbox?.permission, "appointments.manage");
 }
});
