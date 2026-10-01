import { expect, test } from "@playwright/test";
import { renderFormFixture } from "./fixtures/form-browser";

let html: string;
test.beforeAll(async () => { html = await renderFormFixture("e2e/fixtures/settings.tsx"); });
test.beforeEach(async ({ page }) => {
  await page.route("https://settings.test/**", route => route.fulfill({ contentType: "text/html", body: html }));
  await page.route("https://settings.test/api/dashboard/images", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ allowed: true, owner: true }) }));
});

test("all settings sections fit the viewport and keep the active section on nested routes", async ({ page }) => {
  await page.goto("https://settings.test/fixture?pathname=/dashboard/settings/branches/new");
  const nav = page.getByRole("navigation", { name: "Settings sections" });
  await expect(nav.getByRole("link")).toHaveCount(6);
  await expect(page.locator("#settings-tab-branches")).toHaveAttribute("aria-current", "page");
  await expect(page.locator("#settings-tab-profile")).not.toHaveAttribute("aria-current");
  for (const link of await nav.getByRole("link").all()) {
    await link.scrollIntoViewIfNeeded();
    const box = await link.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  await expect(nav).not.toContainText("Locations and contact details");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator("#settings-tab-billing").click();
  await expect(page).toHaveURL("https://settings.test/dashboard/settings/billing");
  await expect(page.locator("#settings-tab-billing")).toHaveAttribute("aria-current", "page");
  await page.screenshot({ path: test.info().outputPath("settings-navigation.png"), fullPage: true });
});

test("hospitality navigation retains its supported settings", async ({ page }) => {
  await page.goto("https://settings.test/fixture?industry=hospitality");
  await expect(page.getByRole("navigation").getByRole("link")).toHaveCount(4);
  await expect(page.locator("#settings-tab-public-page, #settings-tab-resources")).toHaveCount(0);
});

test("grouped branch form retains required validation and submitted fields", async ({ page }) => {
  const calls: unknown[] = [];
  await page.exposeFunction("recordFormAction", (name: string, entries: unknown) => { calls.push({ name, entries }); });
  await page.goto("https://settings.test/fixture?mode=branch");
  await expect(page.getByRole("group", { name: "Location details" })).toBeVisible();
  await page.locator("#branch-save-button").click();
  expect(calls).toHaveLength(0);
  for (const [id, value] of [["name", "Main branch"], ["address", "123 Main Street"], ["city", "Manila"], ["province", "Metro Manila"]]) {
    await page.locator(`#branch-${id}-input`).fill(value);
  }
  await page.locator("#branch-save-button").click();
  await expect.poll(() => calls.length).toBe(1);
  expect(calls[0]).toMatchObject({ name: "saveBranch", entries: expect.arrayContaining([["name", "Main branch"], ["country", "Philippines"], ["city", "Manila"]]) });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("branding and theme controls remain usable on narrow screens", async ({ page }) => {
  for (const mode of ["branding", "theme"]) {
    await page.goto(`https://settings.test/fixture?mode=${mode}`);
    if (mode === "branding") {
      await expect(page.locator("#settings-business-logo-upload-file")).toBeVisible();
      await page.locator("#settings-business-logo-url-input").fill("https://example.test/logo.png");
      await page.locator("#settings-business-branding-actions-cancel-button").click();
      await expect(page.locator("#settings-business-logo-url-input")).toHaveValue("");
    } else {
      await page.locator("#settings-theme-option-plum").click();
      await expect(page.locator("#settings-theme-radio-plum")).toBeChecked();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`settings-${mode}.png`), fullPage: true });
  }
});
