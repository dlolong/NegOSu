import { expect, test } from "@playwright/test";
import { renderFormFixture } from "./fixtures/form-browser";
import { IMAGE_UPLOAD_UNAVAILABLE } from "../modules/platform/image-upload";
let html: string;
test.beforeAll(async () => { html = await renderFormFixture("e2e/fixtures/image-upload.tsx"); });
for (const allowed of [false, true]) test(`image upload plan access ${allowed}`, async ({ page }) => {
 await page.route("https://upload.test/api/dashboard/images", route => route.fulfill({ contentType: "application/json", body: JSON.stringify(route.request().method() === "POST" ? { url: "https://example.test/uploaded.png" } : { allowed, owner: true }) }));
 await page.route("https://upload.test/fixture", route => route.fulfill({ contentType: "text/html", body: html }));
 await page.goto("https://upload.test/fixture");
 if (!allowed) { await expect(page.locator("#test-photo-upload-upgrade")).toBeVisible(); await expect(page.locator("#test-photo-upload-file")).toHaveCount(0); }
 else { await page.locator("#test-photo-upload-file").setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]) }); await expect(page.locator("#test-photo")).toHaveValue("https://example.test/uploaded.png"); await expect(page.getByText("Uploaded. Save this form to use the photo.")).toBeVisible(); }
 expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});
test("paid plan setup errors show guidance without an upgrade prompt", async ({ page }) => {
 await page.route("https://upload.test/api/dashboard/images", route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: IMAGE_UPLOAD_UNAVAILABLE }) }));
 await page.route("https://upload.test/fixture", route => route.fulfill({ contentType: "text/html", body: html }));
 await page.goto("https://upload.test/fixture");
 await expect(page.locator("#test-photo-upload-error")).toHaveText(IMAGE_UPLOAD_UNAVAILABLE);
 await expect(page.locator("#test-photo-upload-upgrade")).toHaveCount(0);
 await expect(page.locator("#test-photo-upload-file")).toHaveCount(0);
});
