import {expect,test} from "@playwright/test";
import {renderFormFixture} from "./fixtures/form-browser";
let html:string;
test.beforeAll(async()=>{html=await renderFormFixture("e2e/fixtures/page-guide.tsx");});
test.beforeEach(async({page})=>{await page.route("https://forms.test/**",route=>route.fulfill({contentType:"text/html",body:html}));await page.goto("https://forms.test/guide");});
test("first-visit tour automatically starts and completes without submitting a sale and can be replayed",async({page})=>{
 await expect(page.locator("#page-guide-start")).toHaveAccessibleName("New sale guide");
 await expect(page.locator("#page-guide-start")).toHaveText("");
 await expect(page.locator("#page-guide-dismiss")).toHaveCount(0);
 await expect(page.locator(".driver-popover-title")).toHaveText("Customer is optional");
 await page.locator(".driver-popover-next-btn").click();
 await expect(page.locator(".driver-popover-title")).toHaveText("Choose products next");
 await page.locator(".driver-popover-next-btn").click();
 await expect(page.locator(".driver-popover")).toHaveCount(0);
 expect(await page.locator("body").getAttribute("data-mutated")).toBeNull();
 await expect.poll(()=>page.evaluate(()=>localStorage.getItem("negosu:guide:v1:test-member:salon:owner:new-sale"))).toBe("completed");
 await page.reload();await page.waitForTimeout(1200);await expect(page.locator(".driver-popover")).toHaveCount(0);
 await page.locator("#page-guide-start").click();await expect(page.locator(".driver-popover")).toBeVisible();
 const box=await page.locator(".driver-popover").boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
 await page.keyboard.press("Escape");await expect(page.locator(".driver-popover")).toHaveCount(0);await expect(page.locator("#page-guide-start")).toBeFocused();
});
test("dismissal persists and opening a native dialog cleans up the tour",async({page})=>{
 await page.locator("#page-guide-start").click();
 await expect(page.locator(".driver-popover")).toBeVisible();
 await page.keyboard.press("Escape");
 await expect.poll(()=>page.evaluate(()=>localStorage.getItem("negosu:guide:v1:test-member:salon:owner:new-sale"))).toBe("dismissed");
 await page.reload();await page.waitForTimeout(1200);await expect(page.locator(".driver-popover")).toHaveCount(0);
 await page.locator("#page-guide-start").click();await expect(page.locator(".driver-popover")).toBeVisible();
 await page.evaluate(()=>document.querySelector<HTMLDialogElement>("#edit-dialog")!.showModal());
 await expect(page.locator(".driver-popover")).toHaveCount(0);await expect(page.locator("#edit-dialog")).toBeVisible();
 await page.getByText("Close edit",{exact:true}).click();
 await page.locator("#page-guide-start").click();await expect(page.locator(".driver-popover")).toBeVisible();
 await page.evaluate(()=>document.querySelector<HTMLButtonElement>("#navigate")!.click());await expect(page.locator(".driver-popover")).toHaveCount(0);
});

test("first-visit tour waits until an open edit dialog closes",async({page})=>{
 await page.evaluate(()=>document.querySelector<HTMLDialogElement>("#edit-dialog")!.showModal());
 await page.waitForTimeout(1200);
 await expect(page.locator(".driver-popover")).toHaveCount(0);
 await page.getByText("Close edit",{exact:true}).click();
 await expect(page.locator(".driver-popover-title")).toHaveText("Customer is optional");
});
