import { expect, test } from "@playwright/test";
import { renderFormFixture } from "./fixtures/form-browser";

let html: string;
test.beforeAll(async () => { html = await renderFormFixture("e2e/fixtures/payment-filters.tsx"); });
test.beforeEach(async ({ page }) => {
  await page.route("https://forms.test/**", route => route.fulfill({ contentType: "text/html", body: html }));
  await page.goto("https://forms.test/dashboard/payments?section=collections&page=3");
});

test("payment filters start hidden and open without moving the page content", async ({ page }) => {
  const trigger = page.locator("#hospitality-payments-filters-button"), panel = page.getByRole("dialog", { name: "Payment filters" });
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(panel).toBeHidden();
  await expect(page.locator("#hospitality-report-filter-panel")).toHaveCount(0);
  const before = await page.locator("#payment-fixture-period").boundingBox();
  await trigger.click();
  await expect(panel).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  expect((await page.locator("#payment-fixture-period").boundingBox())!.y).toBe(before!.y);
  await expect(page.locator("#hospitality-report-period")).toHaveValue("month");
  await expect(panel.getByText("Main branch", { exact: true })).toBeVisible();
  await expect(page.locator("#hospitality-report-branch")).toHaveCount(0);
  const bounds = await panel.boundingBox(), viewport = page.viewportSize()!;
  expect(bounds!.x).toBeGreaterThanOrEqual(15);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width - 15);
  expect(bounds!.y).toBeGreaterThanOrEqual(15);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height - 15);
  expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("payment-filters.png") });
});

test("filters support keyboard, outside click, close button, and trigger dismissal", async ({ page }) => {
  const trigger = page.locator("#hospitality-payments-filters-button"), panel = page.getByRole("dialog", { name: "Payment filters" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(panel).toBeVisible();
  await page.keyboard.press("Tab");
  // WebKit can skip buttons in its default keyboard-navigation preferences.
  // Either way, Tab must enter the popover's interactive controls.
  await expect(panel.locator("button:focus, select:focus, input:focus")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await trigger.click();
  await page.locator("#hospitality-payments-filters-close-button").click();
  await expect(panel).toBeHidden();
  await trigger.click();
  // The header title is outside the popover at every tested viewport width.
  await page.locator("#hospitality-payments-header h1").click();
  await expect(panel).toBeHidden();
  await trigger.click();
  await trigger.click();
  await expect(panel).toBeHidden();
});

test("applying filters preserves the payment section, resets pagination, and restores saved values", async ({ page }) => {
  await page.locator("#hospitality-payments-filters-button").click();
  await page.locator("#hospitality-report-period").selectOption("custom");
  await page.locator("#hospitality-report-start").fill("2026-08-01");
  await page.locator("#hospitality-report-end").fill("2026-08-31");
  await page.locator("#hospitality-report-apply").click();
  await expect(page).toHaveURL(/preset=custom/);
  const query = new URL(page.url()).searchParams;
  expect(Object.fromEntries(query)).toEqual({ section: "collections", preset: "custom", start: "2026-08-01", end: "2026-08-31" });
  await expect(page.getByRole("dialog", { name: "Payment filters" })).toBeHidden();
  await expect(page.locator("#payment-fixture-period")).toHaveText("Activity period: 2026-08-01 to 2026-08-31");
  await page.locator("#hospitality-payments-filters-button").click();
  await expect(page.locator("#hospitality-report-period")).toHaveValue("custom");
  await expect(page.locator("#hospitality-report-start")).toHaveValue("2026-08-01");
  await expect(page.locator("#hospitality-report-end")).toHaveValue("2026-08-31");
});

test("the popover stays within a resized viewport and follows the workspace scroller", async ({ page }) => {
  await page.locator("#hospitality-payments-filters-button").click();
  await page.setViewportSize({ width: 320, height: 480 });
  await page.locator("#payment-fixture-scroll").evaluate(element => { element.scrollTop = 70; });
  const panel = page.getByRole("dialog", { name: "Payment filters" });
  await expect.poll(async () => {
    const box = await panel.boundingBox();
    return !!box && box.x >= 15 && box.y >= 15 && box.x + box.width <= 305 && box.y + box.height <= 465;
  }).toBe(true);
  await expect(page.locator("#hospitality-report-apply")).toBeInViewport();
});

test("reports and stay history keep their existing collapsible filter controls", async ({ page }) => {
  for (const mode of ["report", "history"]) {
    await page.goto(`https://forms.test/dashboard/reports?mode=${mode}`);
    await expect(page.locator("#hospitality-payments-filters-button")).toHaveCount(0);
    await expect(page.locator("#hospitality-report-filters")).toBeHidden();
    await page.locator("#hospitality-report-filter-panel summary").click();
    await expect(page.locator("#hospitality-report-filters")).toBeVisible();
    await expect(page.locator("#hospitality-report-branch")).toHaveCount(mode === "report" ? 1 : 0);
    if (mode === "history") await expect(page.locator('input[name="tab"]')).toHaveValue("history");
  }
});
