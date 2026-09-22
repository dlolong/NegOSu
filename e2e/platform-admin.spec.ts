import { expect, test } from "@playwright/test";
import { renderFormFixture } from "./fixtures/form-browser";
let html: string;
test.beforeAll(async () => { html = await renderFormFixture("e2e/fixtures/platform-admin.tsx"); });
test.beforeEach(async ({ page }) => {
  await page.route("https://platform.test/**", route => route.fulfill({ contentType: "text/html", body: html }));
});
test("admin charts and directories work on narrow and wide screens", async ({ page }) => {
  await page.goto("https://platform.test/");
  await expect(page.locator("#admin-signups-chart svg")).toBeVisible();
  await expect(page.locator("#admin-payments-chart")).toContainText("Live payment collections");
  await page.locator("#admin-signups-chart-data-toggle").click();
  await expect(page.locator("#admin-signups-chart table")).toBeVisible();
  await expect(page.locator("#admin-signups-chart tbody tr")).toHaveCount(30);
  await expect(page.locator("#admin-signups-table")).toContainText("Unverified");
  await expect(page.locator("#fixture-staff-chart")).toContainText("confirmed");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.screenshot({ path: test.info().outputPath("platform-admin.png"), fullPage: true });
});
test("empty charts and directories show explicit empty states", async ({ page }) => {
  await page.goto("https://platform.test/?empty=1");
  await expect(page.locator("#admin-signups-chart")).toContainText("No activity");
  await expect(page.locator("#admin-signups-table-empty")).toBeVisible();
  await expect(page.locator("#fixture-staff-chart")).toContainText("No activity");
});
