import { expect, test } from "@playwright/test";
import { renderFormFixture } from "./fixtures/form-browser";
test("reopening lookup reuses choices, changes and scope switches refresh them", async ({page})=>{
 const html=await renderFormFixture("e2e/fixtures/lookup-cache.tsx");
 await page.route("https://forms.test/**",r=>r.fulfill({contentType:"text/html",body:html}));
 let reads=0;
 await page.exposeFunction("recordFormAction",()=>{reads++;return {data:[{id:"customer",name:`Customer ${reads}`}]};});
 await page.goto("https://forms.test/lookup");
 const input=page.locator("#lookup");
 await input.click(); await expect(page.getByRole("option")).toContainText("Customer 1");
 await input.press("Escape"); await page.locator("#outside").click(); await input.click();
 await expect(page.getByRole("option")).toContainText("Customer 1"); expect(reads).toBe(1);
 await input.press("Escape"); await page.locator("#new-options").click(); await input.click();
 await expect(page.getByRole("option")).toContainText("Customer 2"); expect(reads).toBe(2);
 await input.press("Escape"); await page.locator("#change-scope").click(); await input.click();
 await expect(page.getByRole("option")).toContainText("Customer 3"); expect(reads).toBe(3);
});
