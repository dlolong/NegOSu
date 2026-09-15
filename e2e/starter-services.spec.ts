import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { authenticatedSmokeEnabled, loginAsOwner, qaPersonaCredentials } from "./helpers/auth";
import { installStarterServices } from "../modules/core/catalog/install-starter-services";
const local = (url?: string) => !!url && ["127.0.0.1", "localhost"].includes(new URL(url).hostname);
test.skip(!authenticatedSmokeEnabled() || !local(process.env.E2E_BASE_URL) || !local(process.env.NEXT_PUBLIC_SUPABASE_URL), "Requires isolated local fixtures.");
test.use({ trace: "off" });
for (const industry of ["automotive", "salon", "pet_care"] as const) {
  test(`${industry} starter catalog contains ten services and preserves existing records on concurrent retries`, async () => {
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    const credentials = industry === "pet_care" ? { email: process.env.QA_PET_OWNER_EMAIL!, password: process.env.QA_OWNER_PASSWORD! } : qaPersonaCredentials(industry);
    const auth = await db.auth.signInWithPassword(credentials); expect(auth.error).toBeNull();
    try {
      const member = await db.from("organization_memberships").select("organization_id,role").eq("user_id", auth.data.user!.id).single(); expect(member.error).toBeNull();
      const actor = { organizationId: member.data!.organization_id, role: member.data!.role };
      const read = () => db.from("services").select("id,name,base_price_centavos,duration_minutes,is_active,is_public").eq("organization_id", actor.organizationId).order("id");
      const before = await read(); expect(before.error).toBeNull(); expect(before.data!.filter(service => service.is_active).length).toBeGreaterThanOrEqual(10);
      const results = await Promise.all([installStarterServices(db, actor), installStarterServices(db, actor)]);
      expect(results).toEqual([{ added: 0 }, { added: 0 }]);
      expect((await read()).data).toEqual(before.data);
      expect((await installStarterServices(db, { ...actor, organizationId: "00000000-0000-4000-8000-000000000000" })).error).toBeTruthy();
    } finally { await db.auth.signOut(); }
  });
}
test("starter catalog preview, cancel, and add work at mobile and desktop widths", async ({ page }) => {
  await loginAsOwner(page, "salon");
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/dashboard/services");
    await page.locator("#starter-services-open-button").click();
    await expect(page.locator("#starter-services-preview tbody tr")).toHaveCount(10);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.locator("#starter-services-actions-cancel-button").click();
    await expect(page.locator("#starter-services-dialog")).toHaveCount(0);
  }
  await page.locator("#starter-services-open-button").click();
  await page.locator("#starter-services-add-button").click();
  await expect(page).toHaveURL(/\/dashboard\/services\?message=/);
  await expect(page.locator("#salon-treatments-page")).toContainText("already in the catalog");
});

test("Automotive appointment saves with a starter service and matching customer vehicle", async ({ page }) => {
  const { selectRecord } = await import("./helpers/searchable-select");
  await loginAsOwner(page, "automotive");
  await page.goto("/dashboard/appointments/new");
  await selectRecord(page, "appointment-customer-select", { name: "Automotive QA Customer" });
  await selectRecord(page, "appointment-vehicle-select", { name: "Toyota" });
  await selectRecord(page, "appointment-service-select", { name: "Engine oil change labor" });
  const day = new Date(); day.setUTCDate(day.getUTCDate() + 20);
  await page.locator("#appointment-starts-at-input").fill(`${day.toISOString().slice(0,10)}T10:00`);
  await page.locator("#appointment-allow-conflict-checkbox").check();
  await page.locator("#appointment-save-button").click();
  await expect(page).toHaveURL(/\/dashboard\/appointments\/[a-f0-9-]+(?:\?|$)/);
  await expect(page.locator("main").first()).toContainText("Engine oil change labor");
});
