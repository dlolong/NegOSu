import {test,expect,type Page} from "@playwright/test";
import {createClient} from "@supabase/supabase-js";
import {loginAsOwner,authenticatedSmokeEnabled} from "./helpers/auth";
import {qaAppointmentStart} from "./helpers/scheduling";
import {selectRecord} from "./helpers/searchable-select";
test.use({trace:"off"});
const local=["localhost","127.0.0.1"].includes(new URL(process.env.E2E_BASE_URL??"http://localhost").hostname);
const localDatabase=["localhost","127.0.0.1"].includes(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL??"https://unconfigured.invalid").hostname);
test.skip(!local||!localDatabase||!authenticatedSmokeEnabled(),"Requires local authenticated fixtures and local Supabase.");
async function layout(page:Page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}
async function offer(page:Page,id:string,name:string){await page.locator(`#${id}`).fill(name);await page.locator(`#${id}-create`).click();}

test("appointment search creates confirmed records, preserves cancelled drafts, and saves an editable visit",async({page})=>{
 test.setTimeout(150000);await page.setViewportSize({width:390,height:844});await loginAsOwner(page,"salon");
 await page.goto("/dashboard/appointments/new");const prefix="salon-appointment",unique=Date.now(),customer=`Search Client ${unique}`,service=`Search Treatment ${unique}`,category=`Search Category ${unique}`;
 const starts=await qaAppointmentStart("salon",24);
 await page.locator(`#${prefix}-starts-at-input`).fill(starts);await page.locator(`#${prefix}-internal-notes-input`).fill("Keep this appointment draft");
 await offer(page,`${prefix}-client-select`,customer);await expect(page.locator(`#${prefix}-quick-client-details`)).toContainText("Add this record to your database?");
 await page.locator(`#${prefix}-quick-client-cancel-button`).click();await expect(page.locator(`#${prefix}-starts-at-input`)).toHaveValue(starts);
 await offer(page,`${prefix}-client-select`,customer);await page.locator(`#${prefix}-quick-client-save-button`).click();await expect(page.locator(`#${prefix}-client-select`)).toHaveValue(customer);
 await offer(page,`${prefix}-service-select`,service);await page.locator(`#${prefix}-new-service-price`).fill("275.50");await page.locator(`#${prefix}-new-service-duration`).fill("30");
 await offer(page,`${prefix}-new-service-category`,category);await page.locator(`#${prefix}-new-service-category-new-actions-cancel-button`).click();await expect(page.locator(`#${prefix}-new-service-name`)).toHaveValue(service);await expect(page.locator(`#${prefix}-new-service-price`)).toHaveValue("275.50");
 await offer(page,`${prefix}-new-service-category`,category);await page.locator(`#${prefix}-new-service-category-new-save`).click();await expect(page.locator(`#${prefix}-new-service-category`)).toHaveValue(category);
 await page.locator(`#${prefix}-new-service-save`).click();await expect(page.locator(`#${prefix}-selected-services`)).toContainText(service);await expect(page.locator(`#${prefix}-internal-notes-input`)).toHaveValue("Keep this appointment draft");
 await page.locator(`#${prefix}-service-select`).fill(category);await expect(page.locator(`#${prefix}-service-select-options`)).toContainText(service);await page.keyboard.press("ArrowDown");await page.keyboard.press("Enter");await expect(page.locator('input[name="serviceIds"]')).toHaveCount(1);
 // Cancelling another inline creation must retain the selected service and time.
 const discarded=`Discarded Treatment ${unique}`;await offer(page,`${prefix}-service-select`,discarded);await page.locator(`#${prefix}-new-service-actions-cancel-button`).click();await expect(page.locator(`#${prefix}-selected-services`)).toContainText(service);
 await page.locator(`#${prefix}-allow-conflict-checkbox`).check();await layout(page);await page.locator(`#${prefix}-save-button`).click();await expect(page).toHaveURL(/\/dashboard\/appointments\/[a-f0-9-]+(?:\?|$)/);await expect(page.locator("main").first()).toContainText(service);
 const url=new URL(page.url());await page.goto(`${url.pathname}/edit`);await expect(page.locator(`#${prefix}-client-select`)).toHaveValue(customer);await expect(page.locator(`#${prefix}-selected-services`)).toContainText(service);await expect(page.locator(`#${prefix}-internal-notes-input`)).toHaveValue("Keep this appointment draft");await page.locator(`#${prefix}-cancel-button`).click();await expect(page).toHaveURL(new RegExp(`${url.pathname}$`));
 const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});const result=await admin.from("services").select("id").eq("name",discarded);expect(result.error).toBeNull();expect(result.data).toEqual([]);
 await page.locator("#salon-appointment-cancel-button").click();await expect(page.locator("#salon-appointment-cancel-button")).toHaveCount(0);
});

test("Pet appointment can create its owner and pet without leaving the draft",async({page})=>{
 test.setTimeout(90000);test.skip(!process.env.QA_PET_OWNER_EMAIL,"Requires Pet fixtures");
 await page.setViewportSize({width:320,height:740});await page.goto("/login?industry=pet_care");await page.locator("#negosu-login-email-input").fill(process.env.QA_PET_OWNER_EMAIL!);await page.locator("#negosu-login-password-input").fill(process.env.QA_OWNER_PASSWORD!);await page.locator("#negosu-login-submit-button").click();await expect(page.locator("#pet-care-dashboard")).toBeVisible();
 await page.goto("/dashboard/pet-care/appointments?dialog=create");const name=`Search Pet ${Date.now()}`,owner=`Search Owner ${Date.now()}`;
 await page.locator("#pet-appointment-time-input").fill("2026-11-20T10:00");await offer(page,"pet-appointment-pet-select",name);await offer(page,"pet-appointment-owner-select",owner);await page.locator("#pet-appointment-quick-owner-save-button").click();await expect(page.locator("#pet-appointment-owner-select")).toHaveValue(owner);
 await page.locator("#pet-appointment-new-pet-save").click();await expect(page.locator("#pet-appointment-pet-select")).toHaveValue(`${name} · ${owner}`);await expect(page.locator("#pet-appointment-time-input")).toHaveValue("2026-11-20T10:00");
 await selectRecord(page,"pet-appointment-service-select",{name:"Bath and brush"});await selectRecord(page,"pet-appointment-service-select",{name:"Nail trim"});await expect(page.locator('input[name="serviceIds"]')).toHaveCount(2);await layout(page);
 await page.locator("#pet-appointment-actions").getByRole("link",{name:"Cancel"}).click();await expect(page.locator("#pet-appointment-dialog")).toHaveCount(0);
});

test("search keyboard navigation, clear, escape and missing required selection",async({page})=>{
 await loginAsOwner(page,"salon");await page.goto("/dashboard/appointments/new");const input=page.locator("#salon-appointment-client-select");await input.click();await expect(page.locator("#salon-appointment-client-select-options").getByRole("option").first()).toBeVisible();await input.press("ArrowDown");await input.press("Enter");await expect(input).not.toHaveValue("");await page.locator("#salon-appointment-client-select-clear").click();await expect(input).toHaveValue("");await input.fill("Unselected text must not become a customer");await input.press("Escape");await expect(page.locator("#salon-appointment-create-dialog")).toBeVisible();await expect(page.locator('input[name="customerId"]')).toHaveValue("");await page.locator("#salon-appointment-save-button").click();await expect(page).toHaveURL(/\/appointments\/new$/);
 for(const width of [320,375,1440]){await page.setViewportSize({width,height:900});await input.fill("LongCustomerName".repeat(8));await expect(page.locator("#salon-appointment-client-select-create")).toBeVisible();await layout(page);await input.press("Escape");}
});

test("authenticated catalog writes retain tenant isolation and concurrent retry safety",async()=>{
 test.skip(!process.env.QA_PET_OWNER_EMAIL||!process.env.QA_PET_OTHER_EMAIL,"Requires two local Pet tenants");
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL!;expect(["127.0.0.1","localhost"]).toContain(new URL(url).hostname);
 const {createQuickCategory,createQuickService}=await import("../lib/quick-catalog");const {searchRecords}=await import("../lib/record-lookup");
 const connect=async(email:string)=>{const db=createClient(url,(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY??process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,{auth:{persistSession:false}});const auth=await db.auth.signInWithPassword({email,password:process.env.QA_OWNER_PASSWORD!});expect(auth.error).toBeNull();const member=await db.from("organization_memberships").select("organization_id,role,organizations(currency)").eq("user_id",auth.data.user!.id).single();expect(member.error).toBeNull();return {db,actor:{organizationId:member.data!.organization_id,role:member.data!.role,currency:(member.data!.organizations as unknown as {currency:string}).currency,industry:"pet_care"}};};
 const [a,b]=await Promise.all([connect(process.env.QA_PET_OWNER_EMAIL!),connect(process.env.QA_PET_OTHER_EMAIL!)]);const prefix=`Scoped Category ${Date.now()}`,ownInput={requestId:crypto.randomUUID(),name:`${prefix} own`};
 const own=await Promise.all([createQuickCategory(ownInput,a.actor,a.db),createQuickCategory(ownInput,a.actor,a.db)]);expect(own.map(result=>result.data?.id)).toEqual([ownInput.requestId,ownInput.requestId]);
 const foreign=await createQuickCategory({requestId:crypto.randomUUID(),name:`${prefix} foreign`},b.actor,b.db);expect(foreign.error).toBeUndefined();
 const found=await searchRecords({kind:"category",query:prefix,organizationId:b.actor.organizationId},a.actor,a.db);expect(found.data?.map(row=>row.id)).toEqual([ownInput.requestId]);
 const service={requestId:crypto.randomUUID(),name:`Scoped Service ${Date.now()}`,basePrice:"100.50",durationMinutes:30,categoryId:foreign.data!.id};expect((await createQuickService(service,a.actor,a.db)).error).toContain("active category");
 expect((await a.db.from("services").select("id").eq("id",service.requestId)).data).toEqual([]);
 const allowed={...service,categoryId:ownInput.requestId};const retried=await Promise.all([createQuickService(allowed,a.actor,a.db),createQuickService(allowed,a.actor,a.db)]);expect(retried.map(result=>result.data?.id)).toEqual([service.requestId,service.requestId]);
 expect((await createQuickCategory({requestId:crypto.randomUUID(),name:`Forbidden ${Date.now()}`},b.actor,a.db)).error).toBeTruthy();
 await Promise.all([a.db.auth.signOut({scope:"local"}),b.db.auth.signOut({scope:"local"})]);
});
