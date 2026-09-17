import { test, expect } from "@playwright/test";
import { authenticatedSmokeEnabled, loginAsOwner } from "./helpers/auth";

test.skip(!authenticatedSmokeEnabled(), "Requires synthetic authenticated fixtures.");
for (const industry of ["automotive", "salon"] as const) {
  test(`${industry}: malformed agenda date has a recoverable validation state`, async ({ page }) => {
    await loginAsOwner(page, industry);
    for (const date of ["2026-13-01", "2026-02-30", "unknown"]) {
      await page.goto(`/dashboard/appointments?date=${date}`);
      await expect(page.locator("#dashboard-main-content").getByRole("alert")).toContainText("Enter a valid date");
      await expect(page.getByText("No appointments scheduled", { exact: true })).toHaveCount(0);
      await expect(page.locator("#dashboard-app-shell")).toBeVisible();
    }
    await page.locator(industry === "salon" ? "#salon-appointments-date-input" : "#appointments-date-input").fill("2026-09-17");
    await page.locator(industry === "salon" ? "#salon-appointments-filter-button" : "#appointments-filter-button").click();
    await expect(page.locator("#dashboard-main-content").getByRole("alert")).toHaveCount(0);
    await expect(page).toHaveURL(/date=2026-09-17/);
  });
}
