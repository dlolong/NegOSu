import { expect, test } from "@playwright/test";
import { renderFormFixture } from "./fixtures/form-browser";

let html: string;
test.beforeAll(async () => { html = (await renderFormFixture("e2e/fixtures/workspace-columns.tsx")).replace("max-w-3xl", "max-w-none"); });
test.beforeEach(async ({ page }) => {
  await page.route("https://forms.test/**", route => route.fulfill({ contentType: "text/html", body: html }));
});

test("dashboard puts supporting information right on desktop and operational work first on mobile", async ({ page }) => {
  await page.goto("https://forms.test/workspace");
  await expect(page.locator("#dashboard-website-public-link")).toBeVisible();
  const primary = await page.locator("#command-center-workspace-primary").boundingBox();
  const sidebar = await page.locator("#command-center-workspace-sidebar").boundingBox();
  expect(primary).not.toBeNull(); expect(sidebar).not.toBeNull();
  if (page.viewportSize()!.width >= 1280) {
    expect(primary!.x + primary!.width).toBeLessThan(sidebar!.x);
    expect(Math.abs(sidebar!.y - primary!.y)).toBeLessThan(2);
    const panel = page.locator("#command-center-workspace-sidebar");
    await expect(panel).toHaveCSS("overflow-y", "auto");
    await expect(panel).toHaveCSS("position", "sticky");
    expect(await panel.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
    await panel.evaluate(element => element.focus({ preventScroll: true }));
    await page.keyboard.press("ArrowDown");
    await expect.poll(() => panel.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    expect((await page.locator("#command-center-workspace-primary").boundingBox())!.y).toBe(primary!.y);
  } else {
    expect(sidebar!.y).toBeGreaterThanOrEqual(primary!.y + primary!.height);
    await expect(page.locator("#command-center-workspace-sidebar")).toHaveCSS("overflow-y", "visible");
  }
  await expect(page.locator("#command-center-workspace-sidebar #negosu-staff-snapshot")).toHaveCount(1);
  const today = await page.locator("#negosu-today-operations").boundingBox();
  const chart = await page.locator("#command-center-activity-chart").boundingBox();
  expect(today!.y).toBeLessThan(chart!.y);
  expect(await page.locator("#root").evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await expect(page.locator("#negosu-command-center-header #negosu-command-center-quick-action-appointment")).toBeVisible();
  await expect(page.locator("#negosu-command-center-quick-actions #negosu-command-center-quick-action-appointment")).toHaveCount(0);
  await expect(page.locator("#negosu-command-center-branch-selector-form")).toHaveCount(0);
});

test("settings navigation uses the left column on desktop without mobile overflow", async ({ page }) => {
  await page.goto("https://forms.test/workspace?settings=1&pathname=/dashboard/settings");
  await expect(page.locator("#salon-settings-tab-profile")).toHaveAttribute("aria-current", "page");
  const navigation = await page.locator("#salon-settings-navigation").boundingBox();
  const content = await page.locator("#settings-workspace-content").boundingBox();
  if (page.viewportSize()!.width >= 1280) expect(navigation!.x + navigation!.width).toBeLessThan(content!.x);
  else expect(navigation!.y + navigation!.height).toBeLessThanOrEqual(content!.y);
  expect(await page.locator("#root").evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
});
