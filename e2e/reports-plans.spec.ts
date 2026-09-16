import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { authenticatedSmokeEnabled, loginAsOwner, qaPersonaCredentials } from "./helpers/auth";
import { reportQuerySchema, resolveReportRange } from "../lib/reporting";

const local = (url?: string) => !!url && ["localhost", "127.0.0.1"].includes(new URL(url).hostname);
test.skip(!authenticatedSmokeEnabled() || !local(process.env.E2E_BASE_URL) || !local(process.env.NEXT_PUBLIC_SUPABASE_URL), "Requires isolated local fixtures.");
test.use({ trace: "off" });

for (const industry of ["automotive", "salon", "pet_care"] as const) {
  test(`${industry}: Free overview, paid reports and export respect the effective plan`, async ({ page }) => {
    test.setTimeout(90_000);
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    const credentials = industry === "pet_care" ? { email: process.env.QA_PET_OWNER_EMAIL!, password: process.env.QA_OWNER_PASSWORD! } : qaPersonaCredentials(industry);
    const auth = await db.auth.signInWithPassword(credentials); expect(auth.error).toBeNull();
    const member = await db.from("organization_memberships").select("organization_id").eq("user_id", auth.data.user!.id).single(); expect(member.error).toBeNull();
    const organizationId = member.data!.organization_id;
    const branch = await admin.from("branches").select("id,name,timezone").eq("organization_id", organizationId).eq("is_primary", true).single(); expect(branch.error).toBeNull();
    const previous = await admin.from("organization_subscriptions").select("organization_id,plan_id,status,grace_ends_at").eq("organization_id", organizationId).maybeSingle(); expect(previous.error).toBeNull();
    const range = resolveReportRange(reportQuerySchema.parse({ preset: "30d" }), branch.data!.timezone);
    try {
      expect((await admin.from("organization_subscriptions").upsert({ organization_id: organizationId, plan_id: "free", status: "free", grace_ends_at: null }, { onConflict: "organization_id" })).error).toBeNull();
      if (industry === "pet_care") {
        await page.goto("/login?industry=pet_care");
        await page.locator("#negosu-login-email-input").fill(credentials.email);
        await page.locator("#negosu-login-password-input").fill(credentials.password);
        await page.locator("#negosu-login-submit-button").click();
        await expect(page.locator("#pet-care-dashboard")).toBeVisible();
      } else await loginAsOwner(page, industry);
      await page.goto("/dashboard/reports?preset=custom&start=2020-01-01&end=2020-03-01&branch=all&section=revenue");
      await expect(page.locator("#reports-free-plan-info")).toContainText(branch.data!.name);
      await expect(page.locator("#reports-range-description")).toContainText(`${range.start} to ${range.end}`);
      await expect(page.locator("#reports-summary")).toBeVisible();
      await expect(page.locator("#reports-overview-section")).toBeVisible();
      await expect(page.locator("#reports-filter-form, #reports-export-button, #reports-section-tabs, #reports-revenue-section")).toHaveCount(0);
      const exportDenied = await page.request.get("/dashboard/reports/export");
      expect(exportDenied.status()).toBe(403);
      expect(await exportDenied.text()).toContain("paid plans");
      for (const width of [320, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.locator("#dashboard-main-content").evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
        if (width === 320 || width === 1440) await page.screenshot({ path: `/private/tmp/negosu-reports-free-${industry}-${width}.png` });
      }
      await expect(page.locator("#desktop-nav-reports")).toBeVisible();
      // Starter previously had no reporting access. A valid paid subscription now enables all sections.
      expect((await admin.from("organization_subscriptions").update({ plan_id: "starter", status: "active" }).eq("organization_id", organizationId)).error).toBeNull();
      await page.reload();
      await expect(page.locator("#reports-free-plan-info")).toHaveCount(0);
      await expect(page.locator("#reports-revenue-section")).toBeVisible();
      await expect(page.locator("#reports-start-date-input")).toHaveValue("2020-01-01");
      await page.locator("#reports-tab-team").click();
      await expect(page.locator("#reports-technician-workload")).toBeVisible();
      await page.locator("#reports-tab-branches").click();
      await expect(page.locator("#reports-branch-comparison")).toBeVisible();
      await page.locator("#reports-tab-overview").click();
      await expect(page.locator("#reports-overview-section")).toBeVisible();
      const csv = await page.request.get((await page.locator("#reports-export-button").getAttribute("href"))!);
      expect(csv.status()).toBe(200);
      expect(csv.headers()["content-type"]).toContain("text/csv");
      expect(csv.headers()["cache-control"]).toContain("no-store");
      expect(await csv.text()).toContain("Business report");
      await page.setViewportSize({ width: 320, height: 900 });
      expect(await page.locator("#dashboard-main-content").evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await page.screenshot({ path: `/private/tmp/negosu-reports-paid-${industry}-320.png` });
      expect((await admin.from("organization_subscriptions").update({ status: "cancelled" }).eq("organization_id", organizationId)).error).toBeNull();
      await page.reload();
      await expect(page.locator("#reports-free-plan-info")).toBeVisible();
      expect((await page.request.get("/dashboard/reports/export")).status()).toBe(403);
    } finally {
      if (previous.data) expect((await admin.from("organization_subscriptions").upsert(previous.data, { onConflict: "organization_id" })).error).toBeNull();
      else expect((await admin.from("organization_subscriptions").delete().eq("organization_id", organizationId)).error).toBeNull();
      await db.auth.signOut();
    }
  });
}
