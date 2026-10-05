import { expect, test } from "@playwright/test";
import { renderFormFixture } from "./fixtures/form-browser";

let html: string;
test.beforeAll(async () => { html = await renderFormFixture("e2e/fixtures/command-center-layout.tsx"); });
for (const width of [390, 768, 1366, 2072]) {
  test(`Command Center layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 976 });
    await page.route("https://forms.test/**", route => route.fulfill({ contentType: "text/html", body: html }));
    await page.goto("https://forms.test/dashboard");
    await expect(page.locator("#negosu-command-center-header")).toBeVisible();
    const bounds = async (id: string) => (await page.locator(`#${id}`).boundingBox())!;
    const primary = await bounds("command-center-workspace-primary");
    const rail = await bounds("command-center-workspace-sidebar");
    if (width >= 1280) {
      expect(Math.abs(primary.y - rail.y)).toBeLessThan(2);
      expect(rail.x).toBeGreaterThanOrEqual(primary.x + primary.width);
      const activity = await bounds("command-center-activity-chart");
      const finance = await bounds("command-center-finance-chart");
      expect(Math.abs(activity.y - finance.y)).toBeLessThan(2);
    } else {
      expect(rail.y).toBeGreaterThanOrEqual(primary.y + primary.height);
    }
    expect(await page.locator("#command-center-workspace-sidebar").evaluate(el => getComputedStyle(el).overflowY)).toBe("visible");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator("#negosu-command-center-quick-action-new-appointment")).toHaveAttribute("href", "/dashboard/appointments/new");
  });
}
