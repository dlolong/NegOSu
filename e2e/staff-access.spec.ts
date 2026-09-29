import { expect, test } from "@playwright/test";
import { renderFormFixture } from "./fixtures/form-browser";

test.use({ browserName: "chromium" });
let html: string;
test.beforeAll(async () => { html = await renderFormFixture("e2e/fixtures/staff-access.tsx"); });
for (const industry of ["salon", "automotive", "pet_care", "hospitality"]) for (const mode of ["grant", "replace", "manage", "profile"]) {
  test(`${industry} ${mode} keeps fields and actions aligned and working`, async ({ page }) => {
    const submissions: Array<{ name: string; entries: Array<[string, string]> }> = [];
    await page.exposeFunction("recordFormAction", (name: string, entries: Array<[string, string]>) => { submissions.push({ name, entries }); });
    await page.route("https://staff.test/**", route => route.fulfill({ contentType: "text/html", body: new URL(route.request().url()).pathname === "/fixture" ? html : "<h1>Staff directory</h1>" }));
    const url = `https://staff.test/fixture?mode=${mode}&industry=${industry}`;
    await page.goto(url);
    const form = page.locator("#staff-form"), actions = page.locator("#staff-actions");
    await actions.scrollIntoViewIfNeeded();
    const formBox = (await form.boundingBox())!, row = (await actions.boundingBox())!;
    expect(Math.abs(row.x - formBox.x)).toBeLessThan(1);
    expect(Math.abs(row.width - formBox.width)).toBeLessThan(1);
    const fieldset = (await page.locator("#staff-branches").boundingBox())!;
    expect(Math.abs(fieldset.width - formBox.width)).toBeLessThan(1);
    for (const control of await page.locator('#staff-form input:not([type="hidden"]), #staff-form select, #staff-form button, #staff-form a').all()) {
      const box = (await control.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(formBox.x - 1);
      expect(box.x + box.width).toBeLessThanOrEqual(formBox.x + formBox.width + 1);
    }
    expect(await page.locator("#staff-dialog-content").evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    const cancel = page.locator("#staff-cancel-button"), save = page.locator("#staff-save-button");
    const cancelBox = (await cancel.boundingBox())!, saveBox = (await save.boundingBox())!;
    expect(Math.abs(saveBox.x + saveBox.width - row.x - row.width)).toBeLessThan(1);
    if (saveBox.x >= cancelBox.x + cancelBox.width) expect(Math.abs(cancelBox.y + cancelBox.height / 2 - saveBox.y - saveBox.height / 2)).toBeLessThan(1);
    else expect(saveBox.y).toBeGreaterThanOrEqual(cancelBox.y + cancelBox.height);
    if (industry === "salon" && mode === "grant") await page.screenshot({ path: test.info().outputPath("grant-access.png"), fullPage: true });
    await cancel.click();
    await expect(page).toHaveURL("https://staff.test/dashboard/settings/staff");
    expect(submissions).toEqual([]);
    await page.goto(url);
    await page.locator("#staff-branches-all-checkbox").check();
    await save.click();
    await expect.poll(() => submissions.length).toBe(1);
    expect(submissions[0].name).toBe(mode === "profile" ? "saveStaffProfile" : mode === "manage" ? "updateStaffProfileAccess" : "createStaffProfileInvitation");
    expect(submissions[0].entries).toContainEqual(["staffId", "staff-one"]);
    expect(submissions[0].entries).toContainEqual(["allBranches", "on"]);
  });
}

for (const industry of ["salon", "automotive"]) {
  test(`${industry} permission reference is quiet by default and keyboard expandable`, async ({ page }) => {
    await page.route("https://staff.test/**", route => route.fulfill({ contentType: "text/html", body: html }));
    await page.goto(`https://staff.test/fixture?mode=permissions&industry=${industry}`);
    const info = page.locator("#staff-permission-matrix"), details = page.locator("#staff-permission-details"), toggle = page.locator("#staff-permission-toggle");
    await expect(info).toHaveRole("complementary");
    await expect(info.getByRole("heading", { name: "About access permissions" })).toBeVisible();
    await expect(details).not.toHaveAttribute("open");
    await expect(info.getByRole("table")).not.toBeVisible();
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(details).toHaveAttribute("open");
    if (page.viewportSize()!.width >= 768) await expect(info.getByRole("table")).toBeVisible();
    else {
      const role = info.locator("details details").first();
      await role.locator("summary").click();
      await expect(role.locator("dl")).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
    await toggle.click();
    await expect(details).not.toHaveAttribute("open");
  });
}

for (const [industry, expected, excluded] of [
  ["hospitality", "Receptionist", ["Facialist", "Groomer", "Master Technician"]],
  ["pet_care", "Groomer", ["Facialist", "Housekeeper", "Master Technician"]],
  ["automotive", "Master Technician", ["Facialist", "Groomer", "Housekeeper"]],
  ["salon", "Facialist", ["Groomer", "Housekeeper", "Master Technician"]],
] as const) {
  test(`${industry} job functions are isolated and custom titles remain editable`, async ({ page }) => {
    await page.route("https://staff.test/**", route => route.fulfill({ contentType: "text/html", body: html }));
    await page.goto(`https://staff.test/fixture?mode=profile&industry=${industry}`);
    const select = page.locator("#staff-job-function-input");
    for (const value of excluded) await expect(select.locator("option", { hasText: value })).toHaveCount(0);
    await select.selectOption(expected);
    await expect(page.locator('input[name="jobFunction"]')).toHaveValue(expected);
    await select.selectOption("custom");
    await page.locator("#staff-job-function-custom").fill("Team Lead");
    await expect(page.locator('input[name="jobFunction"]')).toHaveValue("Team Lead");
    await select.selectOption("");
    await expect(page.locator('input[name="jobFunction"]')).toHaveValue("");
    await expect(page.locator("#staff-job-function-custom")).toHaveCount(0);
    await page.goto(`https://staff.test/fixture?mode=profile&industry=${industry}&jobFunction=Existing%20Title`);
    await expect(select).toHaveValue("custom");
    await expect(page.locator("#staff-job-function-custom")).toHaveValue("Existing Title");
  });
}

test("hospitality permission reference matches front-desk and cashier check-in access", async ({ page }) => {
  await page.route("https://staff.test/**", route => route.fulfill({ contentType: "text/html", body: html }));
  await page.goto("https://staff.test/fixture?mode=permissions&industry=hospitality");
  await page.locator("#staff-permission-toggle").click();
  await expect(page.locator("#staff-permission-details")).toContainText("Checkout only");
  const cashier = page.locator("#staff-permission-details tbody tr").filter({ hasText: "Cashier" });
  await expect(cashier.locator("td").nth(2)).toHaveText("Manage");
});
