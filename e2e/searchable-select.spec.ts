import {test,expect} from "@playwright/test";
import {renderFormFixture} from "./fixtures/form-browser";
test.use({browserName:"chromium"});
let html:string;
test.beforeAll(async()=>{html=await renderFormFixture("e2e/fixtures/searchable-select.tsx");});
test.beforeEach(async({page})=>{await page.route("https://forms.test/**",route=>route.fulfill({contentType:"text/html",body:html}));});
test("search reaches options beyond the first page, submits IDs and reset restores the initial selection",async({page})=>{
 await page.goto("https://forms.test/");await expect(page.locator("#record-choice")).toHaveValue("Customer 60");await page.locator("#record-choice").fill("Customer 74");await page.locator("#record-choice-option-row-74").click();await expect(page).toHaveURL("https://forms.test/");await expect(page.locator("#record-choice-options")).toHaveCount(0);await page.locator("#save").click();await expect(page.locator("#result")).toContainText('"customerId":"row-74"');await page.locator("#reset").click();await expect(page.locator("#record-choice")).toHaveValue("Customer 60");await expect(page.locator('input[name="customerId"]')).toHaveValue("row-60");
});
test("failed remote search does not offer to create a supposedly missing customer",async({page})=>{
 await page.exposeFunction("recordFormAction",async()=>({error:"Unable to search customers. Please try again."}));await page.goto("https://forms.test/?remote=1");await page.locator("#record-choice").fill("Missing Customer");await expect(page.getByRole("alert")).toContainText("Unable to search");await expect(page.locator("#record-choice-create")).toHaveCount(0);
});
test("stale asynchronous results cannot replace a newer query and creation is explicit",async({page})=>{
 let release:(result:unknown)=>void=()=>{};let calls=0;
 await page.exposeFunction("recordFormAction",async()=>{calls++;if(calls===1)return new Promise(resolve=>{release=resolve;});return {data:[]};});await page.goto("https://forms.test/?remote=1");await page.locator("#record-choice").fill("Old search");await expect.poll(()=>calls).toBe(1);await page.locator("#record-choice").fill("New customer");await expect(page.locator("#record-choice-create")).toBeVisible();release({data:[{id:"old",name:"Old search"}]});await expect(page.locator("#record-choice-option-old")).toHaveCount(0);await expect(page.locator("#created")).toBeEmpty();await page.locator("#record-choice-create").click();await expect(page.locator("#created")).toHaveText("New customer");await expect(page.locator('input[name="customerId"]')).toHaveValue("row-60");
});
