import { test, expect, type Page } from "@playwright/test";
import { authenticatedSmokeEnabled, loginAsOwner } from "./helpers/auth";

test.use({browserName:"chromium",trace:"off"});
const local=(value:string|undefined)=>!!value&&["localhost","127.0.0.1"].includes(new URL(value).hostname);
test.skip(!local(process.env.E2E_BASE_URL)||!authenticatedSmokeEnabled(),"Requires local authenticated fixtures.");
async function login(page:Page,industry:string){
 if(industry!=="pet_care")return loginAsOwner(page,industry as "salon"|"automotive");
 await page.goto("/login");await page.locator("#negosu-login-email-input").fill(process.env.QA_PET_OWNER_EMAIL!);await page.locator("#negosu-login-password-input").fill(process.env.QA_OWNER_PASSWORD!);await page.locator("#negosu-login-submit-button").click();await expect(page.locator("#pet-care-dashboard")).toBeVisible();
}
for(const industry of ["automotive","salon","pet_care"]){
 test(`${industry}: shared list layouts, tabs and record navigation`,async({page},info)=>{
  test.setTimeout(240000);await login(page,industry);
  const salon=industry==="salon",serviceBusiness=industry!=="automotive";
  const routes=[
   {path:"inventory",root:serviceBusiness?"salon-inventory-page":"inventory-page",tabs:serviceBusiness?"salon-inventory-tabs":"inventory-tabs"},
   {path:"services",root:salon?"salon-treatments-page":"services-page",tabs:"service-catalog-sections"},
   {path:"bookings",root:"booking-requests-page",tabs:"booking-requests-tabs"},
   {path:"settings/staff",root:salon?"salon-staff-page":"staff-page",tabs:salon?"salon-staff-tabs":"staff-tabs"},
   {path:"customers",root:serviceBusiness?"salon-clients-page":"customers-page",tabs:"customers-tabs"},
   {path:"settings/resources",root:serviceBusiness?"salon-resources-page":"scheduling-resources-page",tabs:"resources-tabs"},
   {path:"settings/branches",root:"branches-page",tabs:"branches-tabs"},
   ...(industry==="pet_care"?[
    {path:"pet-care/pets",root:"pets-page",tabs:"pets-tabs"},
    {path:"pet-care/appointments",root:"pet-care-appointments",tabs:"pet-appointment-tabs"},
   ]:[{path:"appointments",root:salon?"salon-appointments-page":"appointments-page",tabs:"appointment-range-tabs"}]),
   ...(industry==="automotive"?[
    {path:"vehicles",root:"vehicles-page",tabs:"vehicles-tabs"},
    {path:"jobs",root:"job-orders-page",tabs:"job-orders-tabs"},
    {path:"my-work",root:"technician-my-work-page",tabs:"technician-work-tabs"},
    {path:"reminders",root:"vehicle-maintenance-page",tabs:"maintenance-tabs"},
   ]:[]),
  ];
  for(const route of routes){
   const response=await page.goto(`/dashboard/${route.path}`);expect(response?.status()).toBe(200);await expect(page.locator(`#${route.root}`)).toBeVisible();await expect(page.locator(`#${route.tabs}`)).toBeVisible();
   await expect(page.getByText(/^(Could not load|Unable to load|Some .* could not be loaded)/)).toHaveCount(0);
   for(const width of [320,768,1024,1440]){
    await page.setViewportSize({width,height:900});
    expect(await page.locator("#dashboard-main-content").evaluate(el=>el.scrollWidth<=el.clientWidth+1),`${route.path} overflows at ${width}`).toBe(true);
    for(const table of await page.locator(`#${route.root} table:visible`).all())expect(await table.evaluate(el=>el.scrollWidth<=el.clientWidth+1),`${route.path} table overflows at ${width}`).toBe(true);
    if([320,1440].includes(width)&&["inventory","services","bookings","settings/staff","my-work"].includes(route.path))await page.screenshot({path:info.outputPath(`${route.path.replaceAll("/","-")}-${width}.png`)});
   }
   const second=page.locator(`#${route.tabs} a`).nth(1);const secondId=await second.getAttribute("id");await second.click();await expect(page.locator(`#${secondId}`)).toHaveAttribute("aria-current","page",{timeout:15000});
   await page.setViewportSize({width:320,height:900});expect(await page.locator("#dashboard-main-content").evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  }
  if(industry==="automotive") {
   await page.goto("/dashboard/my-work?tab=history");await expect(page.locator("#technician-work-history-table")).toBeVisible();await expect(page.locator("#technician-work-tabs-history")).toHaveAttribute("aria-current","page");
  }
  await page.goto("/dashboard/bookings?status=confirmed");await expect(page.locator("#booking-requests-table")).toBeVisible();
  const request=page.locator("#booking-requests-table a[data-record-link]").first();
  if(await request.count()) {await request.click();await expect(page.locator("#booking-request-details-dialog")).toBeVisible();await expect(page.locator('[id^="booking-request-confirm-form-"]')).toHaveCount(0);await page.locator("#booking-request-details-dialog-close-button").click();await expect(page).toHaveURL(/bookings\?status=confirmed$/);}
  // Inventory row selection opens details; actions still open the movement form independently.
  await page.goto("/dashboard/inventory");const prefix=serviceBusiness?"salon-inventory":"inventory";
  const row=page.locator(`#${prefix}-table tbody tr`).first();
  if(await row.count()){
   await row.locator("td").first().click({position:{x:10,y:10}});await expect(page.locator(`#${prefix}-details-dialog`)).toBeVisible();
   await page.locator(`#${prefix}-details-dialog-close-button`).click();await expect(page.locator("dialog")).toHaveCount(0);
   await row.getByRole("link",{name:"Record movement",exact:true}).click();await expect(page.locator(`#${prefix}-movement-dialog`)).toBeVisible();
   await page.getByRole("link",{name:"Cancel",exact:true}).click();await expect(page.locator("dialog")).toHaveCount(0);
  }
  await page.goto("/dashboard/services");const service=page.locator('table a[data-record-link]').first();
  if(await service.count()){const href=await service.getAttribute("href");await service.click();await expect(page).toHaveURL(new RegExp(`${href}$`));await page.goBack();}
  await page.goto("/dashboard/settings/staff");const staffPrefix=salon?"salon-staff":"staff";
  const edit=page.locator(`[id^="${staffPrefix}-edit-"]`).first();if(await edit.count()){
   await edit.click();await expect(page.locator(`#${staffPrefix}-edit-dialog`)).toBeVisible();await page.getByRole("link",{name:"Cancel",exact:true}).click();await expect(page.locator("dialog")).toHaveCount(0);
  }
 });
}
