import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { authenticatedSmokeEnabled, loginAsOwner, qaPersonaCredentials } from "./helpers/auth";
import { selectRecord } from "./helpers/searchable-select";
const local = (url?: string) => !!url && ["127.0.0.1", "localhost"].includes(new URL(url).hostname);
test.skip(!authenticatedSmokeEnabled() || !local(process.env.E2E_BASE_URL) || !local(process.env.NEXT_PUBLIC_SUPABASE_URL), "Requires isolated local fixtures.");
test.use({ trace: "off" });
test.describe.configure({ mode: "serial" });

for (const industry of ["salon", "pet_care"] as const) {
  for (const width of [320, 1440]) {
    test(`${industry} ${width}px walk-in retains failed draft, checks in once, and opens usable details`, async ({ page }) => {
      const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
      const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
      const pet = industry === "pet_care";
      const credentials = pet ? { email: process.env.QA_PET_OWNER_EMAIL!, password: process.env.QA_OWNER_PASSWORD! } : qaPersonaCredentials("salon");
      const login = await db.auth.signInWithPassword(credentials); expect(login.error).toBeNull();
      const member = await db.from("organization_memberships").select("organization_id").eq("user_id",login.data.user!.id).single(); expect(member.error).toBeNull();
      const branch = await admin.from("branches").select("id,timezone,opening_hours").eq("organization_id",member.data!.organization_id).eq("is_primary",true).single(); expect(branch.error).toBeNull();
      const offset = new Date().getUTCHours()-10;
      const timezone = `Etc/GMT${offset>=0?"+":""}${offset}`;
      const openingHours = Object.fromEntries(["monday","tuesday","wednesday","thursday","friday","saturday","sunday"].map(day=>[day,{open:"00:00",close:"23:59"}]));
      const root = pet ? "/dashboard/pet-care/appointments" : "/dashboard/appointments";
      const prefix = pet ? "pet-appointment" : "salon-walk-in";
      let id: string | undefined;
      let concurrentId: string | undefined;
      try {
        expect((await admin.from("branches").update({timezone,opening_hours:openingHours}).eq("id",branch.data!.id)).error).toBeNull();
        await page.setViewportSize({width,height:900});
        if(pet) {
          await page.goto("/login?industry=pet_care"); await page.locator("#negosu-login-email-input").fill(credentials.email); await page.locator("#negosu-login-password-input").fill(credentials.password); await page.locator("#negosu-login-submit-button").click(); await expect(page.locator("#pet-care-dashboard")).toBeVisible();
          await expect(page.locator("#pet-dashboard-walk-in-button")).toBeVisible();
        } else await loginAsOwner(page,"salon");
        await page.goto(root);
        await page.locator(pet?"#pet-add-walk-in-button":"#salon-add-walk-in-button").click();
        await page.locator(pet?"#pet-appointment-actions-cancel-button":"#salon-walk-in-cancel-button").click();
        await expect(page).toHaveURL(new RegExp(`${root}$`));
        await page.locator(pet?"#pet-add-walk-in-button":"#salon-add-walk-in-button").click();
        if(pet) await selectRecord(page,"pet-appointment-pet-select",{name:"Milo"});
        else { await page.locator(`#${prefix}-client-select`).click(); await page.locator(`#${prefix}-client-select-options`).getByRole("option").first().click(); }
        await page.locator(`#${prefix}-service-select`).click(); await page.locator(`#${prefix}-service-select-options`).getByRole("option").first().click();
        for(const kind of (pet?["staff","resource"]:["staff"])) { await page.locator(`#${prefix}-${kind}-select`).click(); await page.locator(`#${prefix}-${kind}-select-options`).getByRole("option").first().click(); }
        const form = page.locator(pet?"#pet-appointment-form":"#salon-walk-in-create-form");
        const requestId = await form.locator('[name="requestId"]').inputValue();
        expect((await admin.from("branches").update({opening_hours:{}}).eq("id",branch.data!.id)).error).toBeNull();
        await page.locator(`#${prefix}-save-button`).click();
        await expect(page.locator(`#${prefix}-error`)).toContainText(/hours/i);
        expect((await admin.from("appointments").select("id",{count:"exact",head:true}).eq("walk_in_request_id",requestId)).count).toBe(0);
        await expect(page.locator(`#${prefix}-selected-services`)).not.toBeEmpty();
        expect((await admin.from("branches").update({opening_hours:openingHours}).eq("id",branch.data!.id)).error).toBeNull();
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
        await page.locator(`#${prefix}-save-button`).click();
        await expect(page).toHaveURL(new RegExp(`${root}/[a-f0-9-]+$`));
        id = new URL(page.url()).pathname.split("/").at(-1)!;
        const saved=await admin.from("appointments").select("status,source,vehicle_id,customer_id,appointment_services(service_id),appointment_staff_assignments(staff_profile_id),appointment_resource_assignments(resource_id),pet_appointment_details(pet_id)").eq("id",id).single(); expect(saved.error).toBeNull();
        expect(saved.data!.status).toBe("checked_in"); expect(saved.data!.source).toBe("walk_in"); expect(saved.data!.vehicle_id).toBeNull();
        const petDetails = saved.data!.pet_appointment_details as unknown as {pet_id:string}|{pet_id:string}[]|null;
        const args={p_request_id:requestId,p_branch_id:branch.data!.id,p_customer_id:pet?null:saved.data!.customer_id,p_pet_id:pet?(Array.isArray(petDetails)?petDetails[0]:petDetails)!.pet_id:null,p_service_ids:saved.data!.appointment_services.map(s=>s.service_id),p_staff_ids:saved.data!.appointment_staff_assignments.map(s=>s.staff_profile_id),p_resource_ids:saved.data!.appointment_resource_assignments.map(s=>s.resource_id)};
        const retries=await Promise.all([db.rpc("create_appointment_walk_in",args),db.rpc("create_appointment_walk_in",args)]);
        for(const retry of retries){expect(retry.error).toBeNull();expect(retry.data).toBe(id);}
        const collision=await db.rpc("create_appointment_walk_in",{...args,p_request_id:randomUUID()});expect(collision.error).not.toBeNull();
        expect((await admin.from("queue_entries").select("id",{count:"exact",head:true}).eq("appointment_id",id)).count).toBe(0);
        if(pet) {
          await expect(page.locator("#pet-appointment-scheduling-assignments")).toContainText("Scheduled groomer");
          await expect(page.locator("#pet-appointment-visit-details")).toContainText("Estimated total");
          await expect(page.locator("#pet-start-button")).toBeVisible();
          await page.locator("#pet-grooming-note-add-button").click(); await page.locator("#pet-grooming-note-input").fill("Discard this note"); await page.locator("#pet-grooming-note-actions-cancel-button").click(); await expect(page.locator("#pet-grooming-note-dialog")).toHaveCount(0);
          await page.locator("#pet-grooming-note-add-button").click(); await page.locator("#pet-grooming-note-input").fill("Walk-in grooming observation"); await page.locator("#pet-grooming-note-save").click(); await expect(page.locator("#pet-grooming-notes")).toContainText("Walk-in grooming observation");
          await page.locator("#pet-record-payment-toggle").click(); await page.locator("#pet-payment-amount").fill("1"); await page.locator("#pet-payment-actions-cancel-button").click(); await expect(page.locator("#pet-payment-dialog")).toHaveCount(0);
          expect((await admin.from("payments").select("id",{count:"exact",head:true}).eq("appointment_id",id)).count).toBe(0);
          expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
          await page.screenshot({path:`/private/tmp/negosu-pet-appointment-${width}.png`,fullPage:true});
          await page.locator("#pet-appointment-close-button").click();await expect(page).toHaveURL(new RegExp(`${root}$`));
        }
        expect((await db.rpc(pet?"transition_pet_appointment":"transition_salon_appointment",{p_appointment_id:id,p_action:"cancel"})).error).toBeNull();
        const concurrentArgs={...args,p_request_id:randomUUID()};
        const concurrent=await Promise.all([db.rpc("create_appointment_walk_in",concurrentArgs),db.rpc("create_appointment_walk_in",concurrentArgs)]);
        concurrentId=concurrent.find(result=>result.data)?.data as string|undefined;
        for(const result of concurrent) expect(result.error).toBeNull();
        expect(concurrent[0].data).toBe(concurrent[1].data);
        expect((await admin.from("appointments").select("id",{count:"exact",head:true}).eq("walk_in_request_id",concurrentArgs.p_request_id)).count).toBe(1);
      } finally {
        if(concurrentId) await db.rpc(pet?"transition_pet_appointment":"transition_salon_appointment",{p_appointment_id:concurrentId,p_action:"cancel"});
        if(id) await db.rpc(pet?"transition_pet_appointment":"transition_salon_appointment",{p_appointment_id:id,p_action:"cancel"});
        await admin.from("branches").update({timezone:branch.data!.timezone,opening_hours:branch.data!.opening_hours}).eq("id",branch.data!.id);
        await db.auth.signOut({scope:"local"});
      }
    });
  }
}
