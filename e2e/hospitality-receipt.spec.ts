import { expect, test } from "@playwright/test";
import { renderFormFixture } from "./fixtures/form-browser";
let html: string;
test.beforeAll(async () => { html = await renderFormFixture("e2e/fixtures/hospitality-receipt.tsx"); });
for (const viewport of [375, 1366]) test(`customer thermal receipt at ${viewport}px`, async ({ page }) => {
  await page.setViewportSize({ width: viewport, height: 900 });
  await page.route("https://forms.test/**", route => route.fulfill({ contentType: "text/html", body: html }));
  await page.goto("https://forms.test/receipt");
  const receipt = page.locator("#hospitality-customer-copy");
  await expect(receipt).toContainText("Customer copy");
  await expect(receipt).toContainText("₱800.00");
  await expect(receipt).toContainText("₱1,000.00");
  await expect(receipt).toContainText("Change");
  for (const width of ["58", "80"]) {
    await page.locator("#hospitality-receipt-paper").selectOption(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.emulateMedia({ media: "print" });
    await expect(page.locator("#hospitality-print-customer-receipt")).toBeHidden();
    await expect(receipt).toBeVisible();
    const box = await receipt.boundingBox();
    expect(box!.width).toBeLessThan(Number(width) * 96 / 25.4);
    await page.emulateMedia({ media: "screen" });
  }
  await page.evaluate(() => { window.print = () => { document.body.dataset.printed = "yes"; }; });
  await page.locator("#hospitality-print-customer-receipt").click();
  await expect(page.locator("body")).toHaveAttribute("data-printed", "yes");
});
