import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { authenticatedSmokeEnabled } from "./helpers/auth";
import { formatMoney } from "../lib/operations";

const local = (value?:string) => Boolean(value && ["localhost","127.0.0.1"].includes(new URL(value).hostname));
test.skip(!authenticatedSmokeEnabled() || !local(process.env.E2E_BASE_URL) || !local(process.env.NEXT_PUBLIC_SUPABASE_URL), "Requires disposable local data.");
test.use({trace:"off"});

test("USD catalog creation and partial payment preserve cents through authoritative readback", async ({page},info) => {
  const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
  const nonce=crypto.randomUUID(),email=`currency-${nonce}@example.test`,password=`Qa-${nonce}!`;
  const user=await admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{negosu_qa_fixture:"currency-browser"},user_metadata:{full_name:"Currency QA"}});expect(user.error).toBeNull();
  const org=await admin.from("organizations").insert({name:"Currency QA",slug:`currency-${nonce}`,industry:"salon",business_type:"salon",currency:"USD",status:"active",public_page_enabled:true,created_by:user.data.user!.id}).select("id,slug").single();expect(org.error).toBeNull();
  try {
    expect((await admin.from("organization_memberships").insert({organization_id:org.data!.id,user_id:user.data.user!.id,role:"owner",is_active:true})).error).toBeNull();
    const branch=await admin.from("branches").insert({organization_id:org.data!.id,name:"USD Main",is_primary:true,is_active:true,timezone:"Asia/Manila"}).select("id").single();expect(branch.error).toBeNull();
    expect((await admin.from("organization_subscriptions").upsert({organization_id:org.data!.id,plan_id:"business",status:"active"},{onConflict:"organization_id"})).error).toBeNull();
    await page.goto("/login");await page.locator("#negosu-login-email-input").fill(email);await page.locator("#negosu-login-password-input").fill(password);await page.locator("#negosu-login-submit-button").click();await expect(page.locator("#dashboard-app-shell")).toBeVisible();
    await page.goto("/dashboard/services/new");
    await expect(page.getByText("Base price (USD) *",{exact:true})).toBeVisible();
    await page.locator("#salon-treatment-name-input").fill("Precision treatment");await page.locator("#salon-treatment-base-price-input").fill("12.34");await page.locator("#salon-treatment-duration-input").fill("30");await page.locator("#salon-treatment-save-button").click();await expect(page).toHaveURL(/\/dashboard\/services\/[a-f0-9-]+\?message=/);
    const service=await admin.from("services").select("id,currency,base_price_centavos").eq("organization_id",org.data!.id).single();expect(service.error).toBeNull();expect(service.data!.currency).toBe("USD");expect(service.data!.base_price_centavos).toBe(1234);
    await page.reload();await expect(page.locator("#dashboard-main-content")).toContainText(formatMoney(1234,"USD"));
    const customer=await admin.from("customers").insert({organization_id:org.data!.id,full_name:"USD Client"}).select("id").single();expect(customer.error).toBeNull();
    const appointment=await admin.from("appointments").insert({organization_id:org.data!.id,branch_id:branch.data!.id,customer_id:customer.data!.id,starts_at:new Date(Date.now()+86400000).toISOString(),ends_at:new Date(Date.now()+88200000).toISOString(),expected_total_centavos:10000}).select("id").single();expect(appointment.error).toBeNull();
    await page.goto(`/dashboard/appointments/${appointment.data!.id}?dialog=payment`);await expect(page.getByText("Amount (USD)",{exact:true})).toBeVisible();
    await page.locator("#salon-appointment-payment-amount-input").fill("12.34");await page.locator("#salon-appointment-payment-save-button").click();await expect(page.locator("#salon-appointment-payment-dialog")).toHaveCount(0);
    const payment=await admin.from("payments").select("currency,amount_centavos").eq("appointment_id",appointment.data!.id).single();expect(payment.error).toBeNull();expect(payment.data).toEqual({currency:"USD",amount_centavos:1234});
    await page.goto("/dashboard/payments?tab=history");await expect(page.locator("#payments-list")).toContainText(formatMoney(1234,"USD"));await expect(page.locator("#payments-collected-today")).toContainText(formatMoney(1234,"USD"));
    await page.goto("/dashboard");await expect(page.locator("#negosu-command-center-revenue")).toBeVisible();await expect(page.locator("#negosu-command-center-revenue")).toContainText(formatMoney(1234,"USD"));await expect(page.locator("#negosu-command-center-revenue")).toContainText("Collected today");
    await page.screenshot({path:info.outputPath("usd-collections.png")});
    await page.goto("/dashboard/inventory?dialog=create");await expect(page.getByText("Cost (USD)",{exact:true})).toBeVisible();await expect(page.getByText("Sell price (USD)",{exact:true})).toBeVisible();
    await page.goto("/dashboard/appointments/new");
    await page.locator("#salon-appointment-service-select").fill("Inline precision treatment");await page.locator("#salon-appointment-service-select-create").click();
    await expect(page.getByText("Price (USD)",{exact:true})).toBeVisible();
    await page.locator("#salon-appointment-new-service-price").fill("23.45");await page.locator("#salon-appointment-new-service-duration").fill("30");await page.locator("#salon-appointment-new-service-save").click();
    await expect(page.locator("#salon-appointment-selected-services")).toContainText(formatMoney(2345,"USD"));
    const inline=await admin.from("services").select("currency,base_price_centavos").eq("organization_id",org.data!.id).eq("name","Inline precision treatment").single();expect(inline.error).toBeNull();expect(inline.data).toEqual({currency:"USD",base_price_centavos:2345});
    await page.locator("#salon-appointment-service-select").fill("Inline precision");await expect(page.locator("#salon-appointment-service-select-options")).toContainText(formatMoney(2345,"USD"));

  } finally {
    expect((await admin.from("organizations").update({status:"suspended"}).eq("id",org.data!.id).eq("created_by",user.data.user!.id)).error).toBeNull();
    // Preserve the audit trail and its actor foreign keys in the disposable database.
    expect((await admin.auth.admin.updateUserById(user.data.user!.id,{ban_duration:"876000h"})).error).toBeNull();
  }
});
