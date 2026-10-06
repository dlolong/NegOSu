import { test, expect } from "@playwright/test";
import { renderFormFixture } from "./fixtures/form-browser";
let html: string;
test.beforeAll(async () => { html = await renderFormFixture("e2e/fixtures/contact-form.tsx"); });
test("inquiries preserve values and retry IDs on error, prevent repeat clicks, and show success", async ({page}) => {
 await page.route("https://forms.test/**", route => route.fulfill({contentType:"text/html",body:html}));
 const submissions: Array<Record<string,string>> = [];
 await page.exposeFunction("recordFormAction", async (_name: string, fields: Array<[string,string]>) => {
  submissions.push(Object.fromEntries(fields));
  await new Promise(resolve => setTimeout(resolve, 500));
  return submissions.length === 1 ? {error:"Please try again."} : {success:true};
 });
 await page.goto("https://forms.test/contact");
 await page.locator("#contact-name").fill("Jane Client");
 await page.locator("#contact-email").fill("jane@example.com");
 await page.locator("#contact-subject").fill("Plans question");
 await page.locator("#contact-message").fill("Please explain the available plans.");
 await page.locator("#contact-submit").click();
 await expect(page.locator("#contact-submit")).toBeDisabled();
 await expect(page.locator("#contact-error")).toBeVisible();
 await expect(page.locator("#contact-name")).toHaveValue("Jane Client");
 await page.locator("#contact-submit").click();
 await expect(page.locator("#contact-success")).toBeVisible();
 await expect(page.locator("#contact-submit")).toHaveCount(0);
 expect(submissions).toHaveLength(2);
 expect(submissions[0].id).toBe(submissions[1].id);
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
