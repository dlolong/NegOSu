import {expect,test} from "@playwright/test";
import {renderFormFixture} from "./fixtures/form-browser";
let html:string;
test.beforeAll(async()=>{html=await renderFormFixture("e2e/fixtures/public-booking-wizard.tsx");});
test.beforeEach(async({page})=>{await page.route("https://forms.test/**",route=>route.fulfill({contentType:"text/html",body:html}));});
test("wizard shows one step, validates details, reviews promo and preserves a rejected draft",async({page})=>{
 const submissions:Array<Array<[string,string]>>=[];
 await page.exposeFunction("recordFormAction",(name:string,data:Array<[string,string]>)=>{if(name==="submitBooking")submissions.push(data);return {error:"This time was just taken."};});
 await page.goto("https://forms.test/book?pet=1");
 await expect(page.locator("#public-booking-progress")).toContainText("Step 3 of 5");await expect(page.locator("#public-booking-customer-section")).toBeHidden();await expect(page.locator("#public-booking-submit-button")).toHaveCount(0);
 await page.locator("#public-booking-time-option-0").click();await page.locator("#public-booking-next-step").click();
 await expect(page.locator("#public-booking-time-section")).toBeHidden();await page.locator("#public-booking-next-step").click();await expect(page.locator("#public-booking-progress")).toContainText("Step 4 of 5");
 await page.locator("#public-booking-name-input").fill("Jane Client");await page.locator("#public-booking-phone-input").fill("09171234567");await page.locator("#public-booking-pet-name").fill("Milo");await page.locator("#public-booking-pet-species").selectOption("dog");await page.locator("#public-booking-next-step").click();
 await expect(page.locator("#public-booking-review")).toContainText("Haircut and shampoo");await expect(page.locator("#public-booking-review")).toContainText("Shampoo · 1 bottle");await expect(page.locator("#public-booking-customer-section")).toBeHidden();
 expect(submissions).toHaveLength(0);
 await page.locator("#public-booking-submit-button").click();await expect(page.getByRole("alert")).toContainText("This time was just taken.");
 expect(submissions).toHaveLength(1);expect(JSON.parse(Object.fromEntries(submissions[0]).promoSelections)[0].version).toBe(2);expect(Object.fromEntries(submissions[0]).customerName).toBe("Jane Client");
 await page.locator("#public-booking-previous-step").click();await expect(page.locator("#public-booking-name-input")).toHaveValue("Jane Client");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test("promo selection replaces ordinary service and clears when switching branches",async({page})=>{
 await page.exposeFunction("recordFormAction",()=>({}));await page.goto("https://forms.test/book?selection=1");
 await page.locator('input[id^="public-booking-promo-"]').check();
 await expect(page.locator('#public-booking-service-options input[type="checkbox"]')).not.toBeChecked();
 await expect(page.locator('input[name="services"]')).toHaveCount(1);await expect(page.locator('input[name="promos"]')).toHaveCount(1);
 await page.locator("#public-booking-branch-select").selectOption("other");await expect(page.locator('input[name="promos"]')).toHaveCount(0);await expect(page.locator("#public-booking-show-availability-button")).toBeDisabled();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test("multiple-service promo selects all services and review charges its price once",async({page})=>{
 await page.exposeFunction("recordFormAction",()=>({}));
 await page.goto("https://forms.test/book?selection=1&multi=1");
 await page.locator('input[id^="public-booking-promo-"]').check();
 await expect(page.locator('input[name="services"]')).toHaveCount(2);
 await expect(page.locator("#public-booking-promo-options")).toContainText("90 min");
 await page.locator('#public-booking-service-10000000-0000-4000-8000-000000000004').check();
 await expect(page.locator('input[name="promos"]')).toHaveCount(0);
 await page.goto("https://forms.test/book?multi=1");
 await page.locator("#public-booking-time-option-0").click();await page.locator("#public-booking-next-step").click();
 await page.locator("#public-booking-name-input").fill("Jane Client");await page.locator("#public-booking-phone-input").fill("09171234567");await page.locator("#public-booking-next-step").click();
 const review=page.locator("#public-booking-review");
 await expect(review).toContainText("Color");await expect(review.getByText("Promo · Haircut and shampoo",{exact:true})).toHaveCount(1);
 await expect(review).toContainText("₱150.00");await expect(review).not.toContainText("₱300.00");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
