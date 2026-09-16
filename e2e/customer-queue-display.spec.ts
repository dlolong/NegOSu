import { expect, test } from "@playwright/test";

// Synthetic API data exercises the shared customer display without customer data.
for (const industry of ["automotive", "salon"] as const) {
  test(`${industry} customer queue stays simple and controls remain usable`, async ({ page }) => {
    const branchId = "40790000-0000-4000-8000-000000000001";
    let requests = 0;
    let unavailable = false;
    await page.route(`**/api/queue-display/${branchId}`, async route => {
      requests++;
      if (unavailable) return route.fulfill({ status: 503, body: "Unavailable" });
      return route.fulfill({ json: {
        organizationName: "Customer Care", branchName: "Main branch", industry,
        date: new Date().toISOString().slice(0, 10), timezone: "UTC", refreshedAt: new Date().toISOString(),
        serving: [{ key: "one", label: industry === "salon" ? "Alex M." : "A001", detail: null }],
        waiting: [{ key: "two", label: industry === "salon" ? "Sam R." : "A002", detail: null }],
      } });
    });
    await page.goto(`/display/queue/${branchId}`);
    await expect(page.locator("#queue-display-serving-item-one")).toBeVisible();
    await expect(page.locator("#queue-display-connection")).toHaveCount(0);
    await expect(page.locator("#queue-display-clock, #queue-display-date")).toHaveCount(0);
    await expect(page.getByText(/Live queue|Updates automatically|Rotates automatically/)).toHaveCount(0);
    const refresh = page.getByRole("button", { name: "Refresh queue", exact: true });
    const fullscreen = page.getByRole("button", { name: "Enter fullscreen", exact: true });
    await expect(refresh).toHaveText("");
    await expect(fullscreen).toHaveText("");
    const previous = requests;
    await refresh.click();
    await expect.poll(() => requests).toBeGreaterThan(previous);
    await fullscreen.click();
    await expect(page.locator("#queue-display-fullscreen")).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Exit fullscreen", exact: true }).click();
    await expect(fullscreen).toHaveAttribute("aria-pressed", "false");
    for (const width of [320, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `/private/tmp/negosu-queue-${industry}-${width}.png`, fullPage: true });
    }
    unavailable = true;
    await refresh.click();
    await expect(page.locator("#queue-display-connection")).toContainText("Connection interrupted");
    await expect(page.locator("#queue-display-last-updated")).toBeVisible();
    unavailable = false;
    await refresh.click();
    await expect(page.locator("#queue-display-connection")).toHaveCount(0);
  });
}
