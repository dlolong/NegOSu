import { expect, test } from "@playwright/test";
import { renderFormFixture } from "./fixtures/form-browser";

test("login fields avoid small mobile text and preserve accessible zoom", async ({ page }) => {
  await page.goto("/login");
  const viewport = page.locator('meta[name="viewport"]');
  await expect(viewport).toHaveCount(1);
  const content = await viewport.getAttribute("content");
  expect(content).toContain("width=device-width");
  expect(content).toContain("initial-scale=1");
  expect(content).not.toMatch(/user-scalable\s*=\s*(no|0)|maximum-scale\s*=/);

  const mobile = await page.evaluate(() => matchMedia("(max-width: 767px), (pointer: coarse)").matches);
  for (const id of ["negosu-login-email-input", "negosu-login-password-input"]) {
    const field = page.locator(`#${id}`);
    await expect(field).toHaveCSS("font-size", mobile ? "16px" : "14px");
    await field.focus();
    await expect(field).toBeFocused();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("compact workspace fields stay readable on phones, including landscape", async ({ page, isMobile }) => {
  const html = await renderFormFixture("e2e/fixtures/typography.tsx");
  await page.route("https://forms.test/**", route => route.fulfill({ contentType: "text/html", body: html }));
  await page.goto("https://forms.test/mobile-zoom");
  for (const landscape of [false, true]) {
    if (landscape) {
      if (!isMobile) break;
      await page.setViewportSize({ width: 844, height: 390 });
    }
    const mobile = await page.evaluate(() => matchMedia("(max-width: 767px), (pointer: coarse)").matches);
    for (const id of ["typography-input", "typography-select", "typography-textarea"]) {
      await expect(page.locator(`#${id}`)).toHaveCSS("font-size", mobile ? "16px" : "14px");
    }
    expect(await page.locator("#root").evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  }
});
