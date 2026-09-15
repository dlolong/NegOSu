import { selectRecord } from "./helpers/searchable-select";
import {test,expect,type Page} from "@playwright/test";
import {createClient} from "@supabase/supabase-js";

test.use({trace:"off"});
const local=["localhost","127.0.0.1"].includes(new URL(process.env.E2E_BASE_URL??"http://localhost").hostname);
test.skip(!local||!process.env.QA_PET_OWNER_EMAIL||!process.env.QA_OWNER_PASSWORD,"Requires local Pet Care fixtures.");
async function login(page:Page,email=process.env.QA_PET_OWNER_EMAIL!) {
 await page.goto("/login?industry=pet_care");
 await page.locator("#negosu-login-email-input").fill(email);
 await page.locator("#negosu-login-password-input").fill(process.env.QA_OWNER_PASSWORD!);
 await page.locator("#negosu-login-submit-button").click();
}
async function checkLayout(page:Page) {
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
}
test("public grooming request becomes a staffed visit with private notes and payment",async({page,browser})=>{
 test.setTimeout(150000);
 const name=`Release Pet ${Date.now()}`;
 const day=new Date();day.setUTCDate(day.getUTCDate()+8);const date=day.toISOString().slice(0,10);
 for(const width of [320,1440]){await page.setViewportSize({width,height:900});await page.goto("/shop/negosu-pet-qa-1");await expect(page.locator("#public-pet-care-shop-page")).toBeVisible();await expect(page.locator("#public-shop-header")).toContainText("Milo Grooming QA");await expect(page.locator('a[href*="/queue"]')).toHaveCount(0);await checkLayout(page);}
 await page.setViewportSize({width:390,height:844});
 await page.goto(`/shop/negosu-pet-qa-1/book?branch=7e130000-0000-4000-8000-000000000001&service=7e170000-0000-4000-8000-000000000001&date=${date}`);
 await expect(page.locator("#public-booking-pet-section")).toBeVisible();await expect(page.locator("#public-booking-vehicle-section")).toHaveCount(0);await checkLayout(page);
 await page.locator("#public-booking-name-input").fill("Release Owner QA");await page.locator("#public-booking-phone-input").fill("09171234567");await page.locator("#public-booking-pet-name").fill(name);await page.locator("#public-booking-pet-species").selectOption("dog");
 await page.locator("#public-booking-submit-button").click();await expect(page).toHaveURL(/\/booking\/[a-f0-9]{64}$/);const statusUrl=page.url();await checkLayout(page);
 const ownerContext=await browser.newContext({baseURL:process.env.E2E_BASE_URL,viewport:{width:390,height:844}});const owner=await ownerContext.newPage();await login(owner);await expect(owner.locator("#pet-care-dashboard")).toBeVisible();
 await owner.goto("/dashboard/bookings");const card=owner.locator('[id^="booking-request-card-"]').filter({hasText:name});await expect(card).toBeVisible();await checkLayout(owner);
 const requestId=(await card.getAttribute("id"))!.replace("booking-request-card-","");await card.locator("a[data-record-link]").click();await expect(owner.locator("#booking-request-details-dialog")).toBeVisible();await selectRecord(owner,`pet-request-staff-${requestId}`,{name:"Bo QA"});await selectRecord(owner,`pet-request-resource-${requestId}`,{name:"Grooming Table 2"});await owner.locator("#booking-request-details-dialog").getByRole("button",{name:"Confirm and create appointment"}).click();await expect(owner.getByText("Booking confirmed.",{exact:true})).toBeVisible();
 await page.goto(statusUrl);await expect(page.getByText("Confirmed",{exact:true})).toBeVisible();
 await owner.goto(`/dashboard/pet-care/appointments?q=${encodeURIComponent(name)}`);const visit=owner.locator('#pet-appointment-list a').filter({hasText:name});await expect(visit).toHaveCount(1);await visit.click();await expect(owner.locator("#pet-appointment-detail")).toBeVisible();
 await owner.locator("#pet-arrive-button").click();await owner.locator("#pet-grooming-note-add-button").click();await owner.locator("#pet-grooming-note-input").fill("Internal release grooming observation");await owner.locator("#pet-grooming-next-visit").fill(date);await owner.locator("#pet-grooming-note-save").click();await expect(owner.locator("#pet-grooming-notes article")).toContainText("Internal release grooming observation");
 await owner.locator("#pet-record-payment-toggle").click();await owner.locator("#pet-payment-amount").fill("500");await owner.locator("#pet-payment-reference").fill(name);await owner.locator("#pet-payment-save").click();await expect(owner.locator("#pet-payment-summary")).toContainText("paid");
 for(const action of ["start","finish","ready-for-pickup","collected"])await owner.locator(`#pet-${action}-button`).click();
 await expect(owner.locator("#pet-appointment-header")).toContainText("Collected");await checkLayout(owner);
 await owner.locator("#pet-appointment-profile-link").click();await owner.locator("#pet-tab-history").click();await expect(owner.locator("#pet-history-notes")).toContainText("Internal release grooming observation");
 await owner.locator("#pet-owner-profile-link").click();await expect(owner.locator("#customer-pets")).toContainText(name);await owner.locator("#customer-book-appointment-button").click();await expect(owner.locator("#pet-appointment-dialog")).toBeVisible();await owner.locator("#pet-appointment-actions").getByRole("link",{name:"Cancel"}).click();
 await owner.goto("/dashboard/pet-care/payments?tab=history");await expect(owner.locator("#pet-payments-list")).toContainText(name);await checkLayout(owner);
 await page.goto(statusUrl);await expect(page.getByText("Internal release grooming observation")).toHaveCount(0);await ownerContext.close();
});
test("new Pet Care business completes normal first-business and branch onboarding",async({page})=>{
 test.setTimeout(120000);
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL!;test.skip(!["127.0.0.1","localhost"].includes(new URL(url).hostname),"Local auth only");
 const admin=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});
 const email=`pet-signup-${Date.now()}@example.test`;
 const created=await admin.auth.admin.createUser({email,password:process.env.QA_OWNER_PASSWORD!,email_confirm:true,user_metadata:{preferred_industry:"pet_care",full_name:"Pet Signup QA"}});expect(created.error).toBeNull();
 await page.setViewportSize({width:375,height:812});await login(page,email);await expect(page.locator("#negosu-onboarding-business-page")).toBeVisible();
 await page.locator('input[name="industry"][value="pet_care"]').check({force:true});
 await page.locator('select[name="businessType"]').selectOption("pet_grooming");await page.locator('input[name="businessName"]').fill(`Release Grooming ${Date.now()}`);await checkLayout(page);
 await page.locator("#negosu-business-submit-button").click();await expect(page.locator("#negosu-onboarding-branch-page")).toBeVisible();
 await page.locator("#negosu-branch-address-input").fill("Test Street 123");await page.locator("#negosu-branch-city-input").fill("Test City");await page.locator("#negosu-branch-province-input").fill("Test Province");await page.locator("#negosu-branch-submit-button").click();
 await expect(page.locator("#negosu-onboarding-page")).toBeVisible();await expect(page.getByRole("heading",{name:"Grooming services",exact:true})).toBeVisible();await page.goto("/dashboard");await expect(page.locator("#pet-care-dashboard")).toBeVisible();await checkLayout(page);
 const {data:membership}=await admin.from("organization_memberships").select("organization_id,organizations(industry,pet_care_pilot_enabled)").eq("user_id",created.data.user!.id).single();expect(membership).toBeTruthy();const organization=Array.isArray(membership?.organizations)?membership.organizations[0]:membership?.organizations;expect(organization?.industry).toBe("pet_care");expect(organization?.pet_care_pilot_enabled).toBe(false);
});
