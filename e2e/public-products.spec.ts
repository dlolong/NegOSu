import { expect, test } from "@playwright/test";
import { renderFormFixture } from "./fixtures/form-browser";
let html: string;
test.beforeAll(async () => { html = await renderFormFixture("e2e/fixtures/public-products.tsx"); });
test.beforeEach(async ({ page }) => { await page.route("https://forms.test/**", route => route.fulfill({ contentType: "text/html", body: html })); });
test("public products show customer details and branch with an order entry", async ({ page }) => {
  await page.route("https://images.example.test/**", route => route.fulfill({ contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==", "base64") }));
  await page.goto("https://forms.test/products");
  await expect(page.getByAltText("Take-home shampoo product")).toBeVisible();
  await expect(page.locator("#public-shop-products")).toContainText("Take-home shampoo");
  await expect(page.locator("#public-product-order-product-example [data-record-title-arrow]")).toBeVisible();
  await expect(page.locator("#public-product-order-product-example")).toHaveAccessibleName("Take-home shampoo");
  await expect(page.locator("#public-product-product-example")).toContainText("125.00");
  await expect(page.locator("#public-product-product-example")).toContainText("bottle");
  await expect(page.locator("#public-product-location-product-example")).toHaveAttribute("href", "#public-automotive-shop-branch-branch-example");
  await expect(page.locator("#public-product-order-product-example")).toHaveAttribute("href", "/shop/test-shop/products/product-example");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test("an empty public product catalog adds no empty section", async ({ page }) => {
  await page.goto("https://forms.test/products?empty=1");
  await expect(page.locator("#public-shop-products")).toHaveCount(0);
});
for (const width of [390, 1440]) {
  test(`products group by category and scroll horizontally at ${width}px`, async ({page}) => {
    await page.setViewportSize({width,height:900});
    await page.goto("https://forms.test/products?multiple=1");
    const row=page.getByRole("region",{name:"Hair care",exact:true});
    await expect(row).toBeVisible();
    await expect(row.locator('[id^="public-product-order-"]')).toHaveCount(5);
    await expect(page.getByRole("heading",{name:"Other products (1)"})).toBeVisible();
    expect(await row.evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(true);
    await row.focus();
    await page.keyboard.press("ArrowRight");
    await expect.poll(()=>row.evaluate(el=>el.scrollLeft)).toBeGreaterThan(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}
test("product card content opens details without a separate details button",async({page})=>{
 await page.goto("https://forms.test/products");
 await expect(page.getByRole("button",{name:"Product details"})).toHaveCount(0);
 await page.locator("#public-product-product-example").getByText("For daily care",{exact:true}).click();
 await expect(page).toHaveURL("https://forms.test/shop/test-shop/products/product-example");
});
