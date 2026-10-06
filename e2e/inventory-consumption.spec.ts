import { expect, test } from "@playwright/test";
import { renderFormFixture } from "./fixtures/form-browser";
let html: string;
test.beforeAll(async () => { html = await renderFormFixture("e2e/fixtures/inventory-consumption.tsx"); });
test.beforeEach(async ({ page }) => { await page.route("https://forms.test/**", route => route.fulfill({ contentType: "text/html", body: html })); });
test("monthly cards show per-product usage and non-stock state without page overflow", async ({ page }) => {
  await page.goto("https://forms.test/inventory");
  await expect(page.locator("#inventory-monthly-product-soap")).toContainText("September 2026");
  await expect(page.locator("#inventory-monthly-product-soap")).toContainText("1.25 L");
  await expect(page.locator("#inventory-monthly-product-soap")).toContainText("0.5 L");
  await expect(page.locator("#inventory-monthly-product-nonstock")).toContainText("consumption not tracked");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.screenshot({ path: test.info().outputPath("monthly-products.png"), fullPage: true });
});
test("daily table preserves product totals and contains its horizontal scroll", async ({ page }) => {
  await page.goto("https://forms.test/inventory?daily=1");
  await expect(page.locator("#inventory-consumption-product-soap")).toContainText("1.75");
  await expect(page.locator("#inventory-consumption-product-soap")).toContainText("Main");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});
test("empty monthly view explains missing results", async ({ page }) => {
  await page.goto("https://forms.test/inventory?empty=1");
  await expect(page.getByText("No products match these filters.")).toBeVisible();
});
