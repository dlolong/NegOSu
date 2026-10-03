import { expect, test } from "@playwright/test";
import { renderFormFixture } from "./fixtures/form-browser";
let html: string;
test.beforeAll(async () => { html = await renderFormFixture("e2e/fixtures/service-photo-form.tsx"); });
for (const salon of [false, true]) {
  test(`${salon ? "treatment" : "service"} form supports photo URL and clearing`, async ({ page }) => {
    await page.route("https://forms.test/**", route => route.fulfill({ contentType: "text/html", body: html }));
    await page.route("**/api/dashboard/images", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ allowed: false, owner: true }) }));
    await page.goto(`https://forms.test/service${salon ? "?salon=1" : ""}`);
    const prefix = salon ? "salon-treatment-photo" : "service-photo";
    await expect(page.getByText("Image uploads require a paid plan.")).toBeVisible();
    await page.locator(`#${prefix}-url`).fill("https://example.test/treatment.jpg");
    expect(await page.locator("form").evaluate(form => new FormData(form as HTMLFormElement).get("thumbnailUrl"))).toBe("https://example.test/treatment.jpg");
    await page.locator(`#${prefix}-clear`).click();
    await expect(page.locator(`#${prefix}-url`)).toHaveValue("");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
