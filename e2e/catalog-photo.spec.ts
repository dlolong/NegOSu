import { expect, test } from "@playwright/test";
import { renderFormFixture } from "./fixtures/form-browser";
let html: string;
test.beforeAll(async () => { html = await renderFormFixture("e2e/fixtures/catalog-photo.tsx"); });
test.beforeEach(async ({ page }) => {
  await page.route("https://forms.test/**", route => route.fulfill({ contentType: "text/html", body: html }));
  await page.route("https://images.test/**", route => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="100"/>' }));
  await page.route("**/api/dashboard/images", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ allowed: false, owner: true }) }));
  await page.goto("https://forms.test/photo");
});
test("preview opens URL and upload popup; cancel and Escape discard edits and return focus", async ({ page }) => {
  await page.locator("#product-photo-edit").click();
  await expect(page.locator("#product-photo-dialog")).toBeVisible();
  await expect(page.getByText("Image uploads require a paid plan.")).toBeVisible();
  await page.locator("#product-photo-url").fill("https://images.test/new.png");
  await page.locator("#product-photo-cancel").click();
  await expect(page.locator("#product-photo-preview img")).toHaveAttribute("src", "https://images.test/old.png");
  await expect(page.locator("#product-photo-edit")).toBeFocused();
  await page.locator("#product-photo-edit").click();
  await expect(page.locator("#product-photo-url")).toHaveValue("https://images.test/old.png");
  await page.keyboard.press("Escape");
  await expect(page.locator("#product-photo-dialog")).not.toBeVisible();
});
test("using photo updates enclosing form without submitting it and rejects unsafe URLs", async ({ page }) => {
  await page.locator("#product-photo-edit").click();
  await page.locator("#product-photo-url").fill("javascript:alert(1)");
  await page.locator("#product-photo-save").click();
  await expect(page.locator("#product-photo-error")).toBeVisible();
  await page.locator("#product-photo-url").fill("https://images.test/new.png");
  await page.locator("#product-photo-url").press("Enter");
  await expect(page.locator("#parent-result")).toHaveText("");
  await expect(page.locator("#product-photo-preview img")).toHaveAttribute("src", "https://images.test/new.png");
  await page.locator("#parent-save").click();
  await expect(page.locator("#parent-result")).toHaveText("https://images.test/new.png");
});
test("direct save keeps failed edits open and supports photo removal without overflow", async ({ page }) => {
  await page.locator("#detail-photo-edit").click();
  await page.locator("#detail-photo-url").fill("https://images.test/reject.png");
  await page.locator("#detail-photo-save").click();
  await expect(page.locator("#detail-photo-error")).toContainText("Photo changed");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator("#detail-photo-clear").click();
  await page.locator("#detail-photo-save").click();
  await expect(page.locator("#detail-photo-preview")).toContainText("Promo preview");
});
