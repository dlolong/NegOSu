import { test, expect } from "@playwright/test";
import { renderFormFixture } from "./fixtures/form-browser";

for (const width of [1440, 390, 320]) test(`public theme preview, cancel and save at ${width}px`, async ({ page }, testInfo) => {
  const html = await renderFormFixture("e2e/fixtures/public-page-themes.tsx");
  await page.setViewportSize({ width, height: 900 });
  await page.route("https://forms.test/**", route => route.fulfill({ contentType: "text/html", body: html }));
  await page.goto("https://forms.test/themes");
  await expect(page.getByRole("radio")).toHaveCount(7);
  await expect(page.locator("#public-page-theme-radio-classic")).toBeChecked();
  const preview = page.locator("#public-page-theme-preview");
  const primary = () => preview.evaluate(el => getComputedStyle(el).getPropertyValue("--brand-primary").trim());
  expect(await primary()).toBe("#0062dc");
  for (const [id, color] of Object.entries({ blue: "#2459a9", plum: "#85466d", teal: "#087d72", graphite: "#475569", indigo: "#4f46e5", crimson: "#b50924" })) {
    await page.locator(`#public-page-theme-option-${id}`).click();
    await expect(preview).toHaveAttribute("data-public-theme", id);
    expect(await primary()).toBe(color);
    expect(await page.locator("#workspace").evaluate(el => getComputedStyle(el).getPropertyValue("--brand-primary").trim())).toBe("#4f46e5");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.locator("#public-page-theme-actions-cancel-button").click();
  await expect(page.locator("#public-page-theme-radio-classic")).toBeChecked();
  expect(await primary()).toBe("#0062dc");
  await page.locator("#public-page-theme-radio-classic").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#public-page-theme-radio-blue")).toBeChecked();
  await page.locator("#public-page-theme-save-button").click();
  await expect(page.locator("body")).toHaveAttribute("data-saved-theme", "blue");
  await expect(page.locator("#public-page-theme-save-button")).toBeDisabled();
  await expect(page.locator("#public-page-theme-save-button")).toBeEnabled();
  await expect(preview).toHaveAttribute("data-public-theme", "blue");
  await expect(page.locator("#public-page-theme-radio-blue")).toBeChecked();
  await page.screenshot({ path: testInfo.outputPath(`public-theme-${width}.png`), fullPage: true, animations: "disabled" });
});
