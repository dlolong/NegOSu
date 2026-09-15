import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { authenticatedSmokeEnabled } from "./helpers/auth";

test.use({ browserName: "chromium", trace: "off" });
const isLocal = (value: string | undefined) => Boolean(value && ["localhost", "127.0.0.1"].includes(new URL(value).hostname));
test.skip(!isLocal(process.env.E2E_BASE_URL) || !isLocal(process.env.NEXT_PUBLIC_SUPABASE_URL) || !authenticatedSmokeEnabled(), "Requires local application, local Supabase, and seeded QA businesses.");

async function applyTheme(page: Page, theme: string) {
  await page.locator(`#settings-theme-option-${theme}`).click();
  await page.locator("#settings-theme-save-button").click();
  await expect(page).toHaveURL(/message=Color\+theme\+updated/);
  await expect(page.locator(`#settings-theme-radio-${theme}`)).toBeChecked();
}

test("five generic themes save, cancel, and stay consistent across businesses and workspace sizes", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const organizations = await admin.from("organizations").select("id, industry").in("slug", ["negosu-automotive-qa", "negosu-salon-qa", "negosu-pet-qa-1"]);
  expect(organizations.error).toBeNull();
  expect(organizations.data).toHaveLength(3);
  const email = `theme-${crypto.randomUUID()}@negosu.local.test`, password = `Theme-${crypto.randomUUID()}!`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "Workspace Theme QA" } });
  expect(created.error).toBeNull();
  const userId = created.data.user!.id;
  try {
    const memberships = await admin.from("organization_memberships").insert(organizations.data!.map(org => ({ organization_id: org.id, user_id: userId, role: "owner", is_active: true })));
    expect(memberships.error).toBeNull();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/login");
    await page.locator("#negosu-login-email-input").fill(email);
    await page.locator("#negosu-login-password-input").fill(password);
    await page.locator("#negosu-login-submit-button").click();
    await page.locator(`#negosu-business-option-${organizations.data!.find(org => org.industry === "automotive")!.id}-select-button`).click();
    await expect(page.locator("#dashboard-app-shell")).toBeVisible();

    await page.goto("/dashboard/settings");
    await expect(page.locator("#settings-theme-radio-blue")).toBeChecked();
    const options = page.locator("#settings-theme-options");
    await expect(options.getByRole("radio")).toHaveCount(5);
    await expect(options).not.toContainText(/Recommended|Automotive|Salon|Pet Care|industry/i);
    await expect(page.locator("#settings-classic-themes")).toHaveCount(0);

    for (const theme of ["blue", "plum", "teal", "graphite", "indigo"]) {
      await applyTheme(page, theme);
      await expect(page.locator("#dashboard-app-shell")).toHaveAttribute("data-dashboard-theme", theme);
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await options.scrollIntoViewIfNeeded();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        expect(await options.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
        expect(await page.locator("#settings-page").evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
        expect(await options.evaluate(el => {
          const bounds = el.closest("form")!.getBoundingClientRect();
          return [...el.children].every(card => {
            const box = card.getBoundingClientRect();
            return box.left >= bounds.left - 1 && box.right <= bounds.right + 1;
          });
        })).toBe(true);
        await page.screenshot({ path: testInfo.outputPath(`${theme}-${width}.png`) });
      }
      await page.locator(`#settings-theme-option-${theme === "plum" ? "teal" : "plum"}`).click();
      await page.locator("#settings-theme-actions-cancel-button").click();
      await expect(page.locator(`#settings-theme-radio-${theme}`)).toBeChecked();
      await page.reload();
      await expect(page.locator("#dashboard-app-shell")).toHaveAttribute("data-dashboard-theme", theme);
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    for (const industry of ["salon", "pet_care", "automotive"]) {
      await page.locator("#negosu-business-switcher-select").selectOption(organizations.data!.find(org => org.industry === industry)!.id);
      await page.locator("#negosu-business-switcher-submit-button").click();
      await expect(page).not.toHaveURL(/\/settings/);
      await expect(page.locator("#dashboard-app-shell")).toHaveAttribute("data-dashboard-theme", "indigo");
      await page.goto("/dashboard/settings");
      await expect(page.locator("#settings-theme-radio-indigo")).toBeChecked();
    }
    await applyTheme(page, "graphite");
    // A modified browser field cannot persist an unrecognized palette.
    await page.locator("#settings-theme-radio-graphite").evaluate((element: HTMLInputElement) => { element.value = "untrusted-palette"; });
    await page.locator("#settings-theme-save-button").click();
    await expect(page).toHaveURL(/error=Select\+a\+valid\+color\+theme/);
    expect((await admin.auth.admin.getUserById(userId)).data.user!.user_metadata.dashboard_theme).toBe("graphite");
    await applyTheme(page, "blue");
    await expect(page.locator("#dashboard-app-shell")).toHaveAttribute("data-dashboard-theme", "blue");
  } finally {
    // This test owns only this temporary local user and its membership rows.
    const removed = await admin.auth.admin.deleteUser(userId);
    expect(removed.error).toBeNull();
  }
});
