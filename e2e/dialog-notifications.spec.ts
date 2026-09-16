import { expect, test } from "@playwright/test";
import { authenticatedSmokeEnabled, loginAsOwner } from "./helpers/auth";

const local = (url?: string) => !!url && ["localhost", "127.0.0.1"].includes(new URL(url).hostname);
test.skip(!authenticatedSmokeEnabled() || !local(process.env.E2E_BASE_URL), "Requires local authenticated fixtures.");

test("notification dialog locks workspace scroll, supports its own scroll and restores closing", async ({ page }) => {
  await loginAsOwner(page, "automotive");
  await page.goto("/dashboard/settings");
  // Extend the background to prove scrolling is actually prevented, rather than
  // passing because this particular fixture happens to fit the viewport.
  await page.locator("#dashboard-main-content").evaluate(element => {
    const spacer = document.createElement("div"); spacer.id = "scroll-test-spacer"; spacer.style.height = "3000px"; element.append(spacer);
    element.scrollTop = 240;
  });
  const before = await page.locator("#dashboard-main-content").evaluate(element => element.scrollTop);
  expect(before).toBeGreaterThan(0);
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 720 });
    await page.locator("#dashboard-notification-bell").click();
    await expect(page.locator("#dashboard-notification-dialog")).toBeVisible();
    await expect(page.locator("#dashboard-notification-refresh")).toBeEnabled();
    await page.screenshot({ path: `/private/tmp/negosu-notifications-${width}.png` });
    expect(await page.locator("html").evaluate(element => getComputedStyle(element).overflowY)).toBe("hidden");
    expect(await page.locator("#dashboard-main-content").evaluate(element => getComputedStyle(element).overflowY)).toBe("hidden");
    const position = await page.locator("#dashboard-main-content").evaluate(element => element.scrollTop);
    await page.mouse.move(2, 300); await page.mouse.wheel(0, 600);
    await expect.poll(() => page.locator("#dashboard-main-content").evaluate(element => element.scrollTop)).toBe(position);
    await page.locator("#dashboard-notification-content").evaluate(element => { const spacer = document.createElement("div"); spacer.id = "dialog-scroll-test-spacer"; spacer.style.height = "1400px"; element.append(spacer); });
    const box = await page.locator("#dashboard-notification-content").boundingBox();
    await page.mouse.move(box!.x + 30, box!.y + 30); await page.mouse.wheel(0, 350);
    await expect.poll(() => page.locator("#dashboard-notification-content").evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator("#dialog-scroll-test-spacer").evaluate(element => element.remove());
    await page.locator("#dashboard-notification-content").evaluate(element => { element.scrollTop = 0; });
    await page.keyboard.press("Escape");
    await expect(page.locator("#dashboard-notification-dialog")).not.toBeVisible();
    await expect(page.locator("#dashboard-notification-bell")).toBeFocused();
    expect(await page.locator("#dashboard-main-content").evaluate(element => getComputedStyle(element).overflowY)).toBe("auto");
    expect(await page.locator("#dashboard-main-content").evaluate(element => element.scrollTop)).toBe(position);
  }
  await page.locator("#dashboard-main-content").hover(); await page.mouse.wheel(0, 350);
  await expect.poll(() => page.locator("#dashboard-main-content").evaluate(element => element.scrollTop)).toBeGreaterThan(before);
});

test("bell renders partial, empty and error states without stale counts", async ({ page }) => {
  await loginAsOwner(page, "automotive");
  const response = await page.request.get("/api/dashboard/notifications");
  const scope = await response.json();
  let mode = "partial";
  await page.route("**/api/dashboard/notifications", route => mode === "error"
    ? route.fulfill({ status: 503, json: { error: "Unavailable" } })
    : route.fulfill({ json: { ...scope, items: [], total: 0, unavailable: mode === "partial" ? ["Messages need a reply"] : [] } }));
  await page.goto("/dashboard/settings");
  await page.locator("#dashboard-notification-bell").click();
  await expect(page.locator("#dashboard-notification-partial")).toBeVisible();
  await expect(page.locator("#dashboard-notification-empty")).toHaveCount(0);
  mode = "empty"; await page.locator("#dashboard-notification-refresh").click();
  await expect(page.locator("#dashboard-notification-empty")).toBeVisible();
  mode = "error"; await page.locator("#dashboard-notification-refresh").click();
  await expect(page.locator("#dashboard-notification-error")).toBeVisible();
  await expect(page.locator("#dashboard-notification-count")).toHaveCount(0);
  await expect(page.locator("#dashboard-notification-empty")).toHaveCount(0);
  await page.locator("#dashboard-notification-close").click();
  await expect(page.locator("#dashboard-notification-dialog")).not.toBeVisible();
});
