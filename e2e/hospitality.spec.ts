import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { selectRecord } from "./helpers/searchable-select";
import { inputDateTimeInZone } from "../lib/operations";
import { readFileSync } from "node:fs";
test.use({ browserName: "chromium" });
const local = ["localhost", "127.0.0.1"].includes(new URL(process.env.E2E_BASE_URL ?? "http://localhost").hostname);
test.skip(!local || process.env.E2E_HOSPITALITY !== "1", "Explicitly enable against guarded local fixtures");
async function login(page: Page, role = "owner") {
  page.setDefaultTimeout(15000);
  await page.goto("/login");
  await page.locator("#negosu-login-email-input").fill(`qa.hospitality.${role}@negosu.local.test`);
  await page.locator("#negosu-login-password-input").fill("NegOSu-Local-QA-2026!");
  await page.locator("#negosu-login-submit-button").click();
  if (role === "owner") {
    const fixture = JSON.parse(readFileSync("/private/tmp/negosu-hospitality-fixture.json", "utf8"));
    await page.locator(`#negosu-business-option-${fixture.org}-select-button`).click();
  }
  await expect(page.locator("#dashboard-app-shell")).toBeVisible({ timeout: 20000 });
}
async function selectShift(page: Page, phase: "in" | "out") {
  await selectRecord(page, `hospitality-check-${phase}-cashier`, { name: phase === "in" ? "QA Receptionist" : "QA Caretaker" });
  await selectRecord(page, `hospitality-check-${phase}-housekeeper`, { name: phase === "in" ? "QA Caretaker" : "QA Receptionist" });
}
async function fetchInBrowser(page: Page, url: string) {
  return page.evaluate(async path => { const response = await fetch(path); return { status: response.status, text: await response.text() }; }, url);
}
async function noOverflow(page: Page) { expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); }
async function dialogChecks(page: Page, id: string) {
  const dialog = page.locator(`#${id}`); await expect(dialog).toBeVisible();
  expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflowY === "hidden" || getComputedStyle(document.body).overflowY === "hidden")).toBe(true);
  await noOverflow(page);
}
test("Apartelle front desk, optional contacts, collections, reports and responsive dialogs", async ({ page }, info) => {
  test.setTimeout(150000);
  if (info.project.name === "desktop-chromium") await page.setViewportSize({ width: 1366, height: 768 });
  const unique = `${info.project.name}-${Date.now()}`;
  await login(page);
  await expect(page.locator("#hospitality-overview-page")).toBeVisible();
  await noOverflow(page);
  await page.goto("/dashboard/customers?create=1");
  await dialogChecks(page, "hospitality-guest-form-dialog");
  await page.locator("#customer-full-name-input").fill(`Browser Guest ${unique}`);
  await page.locator("#customer-save-button").click();
  await expect(page.locator("#hospitality-guest-form-dialog")).toHaveCount(0);
  await expect(page.locator("#hospitality-guests-page")).toBeVisible();
  await page.goto("/dashboard/settings/staff?dialog=create");
  await dialogChecks(page, "staff-create-dialog");
  await page.locator("#staff-create-name-input").fill(`Browser Worker ${unique}`);
  await page.locator("#staff-create-job-function-input").fill("Caretaker");
  await page.locator("#staff-create-save-button").click();
  await expect(page.locator("#staff-create-dialog")).toHaveCount(0);
  await page.goto("/dashboard/hospitality/rooms?dialog=room");
  await dialogChecks(page, "hospitality-room-form-dialog");
  await page.locator("#hospitality-room-name").fill(`Browser ${unique}`);
  await page.locator("#hospitality-room-capacity").fill("2");
  await page.locator("#hospitality-rate-180-price").fill("800");
  await page.locator("#hospitality-room-submit").click();
  await expect(page.locator("#hospitality-room-form-dialog")).toHaveCount(0);
  await page.goto(`/dashboard/hospitality/bookings?dialog=manual&pickQ=${encodeURIComponent(`Browser ${unique}`)}`);
  await expect(page.locator("#hospitality-bookings-page")).toBeVisible();
  await page.locator("#hospitality-check-in-room-list").getByRole("link", { name: "Select room", exact: true }).click();
  await dialogChecks(page, "hospitality-check-in-dialog");
  await page.locator("#hospitality-check-in-date-time").fill(inputDateTimeInZone(new Date(Date.now() - 3600000), "Asia/Manila"));
  await noOverflow(page);
  await expect(page.locator("#hospitality-check-in-submit")).toBeDisabled();
  await page.locator("#hospitality-check-in-tendered").fill("1000");
  await expect(page.locator("#hospitality-check-in-change")).toContainText("200.00");
  await selectShift(page, "in");
  await page.locator("#hospitality-check-in-form").evaluate(form => (form as HTMLFormElement).reset());
  await expect(page.locator("#hospitality-check-in-cashier")).toHaveValue("QA Receptionist");
  await page.reload();
  await expect(page.locator("#hospitality-check-in-cashier")).toHaveValue("QA Receptionist");
  await expect(page.locator("#hospitality-check-in-housekeeper")).toHaveValue("QA Caretaker");
  await page.locator("#hospitality-check-in-tendered").fill("1000");
  await page.screenshot({ path: `/private/tmp/negosu-hospitality-validation/check-in-simplified-${info.project.name}.png`, fullPage: true });
  await page.locator("#hospitality-check-in-submit").click();
  await expect(page.locator("#hospitality-stay-details")).toBeVisible();
  const stayUrl = page.url().split("?")[0];
  await expect(page.locator("#hospitality-stay-shift-history")).toContainText("Cashier: QA Receptionist");
  await expect(page.locator("#hospitality-stay-payment-summary")).toContainText("Paid");
  await page.goto(`${stayUrl}?tab=charges&dialog=charge`);
  await dialogChecks(page, "hospitality-charge-dialog");
  await page.locator("#hospitality-charge-description").fill("Additional service");
  await page.locator("#hospitality-charge-amount").fill("1500");
  await page.locator("#hospitality-charge-submit").click();
  await expect(page.locator("#hospitality-charge-dialog")).toHaveCount(0);
  await page.locator("#hospitality-record-payment-button").click();
  await dialogChecks(page, "hospitality-payment-dialog");
  await page.locator("#hospitality-payment-amount").fill("500");
  await page.locator("#hospitality-payment-submit").click();
  await expect(page.locator("#hospitality-payment-dialog")).toHaveCount(0);
  await expect(page.locator("#hospitality-stay-payment-summary")).toContainText("Partially paid");
  await page.locator("#hospitality-check-out-button").click();
  await dialogChecks(page, "hospitality-check-out-dialog");
  await expect(page.locator("#hospitality-check-out-cashier")).toHaveValue("QA Receptionist");
  await expect(page.locator("#hospitality-check-out-housekeeper")).toHaveValue("QA Caretaker");
  await page.screenshot({ path: `/private/tmp/negosu-hospitality-validation/check-out-simplified-${info.project.name}.png`, fullPage: true });
  await page.locator("#hospitality-check-out-debt").check();
  await selectShift(page, "out");
  await page.locator("#hospitality-check-out-submit").click();
  await expect(page.locator("#hospitality-check-out-button")).toHaveCount(0);
  await expect(page.locator("#hospitality-stay-payment-summary")).toContainText("1,000.00");
  await page.goto("/dashboard/hospitality/bookings");
  await page.getByRole("link", { name: "Check In", exact: true }).first().click();
  await expect(page.locator("#hospitality-check-in-cashier")).toHaveValue("QA Caretaker");
  await expect(page.locator("#hospitality-check-in-housekeeper")).toHaveValue("QA Receptionist");
  await page.locator("#hospitality-check-in-actions-cancel-button").click();
  await page.goto("/dashboard/payments");
  await expect(page.locator("#hospitality-payments-page")).toBeVisible();
  await noOverflow(page);
  await page.goto(`${stayUrl}?tab=charges&dialog=payment`);
  await page.locator("#hospitality-payment-submit").click();
  await expect(page.locator("#hospitality-payment-dialog")).toHaveCount(0);
  await expect(page.locator("#hospitality-stay-payment-summary")).toContainText("Paid");
  await page.goto(`${stayUrl}/receipt`); await expect(page.locator("#hospitality-stay-statement")).toBeVisible(); await noOverflow(page);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("#hospitality-stay-statement")).toBeVisible();
  await expect(page.locator("#dashboard-header")).toBeHidden();
  await expect(page.locator("#negosu-sidebar")).toBeHidden();
  await page.emulateMedia({ media: "screen" });
  await page.goto("/dashboard/inventory"); await expect(page.locator("#salon-inventory-page")).toBeVisible(); await noOverflow(page);
  await page.goto("/dashboard/reports"); await expect(page.locator("#hospitality-reports-page")).toBeVisible(); await noOverflow(page);
  const download = await fetchInBrowser(page, "/dashboard/reports/export?section=outstanding&preset=today"); expect(download.status).toBe(200); expect(download.text).toContain("Outstanding now");
  await page.screenshot({ path: `/private/tmp/negosu-hospitality-validation/reports-${info.project.name}.png`, fullPage: true });
  await page.goto("/dashboard/hospitality/rooms?dialog=room"); await page.locator("#hospitality-room-actions-cancel-button").click(); await expect(page.locator("dialog[open]")).toHaveCount(0); await noOverflow(page);
  await page.screenshot({ path: `/private/tmp/negosu-hospitality-validation/rooms-${info.project.name}.png`, fullPage: true });
});
test("operational viewer has no financial report/export or payment access", async ({ page }) => {
  await login(page, "viewer");
  await expect(page.locator("#hospitality-bookings-page")).toBeVisible();
  await page.goto("/dashboard/reports"); await expect(page.locator("#hospitality-reports-page")).toBeVisible();
  await expect(page.locator("#hospitality-report-summary")).not.toContainText(/Collected|Outstanding/);
  const denied = await fetchInBrowser(page, "/dashboard/reports/export?section=collections&preset=today"); expect(denied.status).toBe(403);
  const fixture = JSON.parse(readFileSync("/private/tmp/negosu-hospitality-fixture.json", "utf8"));
  await page.goto(`/dashboard/hospitality/stays/${fixture.stays[2]}`); await expect(page.locator("#hospitality-stay-payment-summary")).toHaveCount(0);
  await page.goto("/dashboard/payments"); await expect(page.getByText("You do not have access to this page.", { exact: true })).toBeVisible();
});
test("workspace switching and Free export enforcement", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop-chromium", "Single authenticated switch regression");
  await page.setViewportSize({ width: 1366, height: 768 });
  await login(page);
  const fixture = JSON.parse(readFileSync("/private/tmp/negosu-hospitality-fixture.json", "utf8"));
  await page.locator("#negosu-business-switcher-select").selectOption(fixture.otherOrg);
  await page.locator("#negosu-business-switcher-submit-button").click();
  await expect(page.locator("#negosu-command-center-header")).toContainText("QA Other Inn");
  await page.goto("/dashboard/hospitality/bookings"); await expect(page.locator("#hospitality-booking-rooms")).toContainText("Other room"); await expect(page.locator("#hospitality-booking-rooms")).not.toContainText("Room 101");
  await page.goto("/dashboard/reports"); await expect(page.locator("#hospitality-reports-page")).toContainText("Free plan");
  expect((await fetchInBrowser(page, "/dashboard/reports/export?section=rooms&preset=today")).status).toBe(403);
  await page.locator("#negosu-business-switcher-select").selectOption(fixture.org); await page.locator("#negosu-business-switcher-submit-button").click();
  await expect(page.locator("#negosu-command-center-header")).toContainText("QA Apartelle & Inn");
});

test("old Hospitality setup bookmarks use standard onboarding", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop-chromium", "Single redirect regression");
  await login(page, "other");
  await page.goto("/onboarding/hospitality");
  await expect(page.locator("#hospitality-overview-page")).toBeVisible();
  await expect(page.locator("#negosu-command-center-header")).toContainText("QA Other Inn");
});

test("cashier checkout requires housekeeping before room becomes available", async ({ page }, info) => {
  test.setTimeout(90000);
  const roomName = `Cashier ${info.project.name}-${Date.now()}`;
  await login(page);
  await page.goto("/dashboard/hospitality/rooms?dialog=room");
  await page.locator("#hospitality-room-name").fill(roomName);
  for (const [period, price] of [[180, 800], [360, 1200], [720, 1800], [1440, 2500], [10080, 12000]]) {
    await page.locator(`#hospitality-rate-${period}-enabled`).check();
    await page.locator(`#hospitality-rate-${period}-price`).fill(String(price));
  }
  await page.locator("#hospitality-room-submit").click();
  await expect(page.locator("#hospitality-room-form-dialog")).toHaveCount(0);
  await page.context().clearCookies();
  await login(page, "cashier");
  await expect(page.locator("#hospitality-bookings-page")).toBeVisible();
  await expect(page.locator("#hospitality-add-room-button")).toHaveCount(0);
  await page.goto(`/dashboard/hospitality/bookings?q=${encodeURIComponent(roomName)}`);
  const row = page.locator("#hospitality-booking-rooms tr").filter({ hasText: roomName });
  await row.getByRole("link", { name: "Check In", exact: true }).click();
  await dialogChecks(page, "hospitality-check-in-dialog");
  await expect(page.locator("#hospitality-check-in-rate option")).toHaveCount(5);
  await page.locator("#hospitality-check-in-tendered").fill("700");
  await expect(page.locator("#hospitality-check-in-submit")).toBeDisabled();
  await expect(page.locator("#hospitality-check-in-payment-preview")).toContainText("Still needed");
  await page.locator("#hospitality-check-in-tendered").fill("1000");
  await expect(page.locator("#hospitality-check-in-change")).toContainText("200.00");
  await noOverflow(page);
  await page.screenshot({ path: `/private/tmp/negosu-hospitality-validation/cashier-${info.project.name}.png`, fullPage: true });
  await selectShift(page, "in");
  await page.locator("#hospitality-check-in-submit").click();
  await expect(page.locator("#hospitality-stay-details")).toBeVisible();
  const stayUrl = page.url();
  await expect(page.locator("#hospitality-stay-details")).toContainText("No name recorded");
  await expect(page.locator("#hospitality-arrival-cash-summary")).toContainText("200.00");
  await expect(page.locator("#hospitality-stay-period")).toContainText("3 hours");
  await noOverflow(page);
  await page.goto(`${stayUrl}/receipt`);
  await expect(page.locator("#hospitality-statement-payments")).toContainText("Cash received");
  await expect(page.locator("#hospitality-statement-payments")).toContainText("200.00");
  await noOverflow(page);
  await page.goto(stayUrl);
  await page.locator("#hospitality-check-out-button").click();
  await dialogChecks(page, "hospitality-check-out-dialog");
  await selectShift(page, "out");
  await page.locator("#hospitality-check-out-submit").click();
  await expect(page.locator("#hospitality-check-out-button")).toHaveCount(0);
  await page.goto(`/dashboard/hospitality/bookings?q=${encodeURIComponent(roomName)}`);
  await expect(page.locator("#hospitality-booking-rooms")).toContainText(roomName);
  await expect(page.locator("#hospitality-booking-rooms")).toContainText("Cleaning");
  await expect(page.getByRole("link", { name: "Check In", exact: true })).toHaveCount(0);
  await page.context().clearCookies();
  await login(page, "housekeeper");
  await page.goto(`/dashboard/hospitality/bookings?status=cleaning&q=${encodeURIComponent(roomName)}`);
  await expect(page.locator("#hospitality-booking-rooms")).toContainText("Cleaning");
  await expect(page.locator("#hospitality-add-room-button")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Check In", exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Mark as Ready", exact: true }).click();
  await dialogChecks(page, "hospitality-ready-dialog");
  await page.locator("#hospitality-ready-actions-cancel-button").click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await page.goto(`/dashboard/hospitality/bookings?status=cleaning&q=${encodeURIComponent(roomName)}`);
  await expect(page.getByRole("link", { name: "Mark as Ready", exact: true })).toBeVisible();
  await noOverflow(page);
  const readyIcon = await page.getByRole("link", { name: "Mark as Ready", exact: true }).locator("svg").boundingBox();
  expect(readyIcon!.width).toBeGreaterThanOrEqual(14);
  await page.screenshot({ path: `/private/tmp/negosu-hospitality-validation/cleaning-list-${info.project.name}.png`, fullPage: true });
  await page.getByRole("link", { name: "Mark as Ready", exact: true }).click();
  await dialogChecks(page, "hospitality-ready-dialog");
  await page.screenshot({ path: `/private/tmp/negosu-hospitality-validation/cleaning-${info.project.name}.png`, fullPage: true });
  await page.locator("#hospitality-ready-submit").click();
  await expect(page.locator("#hospitality-ready-dialog")).toHaveCount(0);
  await page.context().clearCookies();
  await login(page, "cashier");
  await page.goto(`/dashboard/hospitality/bookings?q=${encodeURIComponent(roomName)}`);
  await expect(page.locator("#hospitality-booking-rooms")).toContainText("Available");
  await page.getByRole("link", { name: "Check In", exact: true }).click();
  await page.locator("#hospitality-check-in-actions-cancel-button").click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
});


test("rooms show available, occupied and cleaning together with their actions", async ({ page }, info) => {
  test.setTimeout(90000);
  const dbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  expect(["localhost", "127.0.0.1"].includes(new URL(dbUrl).hostname)).toBe(true);
  const db = createClient(dbUrl, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  expect((await db.auth.signInWithPassword({ email: "qa.hospitality.owner@negosu.local.test", password: "NegOSu-Local-QA-2026!" })).error).toBeNull();
  const f = JSON.parse(readFileSync("/private/tmp/negosu-hospitality-fixture.json", "utf8"));
  const prefix = `Combined ${info.project.name}-${Date.now()}`;
  const ids: Record<string, string> = {};
  for (const status of ["Available", "Occupied", "Cleaning"]) {
    const rate = crypto.randomUUID();
    const room = await db.rpc("save_hospitality_room_with_rates", { p_org: f.org, p_branch: f.branch, p_room: null, p_name: `${prefix} ${status}`, p_type: "Test", p_description: "Local synthetic table regression", p_capacity: 2, p_active: true, p_expected_version: 0, p_rates: [{ id: rate, label: "3 hours", durationMinutes: 180, priceCentavos: 80000 }] });
    expect(room.error).toBeNull(); ids[status] = room.data;
    if (status !== "Available") {
      const stay = await db.rpc("check_in_hospitality_paid", { p_org: f.org, p_branch: f.branch, p_room: room.data, p_rate: rate, p_rates_version: 1, p_tendered: 80000, p_method: "cash", p_reference: "", p_occupants: 1, p_guest_name: "", p_guest: null, p_notes: "", p_request: crypto.randomUUID() });
      expect(stay.error).toBeNull();
      if (status === "Cleaning") expect((await db.rpc("check_out_hospitality", { p_org: f.org, p_branch: f.branch, p_stay: stay.data, p_acknowledge_debt: false })).error).toBeNull();
    }
  }
  await login(page);
  await page.goto(`/dashboard/hospitality/bookings?q=${encodeURIComponent(prefix)}`);
  await expect(page.locator("#hospitality-booking-rooms tbody tr")).toHaveCount(3);
  await expect(page.locator("#hospitality-bookings-tabs").getByRole("link")).toHaveCount(2);
  for (const [status, action] of [["Available", "Check In"], ["Occupied", "Check Out"], ["Cleaning", "Mark as Ready"]]) {
    const row = page.locator(`#hospitality-booking-room-${ids[status]}`);
    await expect(row).toContainText(status);
    await expect(row.getByRole("link", { name: action, exact: true })).toBeVisible();
    if (status !== "Available") await expect(row.getByRole("link", { name: "Check In", exact: true })).toHaveCount(0);
  }
  await noOverflow(page);
  await page.screenshot({ path: `/private/tmp/negosu-hospitality-validation/combined-rooms-${info.project.name}.png`, fullPage: true });
  await page.locator(`#hospitality-check-out-${ids.Occupied}`).click();
  await dialogChecks(page, "hospitality-check-out-dialog");
  await page.locator("#hospitality-check-out-actions-cancel-button").click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  // Status filtering narrows the operational room list.
  await page.goto(`/dashboard/hospitality/bookings?status=cleaning&q=${encodeURIComponent(prefix)}`);
  await expect(page.locator("#hospitality-booking-rooms tbody tr")).toHaveCount(1);
});

test("monthly discounts, receipt, hourly extension and refundable deposit lifecycle", async ({ page }, info) => {
  test.setTimeout(180000);
  if (info.project.name === "desktop-chromium") await page.setViewportSize({ width: 1366, height: 768 });
  const name = `Deposit ${info.project.name}-${Date.now()}`;
  await login(page);
  await page.goto("/dashboard/hospitality/rooms?dialog=room");
  await page.locator("#hospitality-room-name").fill(name);
  await page.locator("#hospitality-rate-180-price").fill("800");
  await page.locator("#hospitality-rate-43200-enabled").check();
  await page.locator("#hospitality-rate-43200-price").fill("12000");
  await page.locator("#hospitality-rate-43200-extension").fill("150");
  await noOverflow(page);
  await page.locator("#hospitality-room-submit").click();
  await expect(page.locator("#hospitality-room-form-dialog")).toHaveCount(0);
  await page.goto(`/dashboard/hospitality/bookings?q=${encodeURIComponent(name)}`);
  await page.locator("#hospitality-booking-rooms tr").filter({ hasText: name }).getByRole("link", { name: "Check In", exact: true }).click();
  await page.locator("#hospitality-check-in-rate").selectOption({ label: "Monthly · ₱12,000.00" });
  await page.locator("#hospitality-check-in-discount-type").selectOption("senior");
  await expect(page.locator("#hospitality-check-in-discount-percent")).toHaveValue("20");
  await expect(page.locator("#hospitality-check-in-final-price")).toHaveValue("9600.00");
  await page.locator("#hospitality-check-in-discount-card").fill("LOCAL-4321");
  await page.locator("#hospitality-check-in-deposit").fill("1000");
  await page.locator("#hospitality-check-in-receipt-details > summary").click();
  await page.locator("#hospitality-check-in-receipt-number").fill("PAPER-123");
  await page.locator("#hospitality-check-in-tendered").fill("12000");
  await expect(page.locator("#hospitality-check-in-change")).toContainText("1,400.00");
  await dialogChecks(page, "hospitality-check-in-dialog");
  await page.screenshot({ path: `/private/tmp/negosu-hospitality-validation/pricing-${info.project.name}.png`, fullPage: true });
  await selectShift(page, "in");
  await page.locator("#hospitality-check-in-submit").click();
  await expect(page.locator("#hospitality-stay-details")).toBeVisible();
  const stayUrl = page.url().split("?")[0];
  await expect(page.locator("#hospitality-stay-shift-history")).toContainText("Cashier: QA Receptionist");
  await expect(page.locator("#hospitality-stay-payment-summary")).toContainText("9,600.00");
  await expect(page.locator("#hospitality-deposit-summary")).toContainText("1,000.00");
  await expect(page.locator("#hospitality-agreed-price")).toContainText("4321");
  await page.locator("#hospitality-extend-button").click();
  await dialogChecks(page, "hospitality-extension-dialog");
  await page.locator("#hospitality-extension-actions-cancel-button").click();
  await expect(page.locator("#hospitality-extension-dialog")).toHaveCount(0);
  await page.locator("#hospitality-extend-button").click();
  await page.locator("#hospitality-extension-hours").fill("2");
  await expect(page.locator("#hospitality-extension-final-price")).toHaveValue("300.00");
  await page.locator("#hospitality-extension-discount-type").selectOption("manual");
  await expect(page.locator("#hospitality-extension-final-price")).toHaveValue("240.00");
  await page.locator("#hospitality-extension-tendered").fill("500");
  await page.locator("#hospitality-extension-receipt-details > summary").click();
  await page.locator("#hospitality-extension-receipt-number").fill("EXT-123");
  await expect(page.locator("#hospitality-extension-change")).toContainText("260.00");
  await noOverflow(page);
  await page.locator("#hospitality-extension-submit").click();
  await expect(page.locator("#hospitality-extension-dialog")).toHaveCount(0);
  await expect(page.locator("#hospitality-extension-table")).toContainText("EXT-123");
  await expect(page.locator("#hospitality-stay-payment-summary")).toContainText("9,840.00");
  await page.locator("#hospitality-edit-receipt-button").click();
  await page.locator("#hospitality-receipt-actions-cancel-button").click();
  await expect(page.locator("#hospitality-receipt-dialog")).toHaveCount(0);
  await page.locator("#hospitality-edit-receipt-button").click();
  await page.locator("#hospitality-stay-receipt-number").fill("PAPER-124");
  await page.locator("#hospitality-receipt-submit").click();
  await expect(page.locator("#hospitality-receipt-dialog")).toHaveCount(0);
  await page.goto(`${stayUrl}/receipt`);
  await expect(page.locator("#hospitality-stay-statement")).toContainText("PAPER-124");
  await expect(page.locator("#hospitality-statement-deposit")).toContainText("Held");
  await noOverflow(page);
  await page.goto(`${stayUrl}?dialog=checkout`);
  await dialogChecks(page, "hospitality-check-out-dialog");
  await selectShift(page, "out");
  await page.locator("#hospitality-check-out-submit").click();
  await expect(page.locator("#hospitality-check-out-dialog")).toBeVisible();
  await page.locator("#hospitality-deposit-refund-confirm").check();
  await page.locator("#hospitality-deposit-refund-reference").fill("RETURN-123");
  await selectShift(page, "out");
  await page.locator("#hospitality-check-out-submit").click();
  await expect(page.locator("#hospitality-check-out-dialog")).toHaveCount(0);
  await expect(page.locator("#hospitality-deposit-summary")).toContainText("Deposit returned");
  await expect(page.locator("#hospitality-stay-shift-history")).toContainText("Cashier: QA Caretaker");
  await expect(page.locator("#hospitality-stay-shift-history")).toContainText("Cashier: QA Receptionist");
  await expect(page.locator("#hospitality-check-out-button")).toHaveCount(0);
  await page.goto("/dashboard/payments?section=deposits");
  await expect(page.locator("#hospitality-report-summary")).toContainText("Deposits held now");
  await expect(page.locator("#hospitality-report-table")).toContainText(name);
  await noOverflow(page);
  const csv = await fetchInBrowser(page, "/dashboard/reports/export?section=deposits&preset=today");
  expect(csv.status).toBe(200); expect(csv.text).toContain("Deposits held now"); expect(csv.text).not.toContain("LOCAL-4321");
});


test("Apartelle owner can review monthly and yearly plan upgrades", async ({ page }, info) => {
  await login(page, "other");
  await expect(page.locator("#dashboard-plan-upgrade")).toHaveCount(0);
  await page.goto("/dashboard/reports");
  await page.locator("#hospitality-reports-plan-upgrade-button").click();
  await expect(page.locator("#billing-page")).toBeVisible();
  await page.locator("#billing-choose-plan-starter").click();
  await expect(page.locator("#billing-upgrade-page")).toBeVisible();
  await expect(page.locator("#billing-upgrade-total")).toBeVisible();
  await expect(page.locator("#billing-upgrade-error")).toHaveCount(0);
  await page.locator("#billing-upgrade-interval").selectOption("year");
  await page.locator("#billing-upgrade-update").click();
  await expect(page.locator("#billing-upgrade-interval")).toHaveValue("year");
  await expect(page.locator("#billing-upgrade-total")).toBeVisible();
  await noOverflow(page);
  await page.locator("#billing-upgrade-close").click();
  await expect(page.locator("#billing-page")).toBeVisible();
  await page.screenshot({ path: `/private/tmp/negosu-hospitality-validation/upgrade-${info.project.name}.png`, fullPage: true });
  // Review only: never open a provider session or collect a real payment.
});

test("shift defaults discard stale staff and survive unavailable browser storage", async ({ page }) => {
  await login(page);
  await page.goto("/dashboard/hospitality/bookings");
  await page.getByRole("link", { name: "Check In", exact: true }).first().click();
  await selectShift(page, "in");
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find(key => key.startsWith("negosu:shift-staff:v1:"))!;
    const stored = JSON.parse(localStorage.getItem(key)!);
    localStorage.setItem(key, JSON.stringify({ ...stored, cashierStaffId: "ffffffff-ffff-4fff-8fff-ffffffffffff" }));
  });
  await page.reload();
  await expect(page.locator("#hospitality-check-in-cashier")).toHaveValue("");
  await expect(page.locator("#hospitality-check-in-housekeeper")).toHaveValue("QA Caretaker");
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException("Storage disabled", "SecurityError"); }; });
  await selectShift(page, "in");
  await expect(page.locator("#hospitality-check-in-cashier")).toHaveValue("QA Receptionist");
  await page.locator("#hospitality-check-in-actions-cancel-button").click();
  await expect(page.locator("#hospitality-check-in-dialog")).toHaveCount(0);
  await page.getByRole("link", { name: "Check In", exact: true }).first().click();
  await expect(page.locator("#hospitality-check-in-cashier")).toHaveValue("QA Receptionist");
  await expect(page.locator("#hospitality-check-in-housekeeper")).toHaveValue("QA Caretaker");
  await noOverflow(page);
});

test("Bookings holds status/history while Rooms contains maintenance and room history", async ({ page }) => {
  await login(page);
  await page.goto("/dashboard/hospitality/bookings");
  await expect(page.locator("#hospitality-bookings-tabs-rooms")).toHaveAttribute("aria-current", "page");
  await expect(page.locator("#hospitality-booking-rooms")).toBeVisible();
  await page.locator("#hospitality-bookings-tabs-history").click();
  await expect(page.locator("#hospitality-stay-history-page")).toBeVisible();
  await page.goto("/dashboard/hospitality/rooms?tab=history&preset=custom&start=2026-01-01&end=2026-01-07");
  await expect(page).toHaveURL(/hospitality\/bookings/);
  await expect(page.getByText("Activity period: 2026-01-01 to 2026-01-07", { exact: true })).toBeVisible();
  await page.goto("/dashboard/hospitality/rooms");
  await expect(page.locator("#hospitality-room-grid").getByRole("columnheader", { name: "Status", exact: true })).toHaveCount(0);
  await expect(page.locator("#hospitality-rooms-sidebar")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Check In|Check Out|Mark as Ready/ })).toHaveCount(0);
  await page.locator('#hospitality-room-grid a[href*="/hospitality/rooms/"]').first().click();
  await expect(page.locator("#hospitality-room-details-page")).toBeVisible();
  await expect(page.locator("#hospitality-room-details")).toBeVisible();
  await expect(page.locator("#hospitality-room-details-dialog")).toHaveCount(0);
  await page.locator("#hospitality-room-tabs-history").click();
  await expect(page.locator("#hospitality-room-history")).toBeVisible();
  await page.locator("#hospitality-report-filter-panel-button").click();
  await page.locator("#hospitality-report-period").selectOption("7d");
  await page.locator("#hospitality-report-apply").click();
  await expect(page).toHaveURL(/tab=history.*preset=7d/);
  await expect(page.locator("#hospitality-room-history-table")).toBeVisible();
  await noOverflow(page);
});


test("Apartelle website settings show property information without appointment controls", async ({ page }) => {
  await login(page);
  await page.goto("/dashboard/settings/public-page");
  await expect(page.locator("#public-page-settings-header")).toContainText("Public website");
  await expect(page.locator("#public-page-profile-form")).toBeVisible();
  await expect(page.locator("#public-website-readiness-card")).toBeVisible();
  await expect(page.locator("#public-page-readiness-card")).toHaveCount(0);
  await noOverflow(page);
  await page.goto("/dashboard/settings/public-page?tab=locations");
  await expect(page.locator("#public-page-locations-title")).toHaveText("Locations");
  await page.locator('[id^="website-location-edit-"]').first().click();
  await expect(page.locator('[id^="public-branch-bookings-checkbox-"]')).toHaveCount(0);
  await expect(page.locator('[id^="public-branch-map-field-"]')).toBeVisible();
  await noOverflow(page);
});

test("read-only staff cannot use manual check-ins or manage the website", async ({ page }) => {
  await login(page, "viewer");
  for (const path of ["/dashboard/hospitality/bookings?dialog=manual", "/dashboard/settings/public-page"]) {
    await page.goto(path);
    await expect(page.locator("#negosu-not-found-page")).toBeVisible();
    await expect(page.locator("#hospitality-check-in-form")).toHaveCount(0);
    await expect(page.locator("#public-page-profile-form")).toHaveCount(0);
  }
});


test("completed emergency back-entry preserves the current booking and room links open check-in details", async ({ page }, info) => {
  test.setTimeout(120000);
  await login(page);
  const name = `Past ${info.project.name}-${Date.now()}`;
  await page.goto("/dashboard/hospitality/rooms?dialog=room");
  await page.locator("#hospitality-room-name").fill(name);
  await page.locator("#hospitality-rate-180-price").fill("800");
  await page.locator("#hospitality-room-submit").click();
  await expect(page.locator("#hospitality-room-form-dialog")).toHaveCount(0);
  await page.goto(`/dashboard/hospitality/bookings?q=${encodeURIComponent(name)}`);
  const checkIn = page.locator('[id^="hospitality-check-in-"]').filter({ hasText: "Check In" });
  const href = await checkIn.getAttribute("href");
  const roomId = new URL(href!, page.url()).searchParams.get("room")!;
  await checkIn.click();
  await page.locator("#hospitality-check-in-tendered").fill("800");
  await selectShift(page, "in");
  await page.locator("#hospitality-check-in-submit").click();
  await expect(page.locator("#hospitality-stay-details")).toBeVisible();
  const currentStay = page.url();
  await page.goto(`/dashboard/hospitality/bookings?dialog=manual&room=${roomId}`);
  await dialogChecks(page, "hospitality-check-in-dialog");
  await page.locator("#hospitality-check-in-date-time").fill(inputDateTimeInZone(new Date(Date.now() - 3 * 86400000), "Asia/Manila"));
  await page.locator("#hospitality-past-booking-checked-out").check();
  await page.locator("#hospitality-past-booking-checkout-time").fill(inputDateTimeInZone(new Date(Date.now() - 3 * 86400000 + 3 * 3600000), "Asia/Manila"));
  await page.locator("#hospitality-check-in-tendered").fill("800");
  await selectShift(page, "in");
  await selectRecord(page, "hospitality-past-checkout-cashier", { name: "QA Caretaker" });
  await selectRecord(page, "hospitality-past-checkout-housekeeper", { name: "QA Receptionist" });
  await noOverflow(page);
  await page.locator("#hospitality-check-in-submit").click();
  await expect(page.locator("#hospitality-stay-header")).toContainText("Checked out");
  await expect(page.locator("#hospitality-check-out-button")).toHaveCount(0);
  await page.goto(`/dashboard/hospitality/bookings?q=${encodeURIComponent(name)}`);
  const row = page.locator(`#hospitality-booking-room-${roomId}`);
  await expect(row).toContainText("Occupied");
  await row.getByRole("link", { name, exact: true }).click();
  await expect(page).toHaveURL(currentStay);
  await expect(page.locator("#hospitality-stay-details")).toBeVisible();
});
