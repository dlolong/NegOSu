import { expect, test } from "@playwright/test";
import { renderFormFixture } from "./fixtures/form-browser";

let html: string;
test.beforeAll(async () => { html = await renderFormFixture("e2e/fixtures/commerce-catalog.tsx"); });
test.beforeEach(async ({ page }) => { await page.route("https://forms.test/**", route => route.fulfill({ contentType: "text/html", body: html })); await page.route("**/api/dashboard/images",route=>route.fulfill({contentType:"application/json",body:JSON.stringify({allowed:false,owner:true})})); });

test("product edits preserve inputs on a rejected save and submit no stock balance", async ({ page }) => {
  const submissions: Array<Array<[string, string]>> = [];
  await page.exposeFunction("recordFormAction", (_name: string, fields: Array<[string, string]>) => { submissions.push(fields); return { error: "Product unavailable." }; });
  await page.goto("https://forms.test/catalog");
  await expect(page.getByLabel("How do you count this product?")).toBeVisible();
  await expect(page.locator("#product-unit-help")).toContainText("piece for individual items");
  await page.locator("#product-name").fill("Updated shampoo");
  await page.locator("#product-price").fill("12.50");
  await page.locator("#product-save").click();
  await expect(page.getByRole("alert")).toHaveText("Product unavailable.");
  await expect(page.locator("#product-name")).toHaveValue("Updated shampoo");
  expect(submissions).toHaveLength(1);
  expect(Object.fromEntries(submissions[0]).price).toBe("12.50");
  expect(submissions[0].some(([key]) => ["quantity_on_hand", "quantity", "balance"].includes(key))).toBe(false);
  expect(await page.locator("#root").evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
});

test("promo composition submits native units and a fixed price without stock effects", async ({ page }) => {
  const submissions: Array<Array<[string, string]>> = [];
  await page.exposeFunction("recordFormAction", (_name: string, fields: Array<[string, string]>) => { submissions.push(fields); return { error: "Please review." }; });
  await page.goto("https://forms.test/catalog?promo=1");
  await page.locator("#promo-name").fill("Facial and shampoo");
  await page.locator("#promo-price").fill("1500.00");
  await page.locator("#promo-component-0-reference").selectOption("11111111-1111-4111-8111-111111111111");
  await page.locator("#promo-component-1-reference").selectOption("22222222-2222-4222-8222-222222222222");
  expect(submissions).toHaveLength(0);
  await page.locator("#promo-save").click();
  await expect(page.getByRole("alert")).toHaveText("Please review.");
  const fields = Object.fromEntries(submissions[0]);
  expect(JSON.parse(fields.components)[1]).toMatchObject({ unit: "piece", quantity: "1", kind: "product" });
  await expect(page.locator("#promo-name")).toHaveValue("Facial and shampoo");
  expect(await page.locator("#root").evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
});

test("hospitality accommodation does not require a fake service or room product", async ({ page }) => {
  await page.goto("https://forms.test/catalog?promo=1&stay=1");
  await expect(page.locator("#promo-component-0-kind")).toHaveValue("accommodation");
  await expect(page.locator("#promo-component-0-reference")).toHaveCount(0);
  await expect(page.getByText("Covers the agreed stay charge; never a stocked room.")).toBeVisible();
});

test("promo image URL is available without upload entitlement and survives a rejected save", async ({page})=>{
  await page.route("**/api/dashboard/images",route=>route.fulfill({contentType:"application/json",body:JSON.stringify({allowed:false,owner:true})}));
  const submissions:Array<Array<[string,string]>>=[];
  await page.exposeFunction("recordFormAction",(_name:string,fields:Array<[string,string]>)=>{submissions.push(fields);return {error:"Please review."};});
  await page.goto("https://forms.test/catalog?promo=1");
  await expect(page.getByText("Direct image uploads are available on paid plans.")).toBeVisible();
  await page.locator("#promo-image-url").fill("https://images.example.test/promo.jpg");
  await page.locator("#promo-name").fill("Haircut bundle");await page.locator("#promo-price").fill("150.00");
  await page.locator("#promo-component-0-reference").selectOption("11111111-1111-4111-8111-111111111111");await page.locator("#promo-component-1-reference").selectOption("22222222-2222-4222-8222-222222222222");
  await page.locator("#promo-public").check();await page.locator("#promo-save").click();
  await expect(page.getByRole("alert")).toContainText("Please review.");
  expect(Object.fromEntries(submissions[0]).imageUrl).toBe("https://images.example.test/promo.jpg");
  expect(Object.fromEntries(submissions[0]).isPublic).toBe("on");
  await expect(page.locator("#promo-image-url")).toHaveValue("https://images.example.test/promo.jpg");
});

test("paid upload fills promo image URL using the shared upload endpoint",async({page})=>{
  await page.route("**/api/dashboard/images",route=>route.fulfill({contentType:"application/json",body:JSON.stringify(route.request().method()==="POST"?{url:"https://images.example.test/uploaded.jpg"}:{allowed:true,owner:true})}));
  await page.exposeFunction("recordFormAction",()=>({}));
  await page.goto("https://forms.test/catalog?promo=1");
  await page.locator("#promo-image-url-upload-file").setInputFiles({name:"promo.png",mimeType:"image/png",buffer:Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==","base64")});
  await expect(page.locator("#promo-image-url")).toHaveValue("https://images.example.test/uploaded.jpg");
  await expect(page.getByText("Uploaded. Save this form to use the photo.")).toBeVisible();
});

test("promo can select multiple service components without requiring a product",async({page})=>{
 const submissions:Array<Array<[string,string]>>=[];
 await page.exposeFunction("recordFormAction",(_name:string,fields:Array<[string,string]>)=>{submissions.push(fields);return {};});
 await page.goto("https://forms.test/catalog?promo=1");
 await page.locator("#promo-name").fill("Facial and massage");await page.locator("#promo-price").fill("299.99");
 await page.locator("#promo-component-0-reference").selectOption("11111111-1111-4111-8111-111111111111");
 await page.locator("#promo-component-1-kind").selectOption("service");
 await page.locator("#promo-component-1-reference").selectOption("44444444-4444-4444-8444-444444444444");
 await page.locator("#promo-save").click();await expect.poll(()=>submissions.length).toBe(1);
 expect(JSON.parse(Object.fromEntries(submissions[0]).components).map((c:{kind:string})=>c.kind)).toEqual(["service","service"]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
