import { expect,test } from "@playwright/test";
import { renderFormFixture } from "./fixtures/form-browser";
let html:string;
test.beforeAll(async()=>{html=await renderFormFixture("e2e/fixtures/appointment-promos.tsx");});
test.beforeEach(async({page})=>{await page.route("https://forms.test/**",route=>route.fulfill({contentType:"text/html",body:html}));});
test("promo replaces regular service and submits its version without client pricing",async({page})=>{
 const submissions:Array<Array<[string,string]>>=[];
 await page.exposeFunction("recordFormAction",(name:string,fields:Array<[string,string]>)=>{if(name==="saveAppointment")submissions.push(fields);return {};});
 await page.goto("https://forms.test/promos");
 await page.locator("#booking-promo-select").click();
 await page.getByRole("option",{name:/Promo · Haircut/}).click();
 await expect(page.locator('#booking-selected-services input[name="serviceIds"]')).toHaveCount(0);
 await expect(page.locator('input[name="serviceIds"]')).toHaveCount(1);
 await page.locator("#promo-test-save").click();
 await expect.poll(()=>submissions.length).toBe(1);
 const fields=Object.fromEntries(submissions[0]);
 expect(JSON.parse(fields.promoSelections)).toEqual([{id:"10000000-0000-4000-8000-000000000001",version:2}]);
 expect(fields.serviceIds).toBe("10000000-0000-4000-8000-000000000002");
 expect(fields.price).toBeUndefined();
 expect(await page.locator("#root").evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
});
test("changing dates flags selected promos and changing branches clears them",async({page})=>{
 await page.exposeFunction("recordFormAction",()=>({}));await page.goto("https://forms.test/promos");
 await page.locator("#booking-promo-select").click();await page.getByRole("option",{name:/Promo · Haircut/}).click();
 await page.locator("#promo-test-date").fill("2026-11-01");
 await expect(page.getByRole("alert")).toContainText("unavailable for the selected date");
 await page.locator("#promo-test-branch").selectOption("other");
 await expect(page.locator('input[name="promoSelections"]')).toHaveValue("[]");
 await expect(page.getByText("No promos match this branch and appointment date.")).toBeVisible();
});

test("multi-service promo submits every service exactly once",async({page})=>{
 const submissions:Array<Array<[string,string]>>=[];
 await page.exposeFunction("recordFormAction",(_name:string,fields:Array<[string,string]>)=>{submissions.push(fields);return {};});
 await page.goto("https://forms.test/promos?multi=1");
 await page.locator("#booking-promo-select").click();await page.getByRole("option",{name:/Promo · Haircut/}).click();
 await expect(page.locator('input[name="serviceIds"]')).toHaveCount(2);
 await page.locator("#promo-test-save").click();await expect.poll(()=>submissions.length).toBe(1);
 expect(submissions[0].filter(([key])=>key==="serviceIds").map(([,value])=>value)).toEqual(["10000000-0000-4000-8000-000000000002","10000000-0000-4000-8000-000000000003"]);
});
