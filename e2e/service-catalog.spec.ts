import { expect, test, type Page } from "@playwright/test";
import { renderFormFixture } from "./fixtures/form-browser";

test.use({ browserName: "chromium" });
let html: string;
const calls: Array<{ name: string; data: Record<string, string> }> = [];
let failure: string | undefined;
test.beforeAll(async () => { html = await renderFormFixture("e2e/fixtures/service-catalog.tsx"); });
test.beforeEach(async ({ page }) => {
  calls.length = 0; failure = undefined;
  await page.exposeFunction("recordFormAction", (name: string, entries: Array<[string, string]>) => { calls.push({ name, data: Object.fromEntries(entries) }); return failure ? { error: failure } : {}; });
  await page.route("https://forms.test/**", route => {
    const url = new URL(route.request().url());
    return route.fulfill({ contentType: "text/html", body: url.pathname === "/fixture" || (url.pathname === "/dashboard/services" && url.searchParams.has("tab")) ? html : "<h1>Parent page</h1>" });
  });
});
async function assertContained(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  for (const button of await page.locator('button:visible, a:visible').all()) {
    const box = await button.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  }
}

test("category list has top Add and row Edit/Delete controls without inline edit forms or overflow", async ({ page }) => {
  await page.goto("https://forms.test/fixture");
  await expect(page.locator("#service-category-list li")).toHaveCount(2);
  await expect(page.locator("input:visible")).toHaveCount(0);
  const add = page.locator("#service-category-add-button");
  expect((await add.boundingBox())!.y).toBeLessThan((await page.locator("#service-category-list").boundingBox())!.y);
  await expect(page.getByRole("link", { name: "Edit", exact: true })).toHaveCount(2);
  await expect(page.getByRole("link", { name: "Delete", exact: true })).toHaveCount(2);
  await assertContained(page);
  await page.screenshot({ path: test.info().outputPath("categories.png"), fullPage: true });
});

test("Add validates inputs and Cancel closes the category dialog without saving", async ({ page }) => {
  await page.goto("https://forms.test/fixture");
  await page.locator("#service-category-add-button").click();
  await expect(page.locator("#service-category-create-dialog")).toBeVisible();
  await page.locator("#service-category-create-save-button").click();
  expect(calls).toEqual([]);
  await page.locator("#service-category-create-name-input").fill("Draft category");
  await assertContained(page);
  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  await expect(page.locator("dialog")).toHaveCount(0);
  expect(calls).toEqual([]);
});

test("Edit preserves entered values when the server rejects a duplicate name", async ({ page }) => {
  failure = "That category already exists.";
  await page.goto("https://forms.test/fixture");
  await page.getByRole("link", { name: "Edit", exact: true }).first().click();
  await expect(page.locator("#service-category-edit-name-input")).toHaveValue("Hair and Beauty");
  await page.locator("#service-category-edit-name-input").fill("Taken category");
  await page.locator("#service-category-edit-save-button").click();
  await expect(page.getByText("That category already exists.")).toBeVisible();
  await expect(page.locator("#service-category-edit-name-input")).toHaveValue("Taken category");
  expect(calls[0]).toMatchObject({ name: "saveCategory", data: { id: "72000000-0000-4000-8000-000000000001", name: "Taken category", isActive: "on" } });
  await page.locator("#service-category-edit-dialog-close-button").click();
  await expect(page.locator("dialog")).toHaveCount(0);
});

test("Delete requires confirmation, explains kept services, and submits only the chosen category", async ({ page }) => {
  await page.goto("https://forms.test/fixture");
  await page.getByRole("link", { name: "Delete", exact: true }).first().click();
  await expect(page.getByText(/will remain in the catalog/)).toBeVisible();
  await expect(page.getByText("Uncategorized", { exact: true })).toBeVisible();
  expect(calls).toEqual([]);
  await assertContained(page);
  await page.locator("#service-category-delete-save-button").click();
  await expect.poll(() => calls.length).toBe(1);
  expect(calls[0]).toMatchObject({ name: "deleteCategory", data: { id: "72000000-0000-4000-8000-000000000001" } });
});

test("read-only and empty category states are usable", async ({ page }) => {
  await page.goto("https://forms.test/fixture?readonly=1");
  await expect(page.getByRole("link", { name: "Edit", exact: true })).toHaveCount(0);
  await expect(page.locator("a[data-record-link]")).toHaveCount(2);
  await page.goto("https://forms.test/fixture?empty=1");
  await expect(page.locator("#service-category-empty")).toContainText("No categories yet");
  await expect(page.locator("#service-category-add-button")).toBeVisible();
});

test("long service/category/branch names and prices fit cards and desktop tables", async ({ page }) => {
  for (const industry of ["automotive", "salon"]) {
    await page.goto(`https://forms.test/fixture?view=services&industry=${industry}`);
    await expect(page.locator("a[data-record-link]").filter({ visible: true })).toHaveCount(1);
    await expect(page.getByRole("link", { name: "View", exact: true })).toHaveCount(0);
    await assertContained(page);
  }
});

for (const [pathname, destination] of [["/dashboard/services/new", "/dashboard/services"], ["/dashboard/services/service-one/edit", "/dashboard/services/service-one"], ["/dashboard/settings/resources/resource-one/edit", "/dashboard/settings/resources"], ["/dashboard/customers/customer-one", "/dashboard/customers"]]) {
  test(`Back from ${pathname} navigates to a real parent without browser history`, async ({ page }) => {
    await page.goto(`https://forms.test/fixture?pathname=${encodeURIComponent(pathname)}`);
    await page.locator("#dashboard-page-back-button").click();
    await expect(page).toHaveURL(`https://forms.test${destination}`);
  });
}
