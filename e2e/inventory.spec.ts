import { expect, test, type Page } from "@playwright/test";
import { renderFormFixture } from "./fixtures/form-browser";
test.use({ browserName: "chromium" });
let html: string;
const calls: Array<{ name: string; data: Record<string, string> }> = [];
let failure: string | undefined;
let release: (() => void) | undefined;
test.beforeAll(async () => { html = await renderFormFixture("e2e/fixtures/inventory.tsx"); });
test.beforeEach(async ({ page }) => {
  calls.length = 0; failure = undefined; release = undefined;
  await page.exposeFunction("recordFormAction", async (name: string, entries: Array<[string, string]>) => {
    calls.push({ name, data: Object.fromEntries(entries) });
    if (entries.some(([key, value]) => key === "note" && value === "WAIT")) await new Promise<void>(resolve => { release = resolve; });
    return failure ? { error: failure } : {};
  });
  await page.route("https://forms.test/**", route => route.fulfill({ contentType: "text/html", body: html }));
});
async function contained(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  for (const element of await page.locator('button:visible, a:visible, input:visible, select:visible').all()) {
    const box = await element.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  }
}
test("stock list is focused, responsive and handles long product metadata", async ({ page }) => {
  await page.goto("https://forms.test/dashboard/inventory?long=1");
  await expect(page.getByRole("link", { name: "Record movement", exact: true }).filter({ visible: true })).toHaveCount(3);
  await expect(page.locator('form:visible')).toHaveCount(1);
  await contained(page);
  await page.screenshot({ path: test.info().outputPath("inventory.png"), fullPage: true });
});
test("search and stock status filters find products, and Clear restores the list", async ({ page }) => {
  await page.goto("https://forms.test/dashboard/inventory");
  await page.locator("#inventory-search-input").fill("Supplies");
  await page.locator("#inventory-status-filter").selectOption("out");
  await page.locator("#inventory-filter-button").click();
  await expect(page.getByRole("link", { name: "Record movement", exact: true }).filter({ visible: true })).toHaveCount(1);
  await expect(page.getByText("Brush", { exact: true }).filter({ visible: true })).toBeVisible();
  await page.locator("#inventory-clear-filters").click();
  await expect(page.getByRole("link", { name: "Record movement", exact: true }).filter({ visible: true })).toHaveCount(3);
});
test("Add product validates, preserves drafts on errors and Cancel keeps search context", async ({ page }) => {
  await page.goto("https://forms.test/dashboard/inventory?q=clean");
  await page.locator("#inventory-item-add-button").click();
  await page.locator("#inventory-item-save-button").click();
  expect(calls).toEqual([]);
  await page.locator("#inventory-item-name-input").fill("Test product");
  failure = "This SKU already exists in the selected branch.";
  await page.locator("#inventory-item-save-button").click();
  await expect(page.getByRole("alert")).toContainText("This SKU already exists");
  await expect(page.locator("#inventory-item-name-input")).toHaveValue("Test product");
  await contained(page);
  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL("https://forms.test/dashboard/inventory?q=clean");
  expect(calls).toHaveLength(1);
});
test("movement explains deductions and keeps an idempotency key when a retry is needed", async ({ page }) => {
  await page.goto("https://forms.test/dashboard/inventory");
  await page.getByRole("link", { name: "Record movement", exact: true }).filter({ visible: true }).first().click();
  await page.locator("#inventory-item-movement-type").selectOption("usage");
  await expect(page.getByText(/This quantity will be deducted/)).toBeVisible();
  await page.locator("#inventory-item-movement-quantity").fill("1.25");
  failure = "Insufficient available stock.";
  await page.locator("#inventory-item-movement-save").click();
  await expect(page.getByRole("alert")).toContainText("Insufficient");
  await expect(page.locator("#inventory-item-movement-quantity")).toHaveValue("1.25");
  await page.locator("#inventory-item-movement-save").click();
  await expect.poll(() => calls.length).toBe(2);
  expect(calls[0].data.idempotencyKey).toBe(calls[1].data.idempotencyKey);
  expect(calls[0].data).toMatchObject({ itemId: "a7000000-0000-4000-8000-000000000001", type: "usage", quantity: "1.25" });
  await contained(page);
});
test("pending movement disables Save and Cancel to prevent duplicate submissions", async ({ page }) => {
  await page.goto("https://forms.test/dashboard/inventory?dialog=movement&itemId=a7000000-0000-4000-8000-000000000001");
  await page.locator("#inventory-item-movement-quantity").fill("1");
  await page.locator("#inventory-item-movement-note").fill("WAIT");
  await page.locator("#inventory-item-movement-save").click();
  await expect(page.locator("#inventory-item-movement-save")).toBeDisabled();
  await expect(page.getByRole("link", { name: "Cancel", exact: true })).toHaveAttribute("aria-disabled", "true");
  await expect.poll(() => calls.length).toBe(1);
  release?.();
  await expect(page.locator("#inventory-item-movement-save")).toBeEnabled();
});
test("transfers filter destination SKUs, reset stale selections and submit chosen stock", async ({ page }) => {
  await page.goto("https://forms.test/dashboard/inventory?dialog=transfer");
  const source = page.locator("#inventory-transfer-source"), target = page.locator("#inventory-transfer-target");
  await expect(target).toBeDisabled();
  await source.selectOption("a7000000-0000-4000-8000-000000000001");
  await expect(target.locator("option")).toHaveCount(2);
  await target.selectOption("a7000000-0000-4000-8000-000000000004");
  await source.selectOption("a7000000-0000-4000-8000-000000000002");
  await expect(target).toHaveValue("");
  await expect(page.locator("#inventory-transfer-button")).toBeDisabled();
  await expect(page.getByText(/No matching product in another accessible branch/)).toBeVisible();
  await source.selectOption("a7000000-0000-4000-8000-000000000001");
  await target.selectOption("a7000000-0000-4000-8000-000000000004");
  await page.locator("#inventory-transfer-quantity").fill("2");
  await contained(page);
  await page.locator("#inventory-transfer-button").click();
  await expect.poll(() => calls.length).toBe(1);
  expect(calls[0]).toMatchObject({ name: "transferStock", data: { sourceItemId: "a7000000-0000-4000-8000-000000000001", targetItemId: "a7000000-0000-4000-8000-000000000004", quantity: "2" } });
});
test("recipe Save submits the selected service and branch product", async ({ page }) => {
  await page.goto("https://forms.test/dashboard/inventory?dialog=recipe");
  await page.locator("#inventory-recipe-service-select").selectOption("87000000-0000-4000-8000-000000000001");
  await expect(page.locator("#inventory-recipe-item-select option")).toHaveCount(4);
  await page.locator("#inventory-recipe-item-select").selectOption("a7000000-0000-4000-8000-000000000001");
  await page.locator("#inventory-recipe-quantity-input").fill("0.5");
  await page.locator("#inventory-recipe-save-button").click();
  await expect.poll(() => calls.length).toBe(1);
  expect(calls[0].name).toBe("saveRecipe");
  await contained(page);
});
test("history displays dated signed movements and Close dismisses a dialog without mutation", async ({ page }) => {
  await page.goto("https://forms.test/dashboard/inventory");
  await page.locator("#inventory-history-tab").click();
  await expect(page.locator("#inventory-history")).toContainText("+5 L");
  await expect(page.locator("time")).toHaveAttribute("datetime", "2026-09-14T03:00:00Z");
  await page.locator("#inventory-transfer-open-button").click();
  await page.locator("#inventory-transfer-dialog-close-button").click();
  await expect(page).toHaveURL("https://forms.test/dashboard/inventory?view=history");
  expect(calls).toEqual([]);
});
test("empty, failed, missing product, read-only and Salon states do not expose invalid forms", async ({ page }) => {
  await page.goto("https://forms.test/dashboard/inventory?empty=1");
  await expect(page.getByText("Your inventory starts here")).toBeVisible();
  await page.goto("https://forms.test/dashboard/inventory?failed=1");
  await expect(page.getByRole("alert")).toContainText("Unable to load inventory");
  await expect(page.locator("#inventory-metrics")).toHaveCount(0);
  await page.goto("https://forms.test/dashboard/inventory?dialog=movement&itemId=missing");
  await expect(page.getByRole("alert")).toContainText("not available in the selected branch");
  await expect(page.locator("dialog form")).toHaveCount(0);
  await page.goto("https://forms.test/dashboard/inventory?readonly=1&dialog=create");
  await expect(page.locator("dialog, #inventory-item-add-button")).toHaveCount(0);
  await page.goto("https://forms.test/dashboard/inventory?industry=salon&dialog=recipe");
  await expect(page.locator("dialog, #inventory-recipe-open-button")).toHaveCount(0);
  await expect(page.locator("#salon-inventory-page")).toBeVisible();
});

test("stock pagination keeps filters and Escape closes a dialog", async ({ page }) => {
  await page.goto("https://forms.test/dashboard/inventory?many=1&q=extra");
  await expect(page.getByRole("link", { name: "Record movement", exact: true }).filter({ visible: true })).toHaveCount(20);
  await expect(page.getByRole("link", { name: "Next", exact: true })).toHaveAttribute("href", "/dashboard/inventory?q=extra&page=2");
  await page.goto("https://forms.test/dashboard/inventory?many=1&q=extra&page=2");
  await expect(page.getByRole("link", { name: "Record movement", exact: true }).filter({ visible: true })).toHaveCount(4);
  await page.locator("#inventory-item-add-button").click();
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog")).toHaveCount(0);
  expect(calls).toEqual([]);
});

test("additional product details fit the dialog and save with visible fields", async ({ page }) => {
  await page.goto("https://forms.test/dashboard/inventory?dialog=create");
  await page.locator("#inventory-item-name-input").fill("New stock");
  await page.getByText("Additional details (optional)").click();
  await page.locator("#inventory-item-lot-input").fill("BATCH-1");
  await page.locator("#inventory-item-expiry-input").fill("2028-12-31");
  await page.locator("#inventory-item-cost-input").fill("12.50");
  await contained(page);
  await page.locator("#inventory-item-save-button").click();
  await expect.poll(() => calls.length).toBe(1);
  expect(calls[0].data).toMatchObject({ name: "New stock", lotNumber: "BATCH-1", expiresOn: "2028-12-31", cost: "12.50" });
});

test("stock and dialogs fit tablet and desktop content beside a sidebar", async ({ page }) => {
  for (const width of [768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("https://forms.test/dashboard/inventory");
    if (width >= 1024) await page.locator("#root").evaluate(element => { element.style.marginLeft = "260px"; });
    await contained(page);
    await page.locator("#inventory-item-add-button").click();
    await contained(page);
  }
});

test("stock items open read-only details from their name and row/card content", async ({ page }) => {
  await page.goto("https://forms.test/dashboard/inventory?q=clean");
  await page.locator('[data-record-link]').filter({ visible: true }).first().click();
  await expect(page.locator("#inventory-details-dialog")).toBeVisible();
  await expect(page.locator("#inventory-details-dialog-title")).toHaveText("Cleaning solution");
  await page.locator("#inventory-details-dialog-close-button").click();
  await expect(page).toHaveURL("https://forms.test/dashboard/inventory?q=clean");
  await page.goto("https://forms.test/dashboard/inventory?readonly=1&long=1");
  await page.locator('[data-record-link]').filter({ visible: true }).first().click();
  await expect(page.locator("#inventory-details-dialog")).toBeVisible();
  expect(calls).toEqual([]);
  await expect(page.locator("#inventory-details-dialog").getByRole("link", { name: "Record movement", exact: true })).toHaveCount(0);
  await contained(page);
});
