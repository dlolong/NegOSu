import { expect, test } from "@playwright/test";
import { renderFormFixture } from "./fixtures/form-browser";

let html: string;
test.beforeAll(async () => { html = await renderFormFixture("e2e/fixtures/dashboard-discovery.tsx"); });
test.beforeEach(async ({ page }) => {
  await page.route("https://forms.test/**", route => route.fulfill({ contentType: "text/html", body: html }));
});

test("published website has a visible URL and permission-aware feature links without overflow", async ({ page }) => {
  await page.goto("https://forms.test/discovery");
  await expect(page.locator("#dashboard-website-status")).toHaveText("Published");
  await expect(page.locator("#dashboard-website-public-link")).toHaveAttribute("href", /https:\/\/example.com\/shop\//);
  await expect(page.locator("#dashboard-website-settings-link")).toHaveAttribute("href", "/dashboard/settings/public-page");
  await expect(page.locator("#dashboard-discover-bookings")).toBeVisible();
  await expect(page.locator("#dashboard-discover-inbox")).toBeVisible();
  await expect(page.locator("#dashboard-discover-new-sale")).toBeVisible();
  await expect(page.locator("#dashboard-reminders-shortcut")).toHaveAttribute("href", "/dashboard/customers/reminders?status=scheduled");
  expect(await page.locator("#root").evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
});

test("unpublished and unavailable websites do not link to a missing public page", async ({ page }) => {
  for (const [state, label] of [["draft", "Not published"], ["unavailable", "Status unavailable"]]) {
    await page.goto(`https://forms.test/discovery?state=${state}`);
    await expect(page.locator("#dashboard-website-status")).toHaveText(label);
    await expect(page.locator("#dashboard-website-url")).toContainText("https://example.com/shop/");
    await expect(page.locator("#dashboard-website-public-link")).toHaveCount(0);
    await expect(page.locator("#dashboard-website-settings-link")).toBeVisible();
  }
});

test("staff do not receive management or report shortcuts", async ({ page }) => {
  await page.goto("https://forms.test/discovery?state=staff");
  await expect(page.locator("#dashboard-discover-bookings")).toBeVisible();
  await expect(page.locator("#dashboard-website-settings-link")).toHaveCount(0);
  await expect(page.locator("#dashboard-discover-reports")).toHaveCount(0);
});
