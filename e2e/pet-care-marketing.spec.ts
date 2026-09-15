import { expect, test } from "@playwright/test";

for (const [width,height] of [[320,740],[375,812],[390,844],[430,932],[768,1024],[1024,768],[1366,768],[1440,900]]) {
 test(`Pet Care public pages ${width}x${height}`, async({page})=>{
  test.setTimeout(90000);await page.setViewportSize({width,height});
  for(const [route,root] of [["/","negosu-home-page"],["/pet-care","negosu-pet-care-page"],["/plans","negosu-plans-page"],["/automotive","negosu-automotive-page"],["/salon","negosu-salon-page"]]){
   const response=await page.goto(route);expect(response?.status()).toBe(200);await expect(page.locator(`#${root}`)).toBeVisible();
   const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,duplicates:Array.from(document.querySelectorAll("[id]")).map(e=>e.id).filter((id,i,ids)=>ids.indexOf(id)!==i)}));expect(layout,route).toEqual({overflow:false,duplicates:[]});
   await expect(page.locator("#negosu-footer-pet-care-link")).toHaveAttribute("href","/pet-care");
   if(width<1024){await page.locator("#negosu-mobile-menu-button").click();await expect(page.locator("#negosu-mobile-pet-care-link")).toBeVisible();await page.locator("#negosu-mobile-menu-button").click();}else await expect(page.locator("#negosu-desktop-pet-care-link")).toBeVisible();
  }
  await page.goto("/");await page.locator("#negosu-explore-pet-care-link").click();await expect(page).toHaveURL(/\/pet-care$/);
  await expect(page.locator("#negosu-pet-care-hero")).toContainText("Start with a free account");
  await expect(page.locator("#negosu-pet-care-create-account-button")).toHaveAttribute("href","/signup?industry=pet_care");
  await expect(page.locator("#negosu-pet-care-start-free-button")).toHaveAttribute("href","/signup?industry=pet_care");
  await page.locator("#negosu-pet-care-sign-in-link").click();await expect(page.locator("#negosu-login-page")).toBeVisible();
 });
}
test("public Pet marketing opens standard signup without adding a plan",async({page,request})=>{
 await page.goto("/signup?industry=pet_care");await expect(page.locator("#negosu-signup-page")).toBeVisible();

 await expect(page.locator('input[name="industry"][value="pet_care"]')).toBeChecked();
 const sitemap=await request.get("/sitemap.xml");expect(sitemap.status()).toBe(200);expect(await sitemap.text()).toContain("/pet-care</loc>");
 await page.goto("/plans");await expect(page.locator("#negosu-plans-pet-care-note")).toContainText("Public pages and reminders follow your selected plan");
});
