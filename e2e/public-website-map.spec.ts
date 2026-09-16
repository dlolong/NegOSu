import {test,expect} from "@playwright/test";
import {createClient} from "@supabase/supabase-js";
import {authenticatedSmokeEnabled,loginAsOwner,qaPersonaCredentials} from "./helpers/auth";
import {mapEmbedUrl} from "../lib/location-map";
const local=(url?:string)=>!!url&&["127.0.0.1","localhost"].includes(new URL(url).hostname);
test.skip(!authenticatedSmokeEnabled()||!local(process.env.E2E_BASE_URL)||!local(process.env.NEXT_PUBLIC_SUPABASE_URL),"Requires isolated local fixtures.");
test.use({trace:"off"});
const embed="https://www.google.com/maps/embed?pb=!1m18!2m3!3d14.5995!4d120.9842";

for(const industry of ["automotive","salon","pet_care"] as const) {
 test(`${industry} website map settings save safely and public pages fit mobile and desktop`,async({page,context})=>{
  test.setTimeout(90000);
  // Test our embed contract without depending on Google's map tiles or consent UI.
  await context.route("https://www.google.com/maps/embed?*",route=>route.fulfill({contentType:"text/html",body:'<html><body style="margin:0;background:#e8eef0;display:grid;place-items:center;height:100vh;font:16px sans-serif">Location map preview</body></html>'}));
  const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false}});
  const credentials=industry==="pet_care"?{email:process.env.QA_PET_OWNER_EMAIL!,password:process.env.QA_OWNER_PASSWORD!}:qaPersonaCredentials(industry);
  const auth=await db.auth.signInWithPassword(credentials);expect(auth.error).toBeNull();
  const member=await db.from("organization_memberships").select("organization_id").eq("user_id",auth.data.user!.id).single();expect(member.error).toBeNull();
  const org=await admin.from("organizations").select("id,slug,name,public_page_enabled,phone,email").eq("id",member.data!.organization_id).single();expect(org.error).toBeNull();
  const branch=await admin.from("branches").select("id,name,map_url,opening_hours,public_description,accepts_public_bookings,phone,email").eq("organization_id",org.data!.id).eq("is_primary",true).single();expect(branch.error).toBeNull();
  const foreign=await admin.from("branches").select("id,map_url").neq("organization_id",org.data!.id).limit(1).single();expect(foreign.error).toBeNull();
  const service=await admin.from("services").select("id,is_public").eq("organization_id",org.data!.id).eq("is_active",true).limit(1).single();expect(service.error).toBeNull();
  const id=branch.data!.id;
  const root="/dashboard/settings/public-page";
  const website=`/shop/${org.data!.slug}`;
  try {
   if(industry==="pet_care") {await page.goto("/login?industry=pet_care");await page.locator("#negosu-login-email-input").fill(credentials.email);await page.locator("#negosu-login-password-input").fill(credentials.password);await page.locator("#negosu-login-submit-button").click();await expect(page.locator("#pet-care-dashboard")).toBeVisible();}
   else await loginAsOwner(page,industry);
   await page.goto(root);await page.locator("#public-page-enabled-checkbox").check();await page.locator("#public-page-save-button").click();await expect(page).toHaveURL(/message=/);
   expect((await admin.from("services").update({is_public:true}).eq("id",service.data!.id)).error).toBeNull();
   expect((await admin.from("branches").update({accepts_public_bookings:true}).eq("id",id)).error).toBeNull();
   expect((await admin.from("organizations").update({phone:"09171234567",email:"contact@example.test"}).eq("id",org.data!.id)).error).toBeNull();
   expect((await admin.from("branches").update({phone:"09179876543",email:"branch@example.test"}).eq("id",id)).error).toBeNull();
   for(const width of [320,1440]) {
    await page.setViewportSize({width,height:900});await page.goto(root);
    for(const tab of ["services","gallery","locations"]) {await page.locator(`#website-settings-tabs-${tab}`).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}
    await page.locator(`#website-location-edit-${id}`).click();
    await expect.poll(()=>page.locator("#dashboard-main-content").evaluate(element=>getComputedStyle(element).overflowY)).toBe("hidden");
    await page.locator(`#public-branch-map-url-input-${id}`).fill(`<iframe src="${embed}" onload="window.injected=true"></iframe>`);
    await expect(page.locator(`#public-branch-map-preview-${id}-frame`)).toHaveAttribute("src",mapEmbedUrl(embed)!);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.locator(`#public-branch-actions-${id}-cancel-button`).click();
    await expect(page.locator(`#website-location-dialog-${id}`)).toHaveCount(0);
    expect(await page.locator("#dashboard-main-content").evaluate(element=>getComputedStyle(element).overflowY)).toBe("auto");
    expect((await admin.from("branches").select("map_url").eq("id",id).single()).data?.map_url).toBe(branch.data!.map_url);
   }
   await page.locator(`#website-location-edit-${id}`).click();
   await page.locator(`#public-branch-map-url-input-${id}`).fill('<iframe src="https://evil.test/frame"></iframe>');
   await page.locator(`#public-branch-save-button-${id}`).click();
   await expect(page.locator(`#public-branch-form-${id}-error`)).toContainText(/valid map|Google Maps/i);
   await expect(page.locator(`#public-branch-map-url-input-${id}`)).toHaveValue(/evil.test/);
   await page.locator(`#public-branch-map-url-input-${id}`).fill(`<iframe src="${embed}" onload="alert('never')"></iframe>`);
   await page.locator(`#public-branch-form-${id} [name="branchId"]`).evaluate((element,value)=>{(element as HTMLInputElement).value=value;},foreign.data!.id);
   await page.locator(`#public-branch-save-button-${id}`).click();await expect(page.locator(`#public-branch-form-${id}-error`)).toBeVisible();
   expect((await admin.from("branches").select("map_url").eq("id",foreign.data!.id).single()).data?.map_url).toBe(foreign.data!.map_url);
   await page.locator(`#public-branch-form-${id} [name="branchId"]`).evaluate((element,value)=>{(element as HTMLInputElement).value=value;},id);
   await page.locator(`#public-branch-save-button-${id}`).click();await expect(page).toHaveURL(/tab=locations.*message=/);
   expect((await admin.from("branches").select("map_url").eq("id",id).single()).data?.map_url).toBe(mapEmbedUrl(embed));
   await page.screenshot({path:`/private/tmp/negosu-website-admin-${industry}.png`,fullPage:true});
   for(const width of [320,390,768,1440]) {
    await page.setViewportSize({width,height:900});await page.goto(website);
    await expect(page.locator("#public-shop-header")).toContainText(org.data!.name);
    await expect(page.locator(`#public-location-map-${id}-frame`)).toHaveAttribute("src",mapEmbedUrl(embed)!);
    await page.locator(`#public-location-map-${id}-frame`).scrollIntoViewIfNeeded();
    await expect(page.frameLocator(`#public-location-map-${id}-frame`).locator("body")).toContainText("Location map preview");
    await expect(page.locator(`#public-location-map-${id}-directions`)).toHaveAttribute("href",/^https:\/\//);
    await expect(page.locator('a[href*="/queue"]')).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await expect(page.locator("#public-contact-phone-business")).toHaveAttribute("href","tel:09171234567");
    await expect(page.locator("#public-contact-email-business")).toHaveAttribute("href","mailto:contact%40example.test");
    await expect(page.locator(`#public-contact-phone-${id}`)).toHaveAttribute("href","tel:09179876543");
    await expect(page.locator(`#public-contact-email-${id}`)).toHaveAttribute("href","mailto:branch%40example.test");
    if(width<640) {
     await expect(page.locator("#public-shop-section-navigation")).toBeHidden();
     await expect(page.locator("#public-shop-mobile-actions")).toBeVisible();
     await page.locator("#public-mobile-contact-button").click();
     await expect(page).toHaveURL(/#public-shop-contact$/);
     await expect(page.locator("#public-shop-header-book-button")).toBeHidden();
     await expect.poll(async()=> (await page.locator("#public-shop-contact-title").boundingBox())!.y).toBeLessThan(180);
     const header=await page.locator("#public-shop-header").boundingBox();
     const contact=await page.locator("#public-shop-contact-title").boundingBox();
     expect(header!.y).toBe(0);expect(contact!.y).toBeGreaterThanOrEqual(header!.height);
     await page.screenshot({path:`/private/tmp/negosu-contact-${industry}-${width}.png`});
     await page.locator("#public-mobile-services-button").click();await expect(page).toHaveURL(/#public-automotive-shop-services$/);
    } else {
     await expect(page.locator("#public-shop-section-navigation")).toBeVisible();
     await expect(page.locator("#public-shop-mobile-actions")).toBeHidden();
    }
    if(width===320){await expect(page.locator("#public-mobile-book-button")).toBeVisible();await page.locator("#public-mobile-location-button").click();await expect(page).toHaveURL(/#public-automotive-shop-branches$/);}
    if(width===320||width===1440) await page.screenshot({path:`/private/tmp/negosu-public-${industry}-${width}.png`,fullPage:true});
   }
   await page.setViewportSize({width:320,height:900});await page.goto(website);
   await page.locator("#public-mobile-book-button").click();await expect(page.locator("#public-booking-page")).toBeVisible();
   await expect(page.locator("#public-booking-availability-error")).toHaveCount(0);
   await expect(page.locator("#public-booking-location-map-frame")).toHaveAttribute("src",mapEmbedUrl(embed)!);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  } finally {
   const old=branch.data!;await admin.from("branches").update({map_url:old.map_url,opening_hours:old.opening_hours,public_description:old.public_description,accepts_public_bookings:old.accepts_public_bookings,phone:old.phone,email:old.email}).eq("id",id);
   await admin.from("organizations").update({public_page_enabled:org.data!.public_page_enabled,phone:org.data!.phone,email:org.data!.email}).eq("id",org.data!.id);
   await admin.from("services").update({is_public:service.data!.is_public}).eq("id",service.data!.id);
   await db.auth.signOut();
  }
 });
}
