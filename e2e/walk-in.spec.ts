import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { authenticatedSmokeEnabled, loginAsOwner, qaPersonaCredentials } from "./helpers/auth";
import { selectRecord } from "./helpers/searchable-select";

const local = (value: string | undefined) => !!value && ["localhost", "127.0.0.1"].includes(new URL(value).hostname);
test.skip(!authenticatedSmokeEnabled() || !local(process.env.E2E_BASE_URL) || !local(process.env.NEXT_PUBLIC_SUPABASE_URL), "Requires local app and database fixtures.");
test.use({ trace: "off" });

for (const width of [320, 1440]) {
test.describe(`${width}px`, () => {
test.use({ viewport: { width, height: 900 } });
test("walk-in form saves services and an accurately labelled queue entry", async ({ page }) => {
  await loginAsOwner(page, "automotive");
  await page.goto("/dashboard/queue/new");
  await selectRecord(page, "walk_in-customer-select", { name: "Automotive QA Customer" });
  await selectRecord(page, "walk_in-vehicle-select", { name: "Toyota" });
  await selectRecord(page, "walk_in-service-select", { name: "QA Preventive Maintenance" });
  const notes = `Walk-in regression ${crypto.randomUUID()}`;
  await page.locator("#walk_in-customer-notes-input").fill(notes);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.locator("#walk_in-save-button").click();
  await expect(page).toHaveURL(/\/dashboard\/queue\?message=Walk-in/);
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data, error } = await db.from("appointments").select("id,status,source,expected_total_centavos,queue_entries(source,queue_number,estimated_total_centavos),appointment_services(service_id)").eq("customer_note", notes).single();
  expect(error).toBeNull();
  expect(data?.status).toBe("queued");
  expect(data?.source).toBe("walk_in");
  const entry = Array.isArray(data?.queue_entries) ? data.queue_entries[0] : data?.queue_entries;
  expect(entry).toBeTruthy();
  expect(entry?.source).toBe("walk_in");
  expect(entry?.estimated_total_centavos).toBe(data?.expected_total_centavos);
  expect(data?.appointment_services).toHaveLength(1);
});

test("rejected walk-in keeps its draft and can be corrected without a partial appointment", async ({ page }) => {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const serviceId = crypto.randomUUID();
  const branchId = "de000000-0000-4000-8000-000000000002", name = `Unavailable walk-in ${serviceId}`;
  // Derive the tenant from the known local branch rather than relying on a user-supplied tenant.
  const branch = await db.from("branches").select("organization_id").eq("id", branchId).single();
  expect(branch.error).toBeNull();
  const organizationId = branch.data!.organization_id;
  const created = await db.from("services").insert({ id: serviceId, organization_id: organizationId, name, base_price_centavos: 10000, duration_minutes: 30 });
  expect(created.error).toBeNull();
  try {
    const availability = await db.from("service_branch_availability").insert({ organization_id: organizationId, branch_id: branchId, service_id: serviceId, is_available: false });
    expect(availability.error).toBeNull();
    await loginAsOwner(page, "automotive");
    await page.goto("/dashboard/queue/new");
    await selectRecord(page, "walk_in-customer-select", { name: "Automotive QA Customer" });
    await selectRecord(page, "walk_in-vehicle-select", { name: "Toyota" });
    await selectRecord(page, "walk_in-service-select", { name });
    const notes = `Rejected walk-in ${crypto.randomUUID()}`;
    await page.locator("#walk_in-customer-notes-input").fill(notes);
    await page.locator("#walk_in-save-button").click();
    await expect(page.locator("#walk-in-create-page").getByRole("alert")).toContainText("unavailable at this branch");
    await expect(page.locator("#walk_in-customer-select")).toHaveValue("Automotive QA Customer");
    await expect(page.locator("#walk_in-vehicle-select")).toHaveValue(/Toyota/);
    await expect(page.locator("#walk_in-customer-notes-input")).toHaveValue(notes);
    await expect(page.locator("#walk_in-selected-services")).toContainText(name);
    const rows = await db.from("appointments").select("id").eq("customer_note", notes);
    expect(rows.error).toBeNull(); expect(rows.data).toEqual([]);
    await page.locator(`#walk_in-service-${serviceId}-remove`).click();
    await selectRecord(page, "walk_in-service-select", { name: "QA Preventive Maintenance" });
    await page.locator("#walk_in-save-button").click();
    await expect(page).toHaveURL(/\/dashboard\/queue\?message=Walk-in/);
    const saved = await db.from("appointments").select("id").eq("customer_note", notes);
    expect(saved.error).toBeNull(); expect(saved.data).toHaveLength(1);
    await page.goto("/dashboard/queue/new");
    await page.locator("#walk_in-cancel-button").click();
    await expect(page).toHaveURL(/\/dashboard\/queue$/);
  } finally {
    await db.from("service_branch_availability").delete().eq("service_id", serviceId);
    await db.from("services").delete().eq("id", serviceId);
  }
});

});
}

test("simultaneous walk-ins receive distinct consecutive queue numbers", async () => {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const auth = await db.auth.signInWithPassword(qaPersonaCredentials("automotive"));
  expect(auth.error).toBeNull();
  try {
    const prefix = `Concurrent walk-in ${crypto.randomUUID()}`;
    const results = await Promise.all([0, 1, 2].map(index => db.rpc("create_walk_in", {
      p_branch_id: "de000000-0000-4000-8000-000000000002", p_customer_id: "de000000-0000-4000-8000-000000000003",
      p_vehicle_id: "de000000-0000-4000-8000-000000000009", p_service_ids: ["de000000-0000-4000-8000-000000000004"], p_notes: `${prefix} ${index}`,
    })));
    results.forEach(result => expect(result.error).toBeNull());
    const entries = await db.from("queue_entries").select("source,queue_number").in("appointment_id", results.map(result => result.data)).order("queue_number");
    expect(entries.error).toBeNull(); expect(entries.data).toHaveLength(3);
    const numbers = entries.data!.map(entry => entry.queue_number);
    expect(numbers).toEqual([numbers[0], numbers[0] + 1, numbers[0] + 2]);
    expect(entries.data!.every(entry => entry.source === "walk_in")).toBe(true);
  } finally { await db.auth.signOut(); }
});
