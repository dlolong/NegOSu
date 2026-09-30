import {expect,test} from "@playwright/test";
import {renderFormFixture} from "./fixtures/form-browser";
let html:string;
test.beforeAll(async()=>{html=await renderFormFixture("e2e/fixtures/booking-alternative.tsx");});
test.beforeEach(async({page})=>{await page.route("https://forms.test/**",route=>route.fulfill({contentType:"text/html",body:html}));});
test("client can accept the exact offer or cancel, with errors retained",async({page})=>{
 const submitted:Array<Record<string,string>>=[];
 await page.exposeFunction("recordFormAction",(_name:string,fields:Array<[string,string]>)=>{submitted.push(Object.fromEntries(fields));return {error:"Offer changed. Refresh."};});
 await page.goto("https://forms.test/alternative");
 await expect(page.getByText("Staff: Jamie")).toBeVisible();
 await page.locator("#booking-alternative-accept").click();await expect(page.getByRole("alert")).toContainText("Offer changed");
 expect(submitted[0]).toMatchObject({token:"a".repeat(64),version:"2",action:"accept"});
 await page.locator("#booking-alternative-cancel").click();await expect.poll(()=>submitted.length).toBe(2);expect(submitted[1].action).toBe("cancel");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test("accepted offer clearly awaits business confirmation",async({page})=>{
 await page.goto("https://forms.test/alternative?accepted=1");
 await expect(page.locator("#booking-alternative-accept")).toHaveCount(0);
 await expect(page.getByText(/Your appointment is not confirmed yet/)).toBeVisible();
 await expect(page.locator("#booking-alternative-cancel")).toBeVisible();
});
