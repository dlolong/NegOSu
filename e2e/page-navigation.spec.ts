import { expect, test } from "@playwright/test";
import { renderFormFixture } from "./fixtures/form-browser";
let html: string;
test.beforeAll(async () => { html = await renderFormFixture("e2e/fixtures/page-navigation.tsx"); });
test.beforeEach(async ({ page }) => { await page.route("https://forms.test/**", route => route.fulfill({ contentType: "text/html", body: html })); });
test("back sits above the tabs and title and close stays at the top right on narrow pages", async ({ page }) => {
 await page.goto("https://forms.test/navigation?pathname=/dashboard/customers/example");
 const back = page.locator("#dashboard-page-back-button"), title = page.getByRole("heading", { level: 1 }), close = page.locator("#test-close"), header = page.locator("#navigation-header");
 await expect(back).toHaveAttribute("href", "/dashboard/customers");
 const [b,t,c,h] = await Promise.all([back.boundingBox(),title.boundingBox(),close.boundingBox(),header.boundingBox()]);
 const tabs = await page.locator("#test-tabs").boundingBox();
 expect(b!.y+b!.height).toBeLessThanOrEqual(tabs!.y);
 expect(b!.y+b!.height).toBeLessThanOrEqual(t!.y);
 await expect(back.locator("svg")).toBeVisible();
 expect(Math.abs(c!.y-h!.y)).toBeLessThan(3);
 expect(Math.abs(c!.x+c!.width-h!.x-h!.width)).toBeLessThan(3);
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test("explicit contextual back replaces the default; legacy titles share the same slot", async ({ page }) => {
 await page.goto("https://forms.test/navigation?custom=1&pathname=/dashboard/customers/example");
 await expect(page.locator("#custom-back")).toBeVisible();
 await expect(page.locator("[data-page-back-target] svg").first()).toBeVisible();
 await expect(page.locator("#dashboard-page-back-button")).toHaveCount(0);
 await page.goto("https://forms.test/navigation?legacy=1&pathname=/dashboard/customers/example");
 await expect(page.locator('[data-page-back-target] #dashboard-page-back-button')).toHaveCount(1);
});
