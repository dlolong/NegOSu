import { selectRecord } from "./helpers/searchable-select";
import { test, expect, type Page } from "@playwright/test";

test.use({trace:"off"});
const localTarget=["127.0.0.1","localhost","::1"].includes(new URL(process.env.E2E_BASE_URL??"http://127.0.0.1:3100").hostname);
test.skip(!localTarget,"Pet Care mutation fixtures are local-only.");
test.skip(!process.env.QA_PET_OWNER_EMAIL || !process.env.QA_OWNER_PASSWORD, "Requires the protected local Pet QA seed credentials.");
async function login(page:Page) {
 await page.goto("/login");
 await page.locator("#negosu-login-email-input").fill(process.env.QA_PET_OWNER_EMAIL!);
 await page.locator("#negosu-login-password-input").fill(process.env.QA_OWNER_PASSWORD!);
 await page.locator("#negosu-login-submit-button").click();
 await expect(page.locator("#pet-care-dashboard")).toBeVisible({timeout:30000});
}
async function layout(page:Page) {
 const result=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,duplicates:Array.from(document.querySelectorAll("[id]")).map(e=>e.id).filter((id,i,all)=>all.indexOf(id)!==i)}));
 if(result.overflow) console.log("Overflow", new URL(page.url()).pathname.startsWith("/appointment/")?"private appointment":new URL(page.url()).pathname,await page.evaluate(()=>Array.from(document.querySelectorAll("main *")).filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,8).map(e=>({tag:e.tagName,id:e.id,classes:e.className}))));
 expect(result).toEqual({overflow:false,duplicates:[]});
}
for (const [width,height] of [[320,740],[375,812],[390,844],[430,932],[1366,768],[1440,900]]) {
 test(`Pet navigation and dialogs ${width}x${height}`,async({page})=>{
  test.setTimeout(120000);await page.setViewportSize({width,height});await login(page);
  for(const route of ["/dashboard/pet-care","/dashboard/pet-care/pets","/dashboard/pet-care/appointments","/dashboard/pet-care/payments","/dashboard/bookings","/dashboard/settings/public-page","/dashboard/customers","/dashboard/services","/dashboard/settings/staff","/dashboard/inventory","/dashboard/settings/resources","/onboarding/setup"]){
   const response=await page.goto(route);expect(response?.status()).toBeLessThan(400);
   const roots:Record<string,string>={"/dashboard/pet-care":"pet-care-dashboard","/dashboard/pet-care/pets":"pets-page","/dashboard/pet-care/appointments":"pet-care-appointments","/dashboard/pet-care/payments":"pet-payments-page","/dashboard/bookings":"booking-requests-page","/dashboard/settings/public-page":"public-page-settings-page","/dashboard/customers":"salon-clients-page","/dashboard/services":"services-page","/dashboard/settings/staff":"staff-page","/dashboard/inventory":"salon-inventory-page","/dashboard/settings/resources":"salon-resources-page","/onboarding/setup":"negosu-onboarding-page"};
   await expect(page.locator(`#${roots[route]}`)).toBeVisible();await layout(page);
   await expect(page.getByText(/^Unable to load/)).toHaveCount(0);
   if(route==="/dashboard/pet-care")await expect(page.locator("#pet-care-finance")).toContainText("Payments Collected Today");
  }
  await page.goto("/dashboard/pet-care/pets?dialog=create");await expect(page.locator("#pet-form-dialog")).toBeVisible();await layout(page);
  await page.locator("#pet-name-input").fill("Cancel must not save");
  await page.locator("#pet-form-actions").getByRole("link",{name:"Cancel"}).click();
  await expect(page.locator("#pet-form-dialog")).toHaveCount(0);await expect(page.getByText("Cancel must not save",{exact:true})).toHaveCount(0);
  await page.goto("/dashboard/pet-care/appointments?dialog=create");await expect(page.locator("#pet-appointment-dialog")).toBeVisible();await layout(page);
  await page.keyboard.press("Escape");await expect(page.locator("#pet-appointment-dialog")).toHaveCount(0);
  await page.screenshot({path:`/private/tmp/negosu-pet-release/pet-${width}.png`,fullPage:true});
 });
}
test("owner and customer booking through payment and collection",async({page,browser})=>{
 test.setTimeout(150000);await page.setViewportSize({width:390,height:844});await login(page);
 await page.goto("/dashboard/pet-care/pets?dialog=create");
 const name=`Browser QA ${Date.now()}`;
 await selectRecord(page,"pet-owner-select",{name:"Maria QA"});await page.locator("#pet-name-input").fill(name);
 await page.locator("#pet-save-button").click();await expect(page.locator("#pet-detail-page")).toBeVisible();
 await page.locator("#pet-detail-edit-button").click();await page.locator("#pet-breed-input").fill("QA breed");await page.locator("#pet-save-button").click();await expect(page.locator("#pet-detail-header")).toContainText("QA breed");
 await page.goto("/dashboard/pet-care/appointments?dialog=create");await selectRecord(page,"pet-appointment-pet-select",{name:`${name} · Maria QA`});
 const day=new Date();day.setUTCDate(day.getUTCDate()+11);const date=day.toISOString().slice(0,10);
 await page.locator("#pet-appointment-time-input").fill(`${date}T15:00`);await selectRecord(page,"pet-appointment-service-select",{name:"Bath and brush"});await selectRecord(page,"pet-appointment-staff-select",{name:"Ana QA"});await selectRecord(page,"pet-appointment-resource-select",{name:"Grooming Table 1"});
 await page.locator("#pet-appointment-save-button").click();await expect(page.locator("#pet-appointment-detail")).toBeVisible();const internal=page.url();await layout(page);
 await page.locator("#pet-create-link-button").click();await expect(page.locator("#pet-customer-link")).toBeVisible();const link=await page.locator("#pet-customer-link").getAttribute("href");expect(link).toBeTruthy();
 const guestContext=await browser.newContext({baseURL:process.env.E2E_BASE_URL});const guest=await guestContext.newPage();
 for(const [width,height] of [[320,740],[375,812],[390,844],[430,932],[1366,768],[1440,900]]){await guest.setViewportSize({width,height});const response=await guest.goto(link!);expect(response?.status()).toBe(200);await expect(guest.getByText(name,{exact:false})).toBeVisible();await layout(guest);await expect(guest.getByText(/Owner-reported QA note/)).toHaveCount(0);}
 await guest.getByRole("button",{name:/Confirm appointment/i}).click();await expect(guest.getByText("Your appointment is confirmed.")).toBeVisible();
 await guest.locator('input[name="startsAt"]').fill(`${date}T16:00`);await guest.getByRole("button",{name:/Reschedule/i}).click();await expect(guest.getByText("Your appointment has been rescheduled.")).toBeVisible();await guestContext.close();
 await page.goto(internal);
 await page.locator("#pet-appointment-reschedule-button").click();await page.locator("#pet-reschedule-time").fill(`${date}T17:00`);await page.locator("#pet-reschedule-save").click();await expect(page.locator("#pet-reschedule-dialog")).toHaveCount(0);
 for(const action of ["arrive","start","finish","ready-for-pickup"]){await page.locator(`#pet-${action}-button`).click();}
 await expect(page.locator("#pet-collected-button")).toBeVisible();await page.locator("#pet-record-payment-toggle").click();await page.locator("#pet-payment-amount").fill("200");await page.locator("#pet-payment-save").click();await expect(page.locator("#pet-payment-summary")).toContainText("partial");
 await page.locator("#pet-collected-button").click();await expect(page.locator("#pet-appointment-header")).toContainText("Collected");await expect(page.locator("#pet-payment-summary")).toContainText("partial");
});
