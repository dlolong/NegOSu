import assert from "node:assert/strict";
import test from "node:test";
import { appointmentBackLink, historyPage, reminderInstant, reminderSchema } from "../modules/core/crm/client-reminders";
const valid = { id: "10000000-0000-4000-8000-000000000001", customerId: "10000000-0000-4000-8000-000000000002", branchId: "10000000-0000-4000-8000-000000000003", reason: " Facial follow-up ", dueAt: "2026-10-05T14:30" };
test("reminders require valid identities, a bounded reason and a calendar time", () => {
  assert.equal(reminderSchema.parse(valid).reason, "Facial follow-up");
  for (const update of [{ reason: " " }, { reason: "a".repeat(501) }, { customerId: "bad" }, { branchId: "bad" }, { id: "bad" }, { dueAt: "2026-02-30T12:00" }, { dueAt: "" }]) assert.equal(reminderSchema.safeParse({ ...valid, ...update }).success, false);
});
test("reminder time uses the branch timezone and rejects nonexistent local times", () => {
  assert.equal(reminderInstant(valid.dueAt, "Asia/Manila"), "2026-10-05T06:30:00.000Z");
  assert.equal(reminderInstant("2026-03-08T02:30", "America/New_York"), null);
});
test("appointment return navigation only accepts the known client origin", () => {
  assert.deepEqual(appointmentBackLink("clients"), { href: "/dashboard/customers", label: "Back to Clients" });
  assert.equal(appointmentBackLink("clients", true).href, "/dashboard/customers");
  for (const from of [undefined, "//evil.test", "/dashboard/customers", "appointments"]) assert.equal(appointmentBackLink(from).href, "/dashboard/appointments");
  assert.equal(appointmentBackLink(undefined, true).href, "/dashboard/pet-care/appointments");
});
test("history pagination bounds unsafe and malformed offsets", () => {
  for (const value of [undefined, "0", "-1", "NaN", "Infinity", "1.5"]) assert.equal(historyPage(value), 1);
  assert.equal(historyPage("2"), 2);
  assert.equal(historyPage("999999"), 50001);
});
