import test from "node:test";
import assert from "node:assert/strict";
import { inquirySchema } from "../modules/platform/inquiries";

const valid = { id: "13400000-0000-4000-8000-000000000001", name: " Jane Client ", email: "JANE@example.com", subject: " Plans question ", message: "Can you explain your subscription plans?", website: "" };
test("inquiry validation normalizes contact and accepts a retry identity", () => {
 const result = inquirySchema.parse(valid);
 assert.equal(result.name, "Jane Client");
 assert.equal(result.email, "jane@example.com");
 assert.equal(result.subject, "Plans question");
 assert.equal(result.id, valid.id);
});
test("invalid contact, short or oversized messages and bot field are rejected", () => {
 for (const change of [{id:"bad"},{name:" "},{name:"x".repeat(121)},{email:"bad"},{subject:"Hi"},{subject:"x".repeat(161)},{message:"short"},{message:"x".repeat(5001)},{website:"https://spam.test"}]) {
  assert.equal(inquirySchema.safeParse({...valid,...change}).success, false);
 }
});
