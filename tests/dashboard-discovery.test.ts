import assert from "node:assert/strict";
import test from "node:test";
import { dashboardFeaturePreviews, publicWebsiteSummary } from "../lib/dashboard-discovery";

test("website is published only for active organizations with publication enabled", () => {
  const summarize = (organization: Parameters<typeof publicWebsiteSummary>[2]) => publicWebsiteSummary("https://example.com", "my-shop", organization);
  assert.equal(summarize({ status: "active", public_page_enabled: true }).status, "published");
  assert.equal(summarize({ status: "active", public_page_enabled: false }).status, "draft");
  assert.equal(summarize({ status: "suspended", public_page_enabled: true }).status, "inactive");
  assert.equal(summarize(null).status, "unavailable");
});

test("website address uses the configured origin and encodes the organization slug", () => {
  assert.equal(publicWebsiteSummary("https://example.com/", "shop/?name=test", null).url, "https://example.com/shop/shop%2F%3Fname%3Dtest");
});

test("feature previews follow existing role permissions", () => {
  assert.deepEqual(dashboardFeaturePreviews("salon", "owner").map(item => item.key), ["new-sale", "bookings", "inbox"]);
  assert.deepEqual(dashboardFeaturePreviews("salon", "advisor").map(item => item.key), ["bookings", "inbox"]);
  assert.deepEqual(dashboardFeaturePreviews("salon", "viewer").map(item => item.key), ["reports"]);
  assert.deepEqual(dashboardFeaturePreviews("salon", "technician"), []);
});

test("feature previews respect vertical capabilities and stay compact", () => {
  const hospitality = dashboardFeaturePreviews("hospitality", "owner");
  assert.ok(hospitality.length <= 3);
  assert.ok(!hospitality.some(item => item.key === "bookings" || item.key === "inbox"));
  assert.ok(hospitality.some(item => item.key === "reports"));
  assert.ok(dashboardFeaturePreviews("pet_care", "owner").some(item => item.href === "/dashboard/bookings"));
});

test("product sale shortcut is available only to checkout roles across supported businesses", () => {
 for (const industry of ["salon", "automotive", "pet_care", "hospitality"]) {
  for (const role of ["owner", "manager", "cashier"] as const) assert.ok(dashboardFeaturePreviews(industry, role).some(item => item.href === "/dashboard/checkout/new"));
  for (const role of ["advisor", "technician", "viewer"] as const) assert.ok(!dashboardFeaturePreviews(industry, role).some(item => item.key === "new-sale"));
 }
});
