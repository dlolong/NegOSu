import { expect, test } from "@playwright/test";
import { renderFormFixture } from "./fixtures/form-browser";

let html: string;
test.beforeAll(async () => { html = await renderFormFixture("e2e/fixtures/typography.tsx"); });

test("shared typography keeps headings, controls, field values, and emphasis consistent", async ({ page }) => {
  await page.route("https://forms.test/**", route => route.fulfill({ contentType: "text/html", body: html }));
  await page.goto("https://forms.test/typography");
  for (const selector of ["#typography-body", "#typography-secondary", "#typography-help", "#typography-input", "#typography-select", "#typography-textarea", "#typography-date", "#typography-table-cell"]) {
    await expect(page.locator(selector)).toHaveCSS("font-weight", "400");
  }
  for (const selector of ["#typography-action", "#typography-label", "#typography-legend", "#typography-summary", "#typography-table-head", "#typography-link"]) {
    await expect(page.locator(selector)).toHaveCSS("font-weight", "500");
  }
  for (const selector of ["#typography-page h1", "#typography-section h2", "#typography-plain-heading", "#typography-emphasis", "#typography-total"]) {
    await expect(page.locator(selector)).toHaveCSS("font-weight", "600");
  }
  expect(await page.locator("#root").evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("typography.png"), fullPage: true });
});
