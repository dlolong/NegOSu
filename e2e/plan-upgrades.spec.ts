import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

test.use({ browserName: "chromium" });
const local = ["localhost", "127.0.0.1"].includes(new URL(process.env.E2E_BASE_URL ?? "http://localhost").hostname);
test.skip(!local || process.env.E2E_HOSPITALITY !== "1", "Explicitly enable local synthetic fixtures");
async function login(page: Page, role: "owner" | "other") {
  await page.goto("/login");
  await page.locator("#negosu-login-email-input").fill(`qa.hospitality.${role}@negosu.local.test`);
  await page.locator("#negosu-login-password-input").fill("NegOSu-Local-QA-2026!");
  await page.locator("#negosu-login-submit-button").click();
  if (role === "owner") {
    const fixture = JSON.parse(readFileSync("/private/tmp/negosu-hospitality-fixture.json", "utf8"));
    await page.locator(`#negosu-business-option-${fixture.org}-select-button`).click();
  }
  await expect(page.locator("#dashboard-app-shell")).toBeVisible();
}
async function noBanner(page: Page) {
  await expect(page.locator("#dashboard-plan-upgrade")).toHaveCount(0);
  await expect(page.locator("#hospitality-plan-upgrade")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}

test("Free workspace has no general upsells; Reports upgrade stays within limited-access info", async ({ page }, info) => {
  await login(page, "other");
  for (const path of ["/dashboard", "/dashboard/hospitality/rooms", "/dashboard/payments", "/dashboard/settings/staff", "/dashboard/settings/branches/new"]) {
    await page.goto(path);
    await noBanner(page);
    await expect(page.getByRole("complementary", { name: "Plan upgrade", exact: true })).toHaveCount(0);
  }
  await page.goto("/dashboard/reports");
  await noBanner(page);
  await expect(page.locator("#hospitality-reports-plan-upgrade")).toBeVisible();
  await expect(page.locator("#hospitality-reports-plan-upgrade-button")).toHaveAttribute("href", "/dashboard/settings/billing#billing-plan-starter");
  await page.screenshot({ path: `/private/tmp/negosu-upgrade-${info.project.name}.png`, fullPage: true });
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("#hospitality-reports-plan-upgrade")).toBeHidden();
  await page.emulateMedia({ media: "screen" });
  await page.locator("#hospitality-reports-plan-upgrade-button").click();
  await expect(page.locator("#billing-plan-starter")).toBeVisible();
});

test("branch upgrade appears only after the database rejects an over-limit addition", async ({ page }) => {
  await login(page, "other");
  await page.goto("/dashboard/settings/branches/new");
  await expect(page.locator("#form-plan-upgrade")).toHaveCount(0);
  await page.locator("#branch-name-input").fill(`Blocked local branch ${Date.now()}`);
  await page.locator("#branch-address-input").fill("Synthetic address");
  await page.locator("#branch-city-input").fill("Test city");
  await page.locator("#branch-province-input").fill("Test province");
  await page.locator("#branch-save-button").click();
  await expect(page.locator("#form-plan-upgrade")).toBeVisible();
  await expect(page.locator("#form-plan-upgrade")).toContainText("limit has been reached");
  await expect(page.locator("#form-plan-upgrade-button")).toHaveAttribute("href", "/dashboard/settings/billing#billing-plan-business");
  await noBanner(page);
});

test("highest plan has no upgrades and retains paid Reports", async ({ page }) => {
  await login(page, "owner");
  await noBanner(page);
  await page.goto("/dashboard/reports");
  await expect(page.locator("#hospitality-report-export")).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Plan upgrade", exact: true })).toHaveCount(0);
  await noBanner(page);
});
