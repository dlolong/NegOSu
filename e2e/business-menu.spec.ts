import { test, expect } from "@playwright/test";
import { authenticatedSmokeEnabled, loginAsOwner } from "./helpers/auth";

test.use({ trace: "off" });
const local = (url?: string) => !!url && ["localhost", "127.0.0.1"].includes(new URL(url).hostname);
test.skip(!authenticatedSmokeEnabled() || !local(process.env.E2E_BASE_URL) || !local(process.env.NEXT_PUBLIC_SUPABASE_URL), "Requires local QA accounts.");

for (const industry of ["automotive", "salon", "pet_care"] as const) {
  test(`${industry} business priority is consistent on desktop and mobile`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    if (industry === "pet_care") {
      await page.goto("/login?industry=pet_care");
      await page.locator("#negosu-login-email-input").fill(process.env.QA_PET_OWNER_EMAIL!);
      await page.locator("#negosu-login-password-input").fill(process.env.QA_OWNER_PASSWORD!);
      await page.locator("#negosu-login-submit-button").click();
      await expect(page.locator("#pet-care-dashboard")).toBeVisible();
    } else await loginAsOwner(page, industry);
    const first = industry === "automotive" ? ["Queue", "Job Orders"] : ["Appointments", "Booking Requests"];
    expect((await page.locator("#negosu-sidebar-operations a").allTextContents()).slice(0, 2)).toEqual(first);
    await expect(page.locator("#negosu-sidebar-operations #desktop-nav-payments")).toBeVisible();
    const desktopLinks = await page.locator("#dashboard-desktop-navigation a").evaluateAll(elements => elements.map(element => element.getAttribute("href")));
    await page.locator("#desktop-nav-payments").click();
    await expect(page).toHaveURL(/\/dashboard\/payments$/);
    await expect(page.locator("#desktop-nav-payments")).toHaveAttribute("aria-current", "page");
    await page.setViewportSize({ width: 320, height: 800 });
    const primary = page.locator("#dashboard-mobile-navigation > a");
    await expect(primary).toHaveText(industry === "automotive" ? ["Dashboard", "Queue", "Job Orders"] : ["Dashboard", "Appointments", "Requests"]);
    await page.locator("#mobile-nav-more").click();
    await expect(page.locator("#mobile-more-nav-payments")).toHaveAttribute("aria-current", "page");
    const mobileLinks = await page.locator("#dashboard-mobile-navigation a").evaluateAll(elements => elements.map(element => element.getAttribute("href")));
    expect([...mobileLinks].sort()).toEqual([...desktopLinks].sort());
    expect(new Set(mobileLinks).size).toBe(mobileLinks.length);
    expect(await page.locator("#dashboard-mobile-navigation").evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.locator("#mobile-more-nav-customers").click();
    await expect(page).toHaveURL(/\/dashboard\/customers$/);
    await expect(page.locator("#mobile-more-menu")).not.toBeVisible();
  });
}
