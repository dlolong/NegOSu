import { expect, test } from "@playwright/test";
import { renderFormFixture } from "./fixtures/form-browser";
let html: string;
test.beforeAll(async()=>{html=await renderFormFixture("e2e/fixtures/compact-record-list.tsx");});
test.beforeEach(async({page})=>{await page.route("https://forms.test/**",route=>route.fulfill({contentType:"text/html",body:html}));});
for (const width of [390,1280]) test(`responsive records and filtering at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:850});await page.goto("https://forms.test/list");
  await expect(page.locator("#ana-edit")).toHaveCount(1);
  expect(await page.locator("#records").evaluate(element=>getComputedStyle(element).display)).toBe(width<768?"block":"table");
  await expect(page.locator("#ana")).toContainText("Oct 5");
  await page.locator("#records-search").fill("ana");
  await expect(page.locator("#ana")).toBeVisible();await expect(page.locator("#bea")).toHaveCount(0);
  await page.locator("#records-search").fill("");await page.locator("#records-filter").selectOption("Scheduled");
  await expect(page.locator("#ana")).toHaveCount(0);await expect(page.locator("#bea")).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
