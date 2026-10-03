import { expect, test } from "@playwright/test";
import { renderFormFixture } from "./fixtures/form-browser";
let html: string;
test.beforeAll(async () => { html = await renderFormFixture("e2e/fixtures/public-products.tsx"); });
test.beforeEach(async ({ page }) => { await page.route("https://forms.test/**", route => route.fulfill({ contentType: "text/html", body: html })); });
test("public products show customer details and branch without purchase controls", async ({ page }) => {
  await page.route("https://images.example.test/**", route => route.fulfill({ contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==", "base64") }));
  await page.goto("https://forms.test/products");
  await expect(page.getByAltText("Take-home shampoo product")).toBeVisible();
  await expect(page.locator("#public-shop-products")).toContainText("Take-home shampoo");
  await expect(page.locator("#public-product-product-example")).toContainText("125.00");
  await expect(page.locator("#public-product-product-example")).toContainText("bottle");
  await expect(page.locator("#public-product-location-product-example")).toHaveAttribute("href", "#public-automotive-shop-branch-branch-example");
  await expect(page.getByText("Contact the listed location", { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test("an empty public product catalog adds no empty section", async ({ page }) => {
  await page.goto("https://forms.test/products?empty=1");
  await expect(page.locator("#public-shop-products")).toHaveCount(0);
});
