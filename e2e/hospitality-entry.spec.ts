import { confirmLocalSignup } from "./helpers/mail";
import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

test.use({ browserName: "chromium", trace: "off" });
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}

test("Apartelle & Inn uses standard marketing, signup and login pages", async ({ page }, info) => {
  if (info.project.name === "desktop-chromium") await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/");
  await expect(page.locator("#negosu-hospitality-preview")).toContainText("Apartelle & Inn");
  await expect(page.locator("body")).not.toContainText(/pilot|invitation|invited/i);
  await noOverflow(page);
  await page.locator("#negosu-hero-hospitality-link").click();
  await expect(page.locator("#negosu-hospitality-page")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/pilot|invitation|invited/i);
  await noOverflow(page);
  await page.locator("#negosu-hospitality-start-free-button").click();
  await expect(page.locator("#negosu-signup-form")).toBeVisible();
  await expect(page.locator("#negosu-business-type-hospitality")).toBeChecked();
  await noOverflow(page);
  await page.locator("#negosu-signup-login-link").click();
  await expect(page.locator("#negosu-login-page")).toContainText("Apartelle & Inn");
  await expect(page.locator("body")).not.toContainText(/pilot|invitation|invited/i);
  await page.locator("#negosu-login-forgot-password-link").click();
  await expect(page.locator("#negosu-forgot-password-page")).toContainText("Apartelle & Inn");
  await page.locator("#negosu-forgot-password-login-link").click();
  await expect(page).toHaveURL(/login\?industry=hospitality/);
  await noOverflow(page);
  await page.goto("/signup");
  for (const industry of ["automotive", "salon", "pet_care", "hospitality"]) {
    await page.locator(`#negosu-business-type-${industry}-option`).click();
    await expect(page.locator(`#negosu-business-type-${industry}`)).toBeChecked();
  }
  await noOverflow(page);
});

test("ordinary local account signs up and creates an Apartelle & Inn workspace without invitation", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop-chromium" || process.env.E2E_HOSPITALITY !== "1" || !["localhost", "127.0.0.1"].includes(new URL(process.env.E2E_BASE_URL ?? "http://localhost").hostname) || !["localhost", "127.0.0.1"].includes(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://invalid").hostname), "Requires local Supabase and explicit synthetic signup testing");
  test.setTimeout(90000);
  const email = `qa.inn.signup.${Date.now()}@negosu.local.test`;
  const password = "NegOSu-Local-QA-2026!";
  await page.goto("/signup?industry=hospitality");
  await page.locator("#negosu-signup-first-name-input").fill("Local");
  await page.locator("#negosu-signup-last-name-input").fill("Inn Owner");
  await page.locator("#negosu-signup-email-input").fill(email);
  await page.locator("#negosu-signup-password-input").fill(password);
  await page.locator("#negosu-signup-confirm-password-input").fill(password);
  await page.locator("#negosu-signup-submit-button").click();
  await expect(page).toHaveURL(/\/(verify-email|onboarding\/business)/);
  // Local Mailpit captures verification mail; follow only this synthetic account’s link.
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const users = await admin.auth.admin.listUsers({ perPage: 1000 });
  expect(users.error).toBeNull();
  const account = users.data.users.find(user => user.email === email)!;
  expect(account.user_metadata.signup_industry).toBe("hospitality");
  if (page.url().includes("verify-email")) await confirmLocalSignup(page,email);
  await expect(page.locator("#negosu-onboarding-business-form")).toBeVisible();
  await expect(page.locator("#negosu-onboarding-business-type-hospitality")).toBeChecked();
  await page.locator("#negosu-onboarding-business-subtype").selectOption("apartelle");
  await page.locator("#negosu-business-name-input").fill(`Local Apartelle ${Date.now()}`);
  await page.locator("#negosu-business-submit-button").click();
  await expect(page.locator("#negosu-onboarding-branch-form")).toBeVisible();
  await page.locator("#negosu-branch-address-input").fill("Local synthetic address");
  await page.locator("#negosu-branch-city-input").fill("Test City");
  await page.locator("#negosu-branch-province-input").fill("Test Province");
  await page.locator("#negosu-branch-submit-button").click();
  await expect(page.locator("#hospitality-overview-page")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/pilot|invitation|invited/i);
  const org = await admin.from("organizations").select("id,industry,business_type,financial_report_roles_only").eq("created_by", account.id).single();
  expect(org.error).toBeNull();
  expect(org.data).toMatchObject({ industry: "hospitality", business_type: "apartelle", financial_report_roles_only: true });
  const registrations = await admin.from("hospitality_pilot_organizations").select("organization_id").eq("organization_id", org.data!.id);
  expect(registrations.data).toEqual([]);
  await page.goto("/dashboard/hospitality/rooms?dialog=room");
  await page.locator("#hospitality-room-name").fill("101");
  await page.locator("#hospitality-rate-180-price").fill("800");
  await page.locator("#hospitality-room-submit").click();
  await expect(page.locator("#hospitality-room-grid")).toContainText("101");
  for (const [path, id] of [["payments", "hospitality-payments-page"], ["reports", "hospitality-reports-page"], ["inventory", "salon-inventory-page"]]) {
    await page.goto(`/dashboard/${path}`); await expect(page.locator(`#${id}`)).toBeVisible();
  }
});
