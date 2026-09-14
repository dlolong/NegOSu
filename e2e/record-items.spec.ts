import { expect, test } from "@playwright/test";
import { renderFormFixture } from "./fixtures/form-browser";
test.use({ browserName: "chromium" });
let html: string;
test.beforeAll(async () => { html = await renderFormFixture("e2e/fixtures/record-items.tsx"); });
test.beforeEach(async ({ context }) => {
  await context.route("https://forms.test/**", route => route.fulfill({ contentType: "text/html", body: new URL(route.request().url()).pathname === "/fixture" ? html : "<h1>Record destination</h1>" }));
});
for (const card of [false, true]) {
  const url = `https://forms.test/fixture${card ? "?card=1" : ""}`;
  test(`${card ? "card" : "row"} opens from non-interactive content and keyboard link`, async ({ page }) => {
    await page.goto(url);
    await page.locator("#record-description").click();
    await expect(page).toHaveURL("https://forms.test/records/one");
    await page.goto(url);
    await page.locator("#record-primary").focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("https://forms.test/records/one");
  });
  test(`${card ? "card" : "row"} Edit and Delete operate independently`, async ({ page }) => {
    await page.goto(url);
    await page.locator("#record-delete").click();
    await expect(page.locator("#deleted-count")).toHaveText("Deleted: 1");
    await expect(page).toHaveURL(url);
    await page.locator("#record-edit").click();
    await expect(page).toHaveURL("https://forms.test/records/one/edit");
  });
}
test("card input, selection, checkbox and copied text do not open the record", async ({ page }) => {
  const url = "https://forms.test/fixture?card=1";
  await page.goto(url);
  await page.getByText("Select record", { exact: true }).click();
  await expect(page.locator("#record-checkbox")).toBeChecked();
  await page.locator("#record-note").fill("Draft");
  await page.locator("#record-select").selectOption("paused");
  await expect(page).toHaveURL(url);
  await page.locator("#record-description").evaluate(element => {
    const range = document.createRange(); range.selectNodeContents(element);
    window.getSelection()!.removeAllRanges(); window.getSelection()!.addRange(range);
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await expect(page).toHaveURL(url);
});
test("modified and middle row clicks open a separate tab", async ({ page }) => {
  await page.goto("https://forms.test/fixture");
  for (const options of [{ modifiers: ["ControlOrMeta" as const] }, { button: "middle" as const }]) {
    const popupPromise = page.context().waitForEvent("page");
    await page.locator("#record-description").click(options);
    const popup = await popupPromise;
    await expect(popup).toHaveURL("https://forms.test/records/one");
    await expect(page).toHaveURL("https://forms.test/fixture");
    await popup.close();
  }
});
test("service rows/cards open details and keep Edit at the right without View buttons", async ({ page }) => {
  await page.goto("https://forms.test/fixture?services=1");
  const primary = page.locator('[data-record-link]').filter({ visible: true });
  await expect(primary).toHaveCount(1);
  await expect(page.getByRole("link", { name: "View", exact: true })).toHaveCount(0);
  const edit = page.getByRole("link", { name: "Edit", exact: true }).filter({ visible: true });
  await expect(edit).toHaveCount(1);
  expect((await edit.boundingBox())!.x).toBeGreaterThan((await primary.boundingBox())!.x);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await edit.click();
  await expect(page).toHaveURL("https://forms.test/dashboard/services/one/edit");
});
