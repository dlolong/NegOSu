import { expect, test } from "@playwright/test";
import { renderFormFixture } from "./fixtures/form-browser";

let html: string;
test.beforeAll(async () => { html = await renderFormFixture("e2e/fixtures/marketing-header.tsx"); });
test.beforeEach(async ({ page }) => {
  await page.route("https://forms.test/**", route => route.fulfill({ contentType: "text/html", body: html }));
  await page.goto("https://forms.test/");
});

test("header stays at the top and gains a shadow only after scrolling", async ({ page }) => {
  const header = page.locator("#negosu-main-header");
  await expect(header).toHaveAttribute("data-scrolled", "false");
  await page.evaluate(() => scrollTo(0, 450));
  await expect(header).toHaveAttribute("data-scrolled", "true");
  expect((await header.boundingBox())?.y).toBe(0);
  await page.evaluate(() => scrollTo(0, 0));
  await expect(header).toHaveAttribute("data-scrolled", "false");
});

test("mobile menu toggles, closes outside and on Escape, and exposes the account link", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) >= 1280, "Mobile navigation only");
  const toggle = page.locator("#negosu-mobile-menu-button");
  const navigation = page.locator("#negosu-mobile-navigation");
  await expect(page.locator("#negosu-mobile-account-link")).toHaveAttribute("href", "/login");
  await toggle.click();
  await expect(toggle).toHaveAccessibleName("Close navigation menu");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(navigation).toBeVisible();
  await toggle.click();
  await expect(navigation).toBeHidden();
  await toggle.click();
  await page.locator("#header-test-content").click({ position: { x: 5, y: 650 } });
  await expect(navigation).toBeHidden();
  await toggle.click();
  await page.keyboard.press("Escape");
  await expect(navigation).toBeHidden();
  await expect(toggle).toBeFocused();
  await toggle.click();
  await page.locator("#negosu-mobile-features-link").click();
  await expect(navigation).toBeHidden();
  await expect(toggle).toHaveAccessibleName("Open navigation menu");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
