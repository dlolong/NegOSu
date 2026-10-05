import { expect, test } from "@playwright/test";
import { renderFormFixture } from "./fixtures/form-browser";
let html: string;
test.beforeAll(async () => { html = await renderFormFixture("e2e/fixtures/client-reminders.tsx"); });
test.beforeEach(async ({ page }) => { await page.route("https://forms.test/**", route => route.fulfill({ contentType: "text/html", body: html })); });
test("manual follow-up shows contact, timezone, pending protection and client return", async ({ page }) => {
  const submissions: Array<Array<[string,string]>> = [];
  await page.exposeFunction("recordFormAction", async (_: string, fields: Array<[string,string]>) => { submissions.push(fields); await new Promise(resolve => setTimeout(resolve, 700)); return {}; });
  await page.goto("https://forms.test/reminders?from=clients");
  await expect(page.locator("#appointment-back-button")).toHaveAttribute("href", "/dashboard/customers");
  await expect(page.getByText("09171234567")).toBeVisible();
  await expect(page.getByText(/Due — contact client/)).toBeVisible();
  await expect(page.getByText(/2:30/)).toBeVisible();
  await page.locator("#reminder-contacted-reminder-one").click();
  await expect(page.locator("#reminder-contacted-reminder-one")).toBeDisabled();
  await expect.poll(() => submissions.length).toBe(1);
  expect(Object.fromEntries(submissions[0])).toEqual({ id: "reminder-one", status: "contacted" });
  await expect(page.locator("#test-history-next")).toHaveAttribute("href", "/dashboard/customers/client-one?historyPage=2");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test("read-only clients have no mutation controls and direct appointments return to appointments", async ({ page }) => {
  await page.goto("https://forms.test/reminders?readonly=1");
  await expect(page.locator("#appointment-back-button")).toHaveAttribute("href", "/dashboard/appointments");
  await expect(page.locator('button[type="submit"]')).toHaveCount(0);
  await expect(page.locator("#reminder-client-reminder-one")).toHaveAttribute("href", "/dashboard/customers/client-one");
});
