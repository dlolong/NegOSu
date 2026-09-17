import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { authenticatedSmokeEnabled } from "./helpers/auth";

const local=(value?:string)=>Boolean(value&&["localhost","127.0.0.1"].includes(new URL(value).hostname));
test.skip(!authenticatedSmokeEnabled()||!local(process.env.E2E_BASE_URL)||!local(process.env.NEXT_PUBLIC_SUPABASE_URL),"Requires local access matrix fixtures.");
test.use({trace:"off"});
const password=()=>process.env.QA_OWNER_PASSWORD!;
const client=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
const adminClient=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
async function login(page:Page,name:string) {
  await page.goto("/login");await page.locator("#negosu-login-email-input").fill(`qa.access.${name}@negosu.local.test`);await page.locator("#negosu-login-password-input").fill(password());await page.locator("#negosu-login-submit-button").click();
}
for(const industry of ["automotive","salon","pet_care","hospitality"] as const) {
  test(`${industry}: branch restriction, tenant reads, optional Staff contacts and real login`,async({page})=>{
    const db=client(),admin=adminClient();
    const auth=await db.auth.signInWithPassword({email:`qa.access.${industry}.manager@negosu.local.test`,password:password()});expect(auth.error).toBeNull();
    try {
      const membership=await db.from("organization_memberships").select("organization_id,id,role").eq("user_id",auth.data.user!.id).single();expect(membership.error).toBeNull();expect(membership.data!.role).toBe("manager");
      const own=await admin.from("organizations").select("name,branches(id,is_primary,name)").eq("id",membership.data!.organization_id).single();expect(own.error).toBeNull();
      const primary=own.data!.branches.find(row=>row.is_primary)!,annex=own.data!.branches.find(row=>row.name==="Access QA Annex")!;expect(annex).toBeTruthy();
      for(const [branch,expected] of [[primary.id,true],[annex.id,false]] as const){const access=await db.rpc("can_access_branch",{p_organization_id:membership.data!.organization_id,p_branch_id:branch});expect(access.error).toBeNull();expect(access.data).toBe(expected);}
      const other=await admin.from("organizations").select("id").eq("slug",`negosu-access-${industry.replaceAll("_","-")}-other`).single();expect(other.error).toBeNull();
      const foreign=await admin.from("customers").select("id").eq("organization_id",other.data!.id).single();expect(foreign.error).toBeNull();
      const hidden=await db.from("customers").select("id").eq("id",foreign.data!.id);expect(hidden.error).toBeNull();expect(hidden.data).toEqual([]);
      const profiles=await admin.from("organization_staff_profiles").select("full_name,membership_id,email,mobile").eq("organization_id",membership.data!.organization_id).like("full_name","QA Staff % contact");expect(profiles.error).toBeNull();expect(profiles.data).toHaveLength(4);
      for(const profile of profiles.data!){expect(profile.membership_id).toBeNull();const contact=profile.full_name.split(" ")[2];expect(Boolean(profile.email)).toBe(["email","both"].includes(contact));expect(Boolean(profile.mobile)).toBe(["mobile","both"].includes(contact));}
      await login(page,`${industry}.manager`);await expect(page.locator("#dashboard-app-shell")).toBeVisible();await expect(page.locator("#dashboard-app-shell")).toContainText(own.data!.name);
      const denied=await page.request.get(`/dashboard/branch-context?branch=${annex.id}&next=/dashboard`,{maxRedirects:0});expect(denied.status()).toBe(307);expect(new URL(denied.headers().location).searchParams.get("error")).toBe("You do not have access to that branch.");
      await page.goto(`/dashboard/customers/${foreign.data!.id}`);await expect(page.locator("#negosu-not-found-page")).toBeVisible();
      await page.context().clearCookies();await login(page,`${industry}.staff`);await expect(page.locator("#dashboard-app-shell")).toBeVisible();await expect(page.locator("#dashboard-app-shell")).toContainText(own.data!.name);
      const exportResponse=await page.request.get("/dashboard/reports/export?preset=month");expect(exportResponse.status()).toBe(403);
    }finally{await db.auth.signOut({scope:"local"});}
  });
}

test("unassigned account enters onboarding and multi-business account selects each authorized workspace",async({page})=>{
  await login(page,"unassigned");await expect(page.locator("#negosu-onboarding-business-form")).toBeVisible();
  await page.context().clearCookies();await login(page,"multi");await expect(page.locator("#negosu-business-selector")).toBeVisible();
  const admin=adminClient();const organizations=await admin.from("organizations").select("id,name").in("slug",["negosu-automotive-qa","negosu-salon-qa","negosu-pet-qa-1","qa-apartelle-inn"]);expect(organizations.error).toBeNull();expect(organizations.data).toHaveLength(4);
  for(const org of organizations.data!) {
    await page.goto("/organizations");await page.locator(`#negosu-business-option-${org.id}-select-button`).click();await expect(page.locator("#dashboard-app-shell")).toBeVisible();await expect(page.locator("#dashboard-app-shell")).toContainText(org.name);
    await page.reload();await expect(page.locator("#dashboard-app-shell")).toContainText(org.name);
  }
});
