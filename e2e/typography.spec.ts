import { expect, test } from "@playwright/test";
import { renderFormFixture } from "./fixtures/form-browser";

let html: string;
test.beforeAll(async () => { html = await renderFormFixture("e2e/fixtures/typography.tsx"); });

test("shared typography keeps headings, controls, field values, and emphasis consistent", async ({ page }) => {
  await page.route("https://forms.test/**", route => route.fulfill({ contentType: "text/html", body: html }));
  await page.goto("https://forms.test/typography");
  for (const selector of ["#typography-help", "#typography-input", "#typography-select", "#typography-textarea", "#typography-date"]) {
    await expect(page.locator(selector)).toHaveCSS("font-weight", "400");
  }
  for (const selector of ["#typography-body", "#typography-secondary", "#typography-table-cell", "#typography-action", "#typography-label", "#typography-legend", "#typography-summary", "#typography-table-head", "#typography-link"]) {
    await expect(page.locator(selector)).toHaveCSS("font-weight", "500");
  }
  for (const selector of ["#typography-page h1", "#typography-section h2", "#typography-plain-heading", "#typography-emphasis", "#typography-total"]) {
    await expect(page.locator(selector)).toHaveCSS("font-weight", "600");
  }
  expect(await page.locator("#root").evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("typography.png"), fullPage: true });
});

test("mobile text is larger and darker across workspace palettes", async ({ page, isMobile }) => {
  await page.route("https://forms.test/**", route => route.fulfill({ contentType: "text/html", body: html }));
  await page.goto("https://forms.test/typography");
  for (const landscape of [false, true]) {
    if (landscape) {
      if (!isMobile) break;
      await page.setViewportSize({ width: 844, height: 390 });
    }
    const mobile = await page.evaluate(() => matchMedia("(max-width: 767px), (pointer: coarse)").matches);
    await expect(page.locator("#typography-label")).toHaveCSS("font-size", mobile ? "15px" : "14px");
    await expect(page.locator("#typography-help")).toHaveCSS("font-size", mobile ? "13px" : "12px");
    await expect(page.locator("#typography-section h2")).toHaveCSS("font-size", mobile ? "17px" : "16px");
    await expect(page.locator("#typography-input")).toHaveCSS("font-size", mobile ? "16px" : "14px");
    for (const theme of ["blue", "plum", "teal", "graphite", "indigo"]) {
      await page.locator("#root").evaluate((element, value) => element.setAttribute("data-dashboard-theme", value), theme);
      if (mobile) {
        await expect(page.locator("#typography-help")).toHaveCSS("color", "rgb(71, 85, 105)");
        await expect(page.locator("#typography-page-content p")).toHaveCSS("color", "rgb(51, 65, 85)");
      }
      expect(await page.locator("#root").evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    }
  }
});
