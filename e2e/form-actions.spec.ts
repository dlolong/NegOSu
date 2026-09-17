import { expect, test } from "@playwright/test";
import { renderFormFixture } from "./fixtures/form-browser";

test.use({ browserName: "chromium" });
let html: string;
test.beforeAll(async () => { html = await renderFormFixture("e2e/fixtures/form-actions.tsx"); });

const mutations: string[] = [];
const submissions: Array<{ name: string; entries: Array<[string, string]> }> = [];
test.beforeEach(async ({ page }) => {
  mutations.length = 0;
  submissions.length = 0;
  await page.exposeFunction("recordFormAction", (name: string, entries: Array<[string, string]>) => {
    // Search is a read, and opening a searchable selector may issue it before Cancel.
    if (name === "lookupRecords") return { data: [] };
    mutations.push(name); submissions.push({ name, entries });
  });
  await page.route("https://forms.test/**", route => route.fulfill({ contentType: "text/html", body: new URL(route.request().url()).pathname === "/fixture" ? html : '<h1 id="destination">Returned without saving</h1>' }));
});

for (const [fixture, cancelId, destination] of [
  ["customer", "customer-cancel-button", "/dashboard/customers?q=Ana"],
  ["customer-edit", "customer-cancel-button", "/dashboard/customers?q=Ana"],
  ["vehicle", "vehicle-cancel-button", "/dashboard/vehicles?q=Toyota"],
  ["vehicle-edit", "vehicle-cancel-button", "/dashboard/vehicles?q=Toyota"],
  ["customer-standalone-edit", "customer-cancel-button", "/dashboard/customers/customer-one"],
  ["vehicle-standalone-edit", "vehicle-cancel-button", "/dashboard/vehicles/vehicle-one"],
  ["branch", "branch-cancel-button", "/dashboard/settings/branches"],
  ["service", "service-cancel-button", "/dashboard/services"],
  ["appointment", "appointment-cancel-button", "/dashboard/appointments"],
  ["appointment-edit", "appointment-cancel-button", "/dashboard/appointments/appointment-one"],
  ["walk-in", "walk_in-cancel-button", "/dashboard/queue"],
  ["staff", "salon-staff-create-cancel-button", "/dashboard/settings/staff"],
]) {
  test(`${fixture} Cancel discards edits, navigates correctly, and stays right-aligned`, async ({ page }) => {
    await page.goto(`https://forms.test/fixture?fixture=${fixture}`);
    const dialog = page.locator("dialog");
    if (await dialog.count()) {
      const header = dialog.locator("header").first();
      await expect(header.getByRole("link", { name: /^Close / })).toHaveCount(1);
      await expect(header.getByRole("link", { name: /^Back/ })).toHaveCount(0);
      await expect(header.locator('[id$="-back-button"]')).toHaveCount(0);
    }
    const cancel = page.locator(`#${cancelId}`);
    await cancel.scrollIntoViewIfNeeded();
    const row = cancel.locator("..");
    const submit = row.locator('button[type="submit"]');
    await expect(cancel.locator("svg")).toHaveCount(1);
    await expect(submit.locator("svg")).toHaveCount(1);
    expect(await row.evaluate(el => getComputedStyle(el).justifyContent)).toBe("flex-end");
    const box = await row.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    const saveBox = await submit.boundingBox();
    expect(Math.abs(saveBox!.x + saveBox!.width - box!.x - box!.width)).toBeLessThan(2);
    if (fixture === "customer-edit") await page.screenshot({ path: test.info().outputPath("customer-edit.png"), fullPage: true });
    const input = page.locator('input:not([type="hidden"]):not([type="checkbox"])').first();
    await input.fill(""); // Cancel must also work when required fields are invalid.
    await cancel.click();
    await expect(page).toHaveURL(`https://forms.test${destination}`);
    expect(mutations).toEqual([]);
  });
}

test("Escape and the dialog close icon both dismiss without saving", async ({ page }) => {
  for (const method of ["escape", "close"]) {
    await page.goto("https://forms.test/fixture?fixture=customer");
    await expect(page.locator("#fixture-dialog")).toBeVisible();
    if (method === "escape") await page.keyboard.press("Escape");
    else await page.locator("#fixture-dialog-close-button").click();
    await expect(page).toHaveURL("https://forms.test/dashboard/customers?q=Ana");
  }
  expect(mutations).toEqual([]);
});

test("inline Cancel restores controlled branding input and preview without saving", async ({ page }) => {
  await page.goto("https://forms.test/fixture?fixture=branding");
  await page.locator("#settings-business-logo-url-input").fill("https://example.test/changed.svg");
  await page.locator("#settings-business-branding-actions-cancel-button").click();
  await expect(page.locator("#settings-business-logo-url-input")).toHaveValue("https://example.test/original.svg");
  expect(mutations).toEqual([]);
});

test("Save validates required fields, submits once, and disables actions while pending", async ({ page }) => {
  await page.goto("https://forms.test/fixture?fixture=pending");
  await page.locator("#pending-name").fill("");
  await page.locator("#pending-save").click();
  expect(mutations).toEqual([]);
  await page.locator("#pending-name").fill("Changed");
  await page.locator("#pending-actions-cancel-button").click();
  await expect(page.locator("#pending-name")).toHaveValue("Ana");
  await page.locator("#pending-save").click();
  await expect(page.locator("#pending-save")).toBeDisabled();
  await expect(page.locator("#pending-actions-cancel-button")).toBeDisabled();
  await page.locator("#pending-save").evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  expect(mutations).toEqual(["savePending"]);
  await page.evaluate(() => window.releaseFormSave?.());
  await expect(page.locator("#save-success")).toBeVisible();
});

test("quick-create Cancel restores customer and vehicle selection without submitting the visit", async ({ page }) => {
  await page.goto("https://forms.test/fixture?fixture=quick-create");
  for (const kind of ["customer", "vehicle"]) {
    await page.locator(`#appointment-quick-${kind}-open-button`).click();
    await page.locator(`#appointment-quick-${kind}-cancel-button`).click();
    await expect(page.locator("#appointment-customer-select")).toHaveValue("Ana Santos");
    await expect(page.locator("#appointment-vehicle-select")).toHaveValue("Toyota Vios");
    await expect(page.locator('input[type="hidden"][name="customerId"]')).toHaveValue("customer-one");
    await expect(page.locator('input[type="hidden"][name="vehicleId"]')).toHaveValue("vehicle-one");
  }
  expect(mutations).toEqual([]);
});

test("customer Save keeps the existing server action and customer field contract", async ({ page }) => {
  await page.goto("https://forms.test/fixture?fixture=customer");
  await page.locator("#customer-full-name-input").fill("New customer");
  await page.locator("#customer-save-button").click();
  await expect.poll(() => mutations).toEqual(["saveCustomer"]);
  expect(Object.fromEntries(submissions[0].entries)).toMatchObject({ fullName: "New customer", returnTo: "/dashboard/customers?q=Ana&create=1" });
});
