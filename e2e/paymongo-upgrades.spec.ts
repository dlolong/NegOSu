import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createHmac, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loginAsOwner, qaPersonaCredentials } from "./helpers/auth";

const local = (value?: string) => !!value && ["127.0.0.1", "localhost"].includes(new URL(value).hostname);
test.skip(process.env.NEGOSU_PAYMONGO_FIXTURE !== "local-only" || !local(process.env.E2E_BASE_URL) || !local(process.env.NEXT_PUBLIC_SUPABASE_URL), "Requires local server with PayMongo fixture preload.");
test.use({ trace: "off" });
const base = "/dashboard/settings/billing";

// This regression also runs against the initial billing schema with both optional
// recovery columns absent. It never writes a paid plan or calls the real provider.
for (const providerStatus of ["active", "expired"] as const) {
  test(`cancellation records an unpaid ${providerStatus} checkout without recovery timestamps`, async ({ page }) => {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    const auth = await db.auth.signInWithPassword(qaPersonaCredentials("automotive")); expect(auth.error).toBeNull();
    const membership = await db.from("organization_memberships").select("organization_id").eq("user_id", auth.data.user!.id).single(); expect(membership.error).toBeNull();
    const org = membership.data!.organization_id;
    const before = await admin.from("organization_subscriptions").select("*").eq("organization_id", org).maybeSingle(); expect(before.error).toBeNull();
    const id = randomUUID(), sessionId = `cs_${id.replaceAll("-", "")}`;
    try {
      const inserted = await admin.from("billing_orders").insert({ id, organization_id: org, created_by: auth.data.user!.id, request_id: randomUUID(), plan_id: "starter", plan_name: "Starter", billing_interval: "month", amount_centavos: 49900, livemode: false, kind: "new", status: "pending", checkout_session_id: sessionId, checkout_url: `https://checkout.paymongo.com/${sessionId}` });
      expect(inserted.error).toBeNull();
      const file = join(tmpdir(), "negosu-paymongo-fixture", `${sessionId}.json`);
      writeFileSync(file, JSON.stringify({ id: sessionId, attributes: { reference_number: id, livemode: false, status: providerStatus, payments: [] } }));
      await loginAsOwner(page, "automotive");
      await page.goto(`${base}/orders/${id}`);
      await page.locator("#billing-payment-cancel").click();
      await expect(page.locator("#billing-order-status")).toHaveText("Payment cancelled");
      expect((await admin.from("billing_orders").select("status").eq("id", id).single()).data?.status).toBe("cancelled");
      expect(JSON.parse(readFileSync(file, "utf8")).attributes.status).toBe("expired");
      const after = await admin.from("organization_subscriptions").select("*").eq("organization_id", org).maybeSingle(); expect(after.error).toBeNull();
      expect(after.data).toEqual(before.data);
      await page.reload(); await expect(page.locator("#billing-payment-cancel")).toHaveCount(0);
    } finally {
      expect((await admin.from("billing_orders").delete().eq("id", id)).error).toBeNull();
      await db.auth.signOut({scope:"local"});
    }
  });
}

for (const industry of ["automotive", "salon", "pet_care"] as const) {
  test(`${industry}: prepaid upgrade, verified confirmation, renewal and cancellation`, async ({ page }) => {
    test.setTimeout(120_000);
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    const credentials = industry === "pet_care" ? { email: process.env.QA_PET_OWNER_EMAIL!, password: process.env.QA_OWNER_PASSWORD! } : qaPersonaCredentials(industry);
    const auth = await db.auth.signInWithPassword(credentials); expect(auth.error).toBeNull();
    const membership = await db.from("organization_memberships").select("organization_id").eq("user_id", auth.data.user!.id).single(); expect(membership.error).toBeNull();
    const org = membership.data!.organization_id;
    const previous = await admin.from("organization_subscriptions").select("*").eq("organization_id", org).maybeSingle(); expect(previous.error).toBeNull();
    const existing = await admin.from("billing_orders").select("id").eq("organization_id", org); expect(existing.error).toBeNull();
    const existingIds = new Set((existing.data ?? []).map(row => row.id));
    try {
      expect((await admin.from("organization_subscriptions").upsert({ organization_id: org, plan_id: "free", provider: null, status: "free", grace_ends_at: null }, { onConflict: "organization_id" })).error).toBeNull();
      if (industry === "pet_care") {
        await page.goto("/login?industry=pet_care");
        await page.locator("#negosu-login-email-input").fill(credentials.email);
        await page.locator("#negosu-login-password-input").fill(credentials.password);
        await page.locator("#negosu-login-submit-button").click();
        await expect(page.locator("#pet-care-dashboard")).toBeVisible();
      } else await loginAsOwner(page, industry);
      await page.route("https://checkout.paymongo.com/**", route => route.fulfill({ contentType: "text/html", body: "<h1>Local hosted checkout fixture</h1>" }));
      await page.goto(base);
      await expect(page.locator("#billing-current-plan")).toContainText("Free");
      await page.locator("#billing-choose-plan-starter").click();
      await expect(page.locator("#billing-upgrade-page")).toBeVisible();
      await expect(page.locator("#billing-upgrade-test-mode")).toBeVisible();
      for (const width of [320, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.locator("#dashboard-main-content").evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
        await page.screenshot({ path: join(tmpdir(), `negosu-billing-review-${industry}-${width}.png`) });
      }
      const starts = await Promise.all([1, 2].map(() => db.rpc("begin_paymongo_order", { p_organization_id: org, p_plan_id: "starter", p_interval: "month", p_request_id: randomUUID(), p_livemode: false })));
      for (const start of starts) expect(start.error).toBeNull();
      expect(starts[0].data.id).toBe(starts[1].data.id);
      await page.locator("#billing-upgrade-accept").check();
      await page.locator("#billing-upgrade-pay").click();
      await expect(page).toHaveURL(/^https:\/\/checkout.paymongo.com\/cs_/);
      const pending = await admin.from("billing_orders").select("*").eq("organization_id", org).eq("status", "pending").single(); expect(pending.error).toBeNull();
      const order = pending.data!;
      // A forged success return cannot activate a plan.
      await page.goto(`${base}/orders/${order.id}?return=success`);
      await expect(page.locator("#billing-order-status")).toHaveText("Awaiting payment confirmation");
      expect((await db.rpc("get_org_entitlements", { p_organization_id: org })).data.planId).toBe("free");
      const webhook = "/api/billing/paymongo/webhook";
      expect((await page.request.post(webhook, { data: { data: {} } })).status()).toBe(400);
      const file = join(tmpdir(), "negosu-paymongo-fixture", `${order.checkout_session_id}.json`);
      const session = JSON.parse(readFileSync(file, "utf8"));
      session.attributes.payments = [{ id: `pay_${order.id.replaceAll("-", "")}`, attributes: { status: "paid", amount: order.amount_centavos, currency: "PHP", paid_at: Math.floor(Date.now() / 1000) } }];
      writeFileSync(file, JSON.stringify(session));
      const body = JSON.stringify({ data: { id: `evt_${order.id}`, attributes: { type: "checkout_session.payment.paid", livemode: false, data: { id: order.checkout_session_id } } } });
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = `t=${timestamp},te=${createHmac("sha256", "local-fixture-webhook-secret").update(`${timestamp}.${body}`).digest("hex")}`;
      if (industry === "automotive") {
        const results = await Promise.all([1, 2].map(() => page.request.post(webhook, { data: body, headers: { "content-type": "application/json", "paymongo-signature": signature } })));
        for (const result of results) expect(result.status()).toBe(200);
        await page.reload();
      } else if (industry === "salon") await page.locator("#billing-payment-refresh").click();
      else {
        expect((await page.request.post("/api/billing/paymongo/reconcile")).status()).toBe(401);
        const reconcile = await page.request.post("/api/billing/paymongo/reconcile", { headers: { authorization: "Bearer local-fixture-reconciliation-secret" } });
        expect(reconcile.status()).toBe(200); await page.reload();
      }
      await expect(page.locator("#billing-order-status")).toHaveText("Payment confirmed", { timeout: 15_000 });
      const paid = await admin.from("organization_subscriptions").select("*").eq("organization_id", org).single(); expect(paid.data?.plan_id).toBe("starter");
      expect(JSON.parse(readFileSync(file, "utf8")).attributes.status).toBe("expired");
      // Replayed webhook is harmless even after the checkout has been closed.
      expect((await page.request.post(webhook, { data: body, headers: { "content-type": "application/json", "paymongo-signature": signature } })).status()).toBe(200);
      expect((await admin.from("organization_subscriptions").select("current_period_end").eq("organization_id", org).single()).data?.current_period_end).toBe(paid.data?.current_period_end);
      await page.goto(base); await expect(page.locator("#billing-current-plan")).toContainText("Starter");
      await page.locator("#billing-choose-plan-starter").click();
      await expect(page.locator("#billing-upgrade-credit")).toContainText("added after");
      await page.locator("#billing-upgrade-interval").selectOption("year"); await page.locator("#billing-upgrade-update").click();
      await expect(page.locator("#billing-upgrade-interval")).toHaveValue("year");
      await page.locator("#billing-upgrade-cancel").click(); await expect(page).toHaveURL(base);
      await page.locator("#billing-choose-plan-business").click(); await expect(page.locator("#billing-upgrade-credit")).toContainText("extra access time");
      await page.locator("#billing-upgrade-accept").check(); await page.locator("#billing-upgrade-pay").click(); await expect(page).toHaveURL(/^https:\/\/checkout.paymongo.com\//);
      const abandoned = await admin.from("billing_orders").select("*").eq("organization_id", org).eq("status", "pending").single(); expect(abandoned.error).toBeNull();
      await page.goto(`${base}/orders/${abandoned.data!.id}?return=cancelled`); await expect(page.locator("#billing-return-cancelled")).toBeVisible();
      await page.setViewportSize({ width: 320, height: 900 });
      expect(await page.locator("#dashboard-main-content").evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      await page.locator("#billing-payment-cancel").click(); await expect(page.locator("#billing-order-status")).toHaveText("Payment cancelled");
      expect((await db.rpc("get_org_entitlements", { p_organization_id: org })).data.planId).toBe("starter");
      await page.goto(`${base}/history`); await expect(page.locator("#billing-history-table")).toBeVisible();
      expect(await page.locator("#dashboard-main-content").evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      await page.locator("#billing-history-tabs-paid").click();
      await expect(page).toHaveURL(/tab=paid/);
      await expect(page.locator(`#billing-order-link-${abandoned.data!.id}`)).toHaveCount(0);
      await page.locator("#billing-history-tabs-all").click();
      await expect(page.locator(`#billing-order-link-${abandoned.data!.id}`)).toBeVisible();
      expect(await page.locator(`#billing-order-link-${order.id}`).evaluate(el => el.getBoundingClientRect().width)).toBeGreaterThan(50);
      await page.screenshot({ path: join(tmpdir(), `negosu-billing-history-${industry}-320.png`) });
      await page.locator(`#billing-order-link-${order.id}`).click(); await expect(page.locator("#billing-order-status")).toHaveText("Payment confirmed");
    } finally {
      const rows = await admin.from("billing_orders").select("id").eq("organization_id", org);
      const created = (rows.data ?? []).filter(row => !existingIds.has(row.id)).map(row => row.id);
      if (created.length) expect((await admin.from("billing_orders").delete().in("id", created)).error).toBeNull();
      if (previous.data) expect((await admin.from("organization_subscriptions").upsert(previous.data, { onConflict: "organization_id" })).error).toBeNull();
      else expect((await admin.from("organization_subscriptions").delete().eq("organization_id", org)).error).toBeNull();
      await db.auth.signOut({scope:"local"});
    }
  });
}
