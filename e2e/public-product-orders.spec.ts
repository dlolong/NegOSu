import { expect, test } from "@playwright/test";
import { renderFormFixture } from "./fixtures/form-browser";
let html: string;
test.beforeAll(async () => { html = await renderFormFixture("e2e/fixtures/public-product-orders.tsx"); });
test.beforeEach(async ({ page }) => { await page.route("https://forms.test/**", route => route.fulfill({ contentType: "text/html", body: html })); });
test("customer submits a product order once with contact and exact quantity", async ({ page }) => {
 const calls: Array<Record<string,string>> = [];
 await page.exposeFunction("recordFormAction", async (_: string, fields: Array<[string,string]>) => { calls.push(Object.fromEntries(fields)); await new Promise(resolve => setTimeout(resolve,500)); return { reference: "10000000-0000-4000-8000-000000000002" }; });
 await page.goto("https://forms.test/order");
 await page.locator("#public-product-order-quantity").fill("2");
 await expect(page.locator("#public-product-order-total")).toContainText("250.00");
 await page.locator("#public-product-order-name").fill("Test Client");
 await page.locator("#public-product-order-phone").fill("09171234567");
 await page.locator("#public-product-order-form").evaluate(form => { (form as HTMLFormElement).requestSubmit(); (form as HTMLFormElement).requestSubmit(); });
  await expect(page.locator("#public-product-order-submit")).toBeDisabled();
  await expect(page.locator("#public-product-order-phone")).toBeDisabled();
 await expect(page.locator("#public-product-order-success")).toContainText("No payment has been collected");
 expect(calls).toHaveLength(1); expect(calls[0].quantity).toBe("2"); expect(calls[0].expectedPrice).toBe("12500");
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test("product row opens its record when clicking the price", async ({ page }) => {
 await page.goto("https://forms.test/order");
 await page.locator("#product-list-price").click();
 await expect(page).toHaveURL("https://forms.test/products/example");
 await page.locator("#product-edit").click();
 await expect(page).toHaveURL(/dialog=edit&id=example/);
});
test("order errors retain customer input for retry", async ({ page }) => {
 await page.exposeFunction("recordFormAction", () => ({ error: "Unable to submit this order." }));
 await page.goto("https://forms.test/order");
 await page.locator("#public-product-order-name").fill("Test Client");
 await page.locator("#public-product-order-phone").fill("09171234567");
 await page.locator("#public-product-order-submit").click();
 await expect(page.locator("#public-product-order-error")).toBeVisible();
 await expect(page.locator("#public-product-order-name")).toHaveValue("Test Client");
});
