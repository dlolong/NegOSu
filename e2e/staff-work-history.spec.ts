import { expect, test } from "@playwright/test";
import { renderFormFixture } from "./fixtures/form-browser";
let html: string;
test.beforeAll(async () => { html = await renderFormFixture("e2e/fixtures/staff-work-history.tsx"); });
test.beforeEach(async ({ page }) => { await page.route("https://forms.test/**", route => route.fulfill({ contentType: "text/html", body: html })); });
test("completed work and multiple contributors are readable on desktop and mobile", async ({ page }) => {
  await page.goto("https://forms.test/history");
  await expect(page.locator("#staff-history-table")).toContainText("Haircut and color promo");
  await expect(page.locator("#staff-work-open-appointment-visit")).toHaveAttribute("href", "/dashboard/appointments/visit");
  const team = page.locator("#fixture-contributors");
  await expect(team.getByRole("link")).toHaveText(["Alex", "Bo"]);
  await expect(team.getByRole("link", { name: "Bo", exact: true })).toHaveAttribute("href", "/dashboard/settings/staff/bo");
  await expect(team).toContainText("Service assignment · Recorded work on job");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test("history distinguishes empty and failed loads", async ({ page }) => {
  await page.goto("https://forms.test/history?empty=1");
  await expect(page.locator("#staff-history-table-empty")).toContainText("No completed work");
  await page.goto("https://forms.test/history?error=1");
  await expect(page.locator("#staff-history-error")).toBeVisible();
  await expect(page.locator("#staff-history-table")).toHaveCount(0);
});
test("clicking history row content opens its underlying appointment", async ({page})=>{
  await page.setViewportSize({width:1280,height:900});
  await page.goto("https://forms.test/history");
  await page.locator("#staff-work-appointment-visit td").last().click();
  await expect(page).toHaveURL("https://forms.test/dashboard/appointments/visit");
});
