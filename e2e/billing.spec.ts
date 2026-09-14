import { expect, test } from "@playwright/test";
import { renderFormFixture } from "./fixtures/form-browser";
test.use({ browserName: "chromium" });
let html: string;
test.beforeAll(async () => { html = await renderFormFixture("e2e/fixtures/billing.tsx"); });
test.beforeEach(async ({ page }) => {
  await page.route("https://billing.test/**", route => route.fulfill({ contentType: "text/html", body: html }));
});
test("missing setup still shows current plan and catalog without broken payment controls", async ({ page }) => {
  await page.goto("https://billing.test/fixture");
  await expect(page.locator("#billing-current-plan")).toBeVisible();
  await expect(page.locator("#billing-plan-starter")).toBeVisible();
  await expect(page.locator("#billing-load-error")).toHaveCount(0);
  await expect(page.locator("#billing-setup-notice")).toBeVisible();
  await expect(page.locator('form[id^="billing-checkout"], #billing-portal-form')).toHaveCount(0);
  await page.locator("#billing-plan-details-starter summary").click();
  await expect(page.locator("#billing-plan-details-starter")).toContainText("5 staff");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.screenshot({ path: test.info().outputPath("billing.png"), fullPage: true });
});
test("configured checkout retains interval selection and submits the chosen plan once", async ({ page }) => {
  const calls: unknown[] = [];
  await page.exposeFunction("recordFormAction", (name: string, entries: unknown) => { calls.push({ name, entries }); });
  await page.goto("https://billing.test/fixture?mode=configured");
  await expect(page.locator("#billing-setup-notice")).toHaveCount(0);
  await page.locator("#billing-interval-starter").selectOption("year");
  await page.locator("#billing-choose-plan-starter").click();
  await expect.poll(() => calls.length).toBe(1);
  expect(calls).toEqual([{ name: "startCheckout", entries: [["planId", "starter"], ["interval", "year"]] }]);
});
test("subscription failure retains plans without inventing a free subscription", async ({ page }) => {
  await page.goto("https://billing.test/fixture?mode=subscription-error");
  await expect(page.locator("#billing-load-error")).toBeVisible();
  await expect(page.locator("#billing-current-plan")).toHaveCount(0);
  await expect(page.locator("#billing-plan-starter")).toBeVisible();
  await page.locator("#billing-retry-button").click();
  await expect(page).toHaveURL("https://billing.test/dashboard/settings/billing");
});
test("catalog failure and empty results retain subscription information", async ({ page }) => {
  for (const mode of ["catalog-error", "empty"]) {
    await page.goto(`https://billing.test/fixture?mode=${mode}`);
    await expect(page.locator("#billing-current-plan")).toBeVisible();
    await expect(page.locator(mode === "empty" ? "#billing-plans-empty-state" : "#billing-catalog-error")).toBeVisible();
  }
});
