import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { authenticatedSmokeEnabled, loginAsOwner, qaPersonaCredentials } from "./helpers/auth";

const local = (url?: string) => !!url && ["localhost", "127.0.0.1"].includes(new URL(url).hostname);
test.skip(!authenticatedSmokeEnabled() || !local(process.env.E2E_BASE_URL) || !local(process.env.NEXT_PUBLIC_SUPABASE_URL), "Requires isolated local fixtures.");
test.use({ trace: "off" });

for (const industry of ["automotive", "salon", "pet_care"] as const) {
  test(`${industry} booking dialog fits desktop and mobile, closes safely, and declines independently`, async ({ page }) => {
    test.setTimeout(90_000);
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    const credentials = industry === "pet_care" ? { email: process.env.QA_PET_OWNER_EMAIL!, password: process.env.QA_OWNER_PASSWORD! } : qaPersonaCredentials(industry);
    const auth = await db.auth.signInWithPassword(credentials); expect(auth.error).toBeNull();
    const member = await db.from("organization_memberships").select("organization_id").eq("user_id", auth.data.user!.id).single(); expect(member.error).toBeNull();
    const org = await admin.from("organizations").select("id,slug,public_page_enabled").eq("id", member.data!.organization_id).single(); expect(org.error).toBeNull();
    const branch = await admin.from("branches").select("id,accepts_public_bookings").eq("organization_id", org.data!.id).eq("is_primary", true).single(); expect(branch.error).toBeNull();
    const service = await admin.from("services").select("id,is_public").eq("organization_id", org.data!.id).eq("is_active", true).order("duration_minutes").limit(1).single(); expect(service.error).toBeNull();
    const marker = randomUUID();
    let requestId = "";
    try {
      expect((await admin.from("organizations").update({ public_page_enabled: true }).eq("id", org.data!.id)).error).toBeNull();
      expect((await admin.from("branches").update({ accepts_public_bookings: true }).eq("id", branch.data!.id)).error).toBeNull();
      expect((await admin.from("services").update({ is_public: true }).eq("id", service.data!.id)).error).toBeNull();
      const day = new Date(); day.setUTCDate(day.getUTCDate() + 30);
      if (day.getUTCDay() === 0) day.setUTCDate(day.getUTCDate() + 1);
      const submitted = await admin.rpc(industry === "pet_care" ? "submit_pet_public_booking" : "submit_public_booking", {
        p_slug: org.data!.slug, p_branch_id: branch.data!.id, p_service_ids: [service.data!.id],
        p_preferred_at: `${day.toISOString().slice(0, 10)}T10:00:00+08:00`,
        p_customer_name: "Booking Dialog Customer", p_phone: "09171234567", p_email: `dialog-${marker}@example.test`,
        p_customer_note: "Please call before confirming. " + "LongNote".repeat(30), p_rate_key_hash: marker, p_honeypot: "",
        ...(industry === "pet_care" ? { p_pet_name: "Dialog Pet", p_species: "dog", p_breed: "Poodle" } : { p_vehicle_make: "Toyota", p_vehicle_model: "Vios", p_vehicle_year: null, p_vehicle_type: null, p_plate_number: null }),
      });
      expect(submitted.error).toBeNull();
      const request = await admin.from("public_booking_requests").select("id").eq("rate_key_hash", marker).single(); expect(request.error).toBeNull();
      requestId = request.data!.id;
      if (industry === "pet_care") {
        await page.goto("/login?industry=pet_care");
        await page.locator("#negosu-login-email-input").fill(credentials.email);
        await page.locator("#negosu-login-password-input").fill(credentials.password);
        await page.locator("#negosu-login-submit-button").click();
        await expect(page.locator("#pet-care-dashboard")).toBeVisible();
      } else await loginAsOwner(page, industry);
      const route = `/dashboard/bookings?status=all&q=Booking+Dialog&requestId=${requestId}`;
      await page.goto(route);
      const dialog = page.locator("#booking-request-details-dialog");
      const reason = page.locator(`#booking-request-decline-reason-${requestId}`);
      const decline = page.locator(`#booking-request-decline-button-${requestId}`);
      const confirm = page.locator(`#booking-request-confirm-button-${requestId}`);
      await expect(dialog).toHaveJSProperty("open", true);
      for (const width of [1440, 1024, 768, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await reason.fill("This time is unavailable. Please select another time.");
        await decline.scrollIntoViewIfNeeded();
        expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
        const bounds = await dialog.boundingBox();
        for (const control of [reason, decline, confirm]) {
          const box = await control.boundingBox();
          expect(box!.x).toBeGreaterThanOrEqual(bounds!.x);
          expect(box!.x + box!.width).toBeLessThanOrEqual(bounds!.x + bounds!.width);
          expect(box!.height).toBeGreaterThanOrEqual(44);
        }
        const input = await reason.boundingBox(), button = await decline.boundingBox();
        if (width >= 640) {
          expect(input!.width).toBeGreaterThan(300);
          expect(Math.abs(input!.y + input!.height - button!.y - button!.height)).toBeLessThan(2);
          expect(input!.x + input!.width).toBeLessThan(button!.x);
        } else expect(button!.y).toBeGreaterThanOrEqual(input!.y + input!.height);
        if (width === 320 || width === 1440) await page.screenshot({ path: `/private/tmp/negosu-booking-dialog-${industry}-${width}.png` });
      }
      await page.locator("#booking-request-details-dialog-close-button").click();
      await expect(dialog).toHaveCount(0);
      await expect(page).toHaveURL(/status=all.*q=Booking/);
      expect((await admin.from("public_booking_requests").select("status,decline_reason").eq("id", requestId).single()).data).toEqual({ status: "requested", decline_reason: null });
      await page.goto(route);
      if (industry === "pet_care") {
        await confirm.click();
        await expect(page.locator(`#pet-request-staff-${requestId}`)).toBeFocused();
        await expect(dialog).toHaveJSProperty("open", true);
      }
      await reason.fill("Requested time unavailable");
      await decline.click();
      await expect(page.getByText("Booking declined.", { exact: true })).toBeVisible();
      expect((await admin.from("public_booking_requests").select("status,decline_reason").eq("id", requestId).single()).data).toEqual({ status: "declined", decline_reason: "Requested time unavailable" });
    } finally {
      await admin.from("public_booking_requests").delete().eq("rate_key_hash", marker);
      await admin.from("public_booking_rate_limits").delete().eq("key_hash", marker);
      await admin.from("organizations").update({ public_page_enabled: org.data!.public_page_enabled }).eq("id", org.data!.id);
      await admin.from("branches").update({ accepts_public_bookings: branch.data!.accepts_public_bookings }).eq("id", branch.data!.id);
      await admin.from("services").update({ is_public: service.data!.is_public }).eq("id", service.data!.id);
      await db.auth.signOut();
    }
  });
}
