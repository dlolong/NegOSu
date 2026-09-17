import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { authenticatedSmokeEnabled, loginAsOwner, qaPersonaCredentials } from "./helpers/auth";
import { loadPaymentWorkspace } from "../modules/core/payments/payment-workspace";

test.use({browserName:"chromium",trace:"off"});
const local=(value:string|undefined)=>!!value&&["localhost","127.0.0.1"].includes(new URL(value).hostname);
test.skip(!local(process.env.E2E_BASE_URL)||!local(process.env.NEXT_PUBLIC_SUPABASE_URL)||!authenticatedSmokeEnabled(),"Requires local authenticated QA fixtures.");
async function login(page:Page,industry:string){
 if(industry!=="pet_care")return loginAsOwner(page,industry as "salon"|"automotive");
 await page.goto("/login");await page.locator("#negosu-login-email-input").fill(process.env.QA_PET_OWNER_EMAIL!);await page.locator("#negosu-login-password-input").fill(process.env.QA_OWNER_PASSWORD!);await page.locator("#negosu-login-submit-button").click();await expect(page.locator("#pet-care-dashboard")).toBeVisible();
}
async function seedInvoice() {
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});
 const org=await db.from("organizations").select("id,branches(id,is_primary)").eq("slug","negosu-automotive-qa").single();expect(org.error).toBeNull();
 const branch=org.data!.branches.find(row=>row.is_primary)!.id;
 const vehicle=await db.from("vehicles").select("id,customer_id,customers(full_name)").eq("organization_id",org.data!.id).limit(1).single();expect(vehicle.error).toBeNull();
 const job=await db.from("job_orders").insert({organization_id:org.data!.id,branch_id:branch,customer_id:vehicle.data!.customer_id,vehicle_id:vehicle.data!.id}).select("id").single();expect(job.error).toBeNull();
 const invoice=await db.from("invoices").insert({organization_id:org.data!.id,branch_id:branch,job_order_id:job.data!.id,invoice_number:`CORE-${Date.now()}`,status:"issued",customer_name_snapshot:"Core Payment QA",vehicle_snapshot:"QA Vehicle",subtotal_centavos:10000,total_centavos:10000,balance_centavos:10000,issued_at:new Date().toISOString()}).select("id").single();expect(invoice.error).toBeNull();
 const item=await db.from("invoice_items").insert({organization_id:org.data!.id,invoice_id:invoice.data!.id,description_snapshot:"Core Payment QA",quantity:1,unit_price_centavos:10000,line_total_centavos:10000});expect(item.error).toBeNull();
}
async function seedSalonBalance() {
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});
 const org=await db.from("organizations").select("id,branches(id,is_primary)").eq("slug","negosu-salon-qa").single();expect(org.error).toBeNull();
 const customer=await db.from("customers").select("id").eq("organization_id",org.data!.id).limit(1).single();expect(customer.error).toBeNull();
 const start=new Date(Date.now()+86400000*60);
 const appointment=await db.from("appointments").insert({organization_id:org.data!.id,branch_id:org.data!.branches.find(row=>row.is_primary)!.id,customer_id:customer.data!.id,starts_at:start.toISOString(),ends_at:new Date(start.valueOf()+1800000).toISOString(),expected_total_centavos:10000}).select("id").single();
 expect(appointment.error).toBeNull();
}
async function checkLayout(page:Page){expect(await page.locator("#dashboard-main-content").evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);}
for(const industry of ["automotive","salon","pet_care"]){
 test(`${industry}: shared pages, payment collection, reports and export`,async({page},info)=>{
  test.setTimeout(150000);if(industry==="automotive")await seedInvoice();if(industry==="salon")await seedSalonBalance();await page.setViewportSize({width:1440,height:900});await login(page,industry);
  await expect(page.locator('#negosu-sidebar a[href="/dashboard/payments"]')).toBeVisible();
  const reportsGroup = page.locator("#negosu-sidebar details").filter({has:page.locator('a[href="/dashboard/reports"]')});
  if (!(await reportsGroup.evaluate(node => (node as HTMLDetailsElement).open))) await reportsGroup.locator("summary").click();
  await expect(page.locator('#negosu-sidebar a[href="/dashboard/reports"]')).toBeVisible();
  for(const path of ["customers","services","inventory","settings/staff","settings/branches","settings/resources","settings/public-page","settings/billing","bookings","payments"]){
   const roots:Record<string,string>={customers:industry==="automotive"?"customers-page":"salon-clients-page",services:industry==="salon"?"salon-treatments-page":"services-page",inventory:industry==="automotive"?"inventory-page":"salon-inventory-page","settings/staff":industry==="salon"?"salon-staff-page":"staff-page","settings/branches":"branches-page","settings/resources":industry==="automotive"?"scheduling-resources-page":"salon-resources-page","settings/public-page":"public-page-settings-page","settings/billing":"billing-page",bookings:"booking-requests-page",payments:"payments-page"};
   const response=await page.goto(`/dashboard/${path}`);expect(response?.status()).toBe(200);await expect(page.locator(`#${roots[path]}`)).toBeVisible();await expect(page.getByText(/^(Could not load|Unable to load|Payment information could not)/)).toHaveCount(0);
  }
  for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});await checkLayout(page);await page.screenshot({path:info.outputPath(`payments-${width}.png`)});}
  if(industry==="pet_care"){
   await page.goto("/dashboard/pet-care/payments");await expect(page.locator("#pet-payments-page")).toBeVisible();await expect(page.locator("#payments-load-error")).toHaveCount(0);await page.goto("/dashboard/pet-care");await expect(page.locator("#pet-care-finance [role=alert]")).toHaveCount(0);await page.goto("/dashboard/payments");
  }
  // Follow an outstanding record to its existing authoritative payment form.
  const first=page.locator('[id^="payments-document-"]').first();await expect(first).toBeVisible();await first.click();
  const reference=`Core parity ${industry} ${Date.now()}`;
  if(industry==="salon"){
   await page.locator("#salon-appointment-record-payment-button").click();await page.locator("#salon-appointment-payment-amount-input").fill("1.00");await page.locator("#salon-appointment-payment-reference-input").fill(reference);await page.locator("#salon-appointment-payment-save-button").click();await expect(page.locator("#salon-appointment-payment-dialog")).toHaveCount(0);
  } else if(industry==="pet_care"){
   await page.locator("#pet-record-payment-toggle").click();await page.locator("#pet-payment-amount").fill("1.00");await page.locator("#pet-payment-reference").fill(reference);await Promise.all([page.waitForResponse(response=>response.request().method()==="POST"&&response.url().includes("/dashboard/pet-care/appointments/")),page.locator("#pet-payment-save").click()]);
  } else {
   const form=page.locator('form:has(#record-payment-save-button)');await form.locator('input[name="amount"]').fill("1.00");await form.locator('input[name="reference"]').fill(reference);await page.locator("#record-payment-save-button").click();await expect(page).toHaveURL(/message=/);
  }
  await page.goto("/dashboard/payments");await page.locator("#payments-tab-history").click();await expect(page.locator("#payments-list")).toContainText(reference);await expect(page.locator("#payments-load-error")).toHaveCount(0);
  await page.goto("/dashboard/reports?preset=custom&start=2026-01-01&end=2026-12-31");await expect(page.locator("#reports-summary")).toBeVisible();await expect(page.locator("#reports-state")).toHaveCount(0);
  if(industry!=="automotive")await expect(page.locator("#reports-summary")).toContainText("Completed appointments");
  const csv=await page.request.get("/dashboard/reports/export?preset=custom&start=2026-01-01&end=2026-12-31");expect(csv.status()).toBe(200);expect(csv.headers()["content-type"]).toContain("text/csv");expect(await csv.text()).toContain(industry==="automotive"?"Completed jobs":"Completed appointments");
  for(const width of [320,1440]){await page.setViewportSize({width,height:900});await checkLayout(page);await page.screenshot({path:info.outputPath(`reports-${width}.png`)});}
 });
}

test("Core payment reads enforce tenant scope and role-specific financial pages",async({page})=>{
 test.setTimeout(90000);
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL!,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
 const db=createClient(url,key,{auth:{persistSession:false}}),admin=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});
 const auth=await db.auth.signInWithPassword(qaPersonaCredentials("salon"));expect(auth.error).toBeNull();
 const foreign=await admin.from("organizations").select("id,branches(id)").eq("slug","negosu-pet-qa-1").single();expect(foreign.error).toBeNull();
 const records=await loadPaymentWorkspace(db,foreign.data!.id,foreign.data!.branches[0].id,"appointment");expect(records.payments).toHaveLength(0);expect(records.documents).toHaveLength(0);
 const own=await db.from("organization_memberships").select("organization_id").eq("user_id",auth.data.user!.id).single();expect(own.error).toBeNull();
 await db.auth.signOut({scope:"local"});
 for(const role of ["cashier","viewer"]){
  const email=`parity-${role}-${crypto.randomUUID()}@local.test`,password=`Test-${crypto.randomUUID()}!`;
  const user=await admin.auth.admin.createUser({email,password,email_confirm:true});expect(user.error).toBeNull();
  try{
   const membership=await admin.from("organization_memberships").insert({organization_id:own.data!.organization_id,user_id:user.data.user!.id,role,is_active:true});expect(membership.error).toBeNull();
   await page.context().clearCookies();await page.goto("/login");await page.locator("#negosu-login-email-input").fill(email);await page.locator("#negosu-login-password-input").fill(password);await page.locator("#negosu-login-submit-button").click();await expect(page.locator("#dashboard-app-shell")).toBeVisible();
   await page.goto("/dashboard/payments");
   if(role==="cashier") {await expect(page.locator("#payments-outstanding-table")).toBeVisible();await expect(page.locator("#payments-load-error")).toHaveCount(0);}
   else await expect(page.locator("#payments-page")).toHaveCount(0);
   const csv=await page.request.get("/dashboard/reports/export?preset=month");expect(csv.status()).toBe(role==="cashier"?403:200);
  }finally{expect((await admin.auth.admin.deleteUser(user.data.user!.id)).error).toBeNull();}
 }
});
