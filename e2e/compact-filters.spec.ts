import { expect, test } from "@playwright/test";
import { renderFormFixture } from "./fixtures/form-browser";

let html: string;
test.beforeAll(async () => { html = await renderFormFixture("e2e/fixtures/compact-filters.tsx"); });
test.beforeEach(async ({ page }) => {
  await page.route("https://filters.test/**", route => route.fulfill({ contentType: "text/html", body: html }));
  await page.goto("https://filters.test/list?page=4");
});

test("search starts as an icon, focuses the input, and submits with Enter", async ({ page }) => {
  await expect(page.locator("#records-search")).toBeHidden();
  await expect(page.locator("#records-status")).toBeHidden();
  await page.locator("#records-filters-search-toggle").click();
  await expect(page.locator("#records-search")).toBeFocused();
  await page.locator("#records-search").fill("Ana & Co");
  await page.locator("#records-search").press("Enter");
  await expect(page).toHaveURL(/q=Ana/);
  const query = new URL(page.url()).searchParams;
  expect(query.get("q")).toBe("Ana & Co");
  expect(query.get("status")).toBe("active");
  expect(query.get("tab")).toBe("history");
  expect(query.has("page")).toBe(false);
  await expect(page.locator("#records-filters-search-summary")).toContainText("Ana & Co");
});

test("filters overlay the page, retain search drafts and submit collapsed fields", async ({ page }) => {
  await page.locator("#records-filters-search-toggle").click();
  await page.locator("#records-search").fill("Ana");
  await page.locator("#records-search").press("Escape");
  await expect(page.locator("#records-filters-search-toggle")).toBeFocused();
  await expect(page.locator("#records-search")).toBeHidden();
  const before = await page.locator("#records-results").boundingBox();
  await page.locator("#records-filters-filters-button").click();
  const panel = page.locator("#records-filters-filters-popover");
  await expect(panel).toBeVisible();
  expect((await page.locator("#records-results").boundingBox())!.y).toBe(before!.y);
  const bounds = await panel.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(15);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width - 15);
  await page.locator("#records-status").selectOption("archived");
  await page.locator("#records-apply").click();
  await expect(page).toHaveURL(/status=archived/);
  expect(new URL(page.url()).searchParams.get("q")).toBe("Ana");
  expect(new URL(page.url()).searchParams.get("start")).toBe("2026-09-01");
});

test("popover supports dismissal and search-only/filter-only pages stay compact", async ({ page }) => {
  const trigger = page.locator("#records-filters-filters-button");
  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(page.locator("#records-filters-filters-popover")).toBeHidden();
  await trigger.click();
  await page.locator("#records-filters-filters-close-button").click();
  await expect(page.locator("#records-filters-filters-popover")).toBeHidden();
  for (const mode of ["search", "filters"]) {
    await page.goto(`https://filters.test/list?mode=${mode}`);
    await expect(page.locator(mode === "search" ? "#records-filters-filters-button" : "#records-filters-search-toggle")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
