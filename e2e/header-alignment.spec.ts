import { expect, test, type Locator, type Page } from "@playwright/test";
import { renderFormFixture } from "./fixtures/form-browser";
test.use({ browserName: "chromium" });
let html: string;
test.beforeAll(async () => { html = await renderFormFixture("e2e/fixtures/header-alignment.tsx"); });
test.beforeEach(async ({ page }) => {
  await page.route("https://headers.test/**", route => route.fulfill({ contentType: "text/html", body: new URL(route.request().url()).pathname === "/fixture" ? html : "<h1>Destination</h1>" }));
});
async function aligned(content: Locator, action: Locator) {
  const text = (await content.boundingBox())!, button = (await action.boundingBox())!;
  if (button.x >= text.x + text.width - 1) expect(Math.abs(text.y + text.height / 2 - button.y - button.height / 2)).toBeLessThan(1.5);
  else expect(button.y).toBeGreaterThanOrEqual(text.y + text.height);
}
async function contained(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  for (const item of await page.locator("a:visible,button:visible").all()) {
    const box = (await item.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  }
}
for (const parameters of ["", "?long=1", "?long=1&nested=1"]) {
  test(`page and section action groups align vertically and stay right-aligned ${parameters}`, async ({ page }) => {
    await page.goto(`https://headers.test/fixture${parameters}`);
    for (const name of ["page", "section"]) {
      const header = page.locator(`#alignment-${name}-header`), content = page.locator(`#alignment-${name}-header-content`), actions = page.locator(`#alignment-${name}-header-actions`);
      await aligned(content, actions);
      const group = (await actions.boundingBox())!, parent = (await header.boundingBox())!;
      expect(Math.abs(group.x + group.width - parent.x - parent.width)).toBeLessThan(1.5);
    }
    const first = (await page.locator("#header-secondary").boundingBox())!, second = (await page.locator("#header-primary").boundingBox())!;
    if (second.x >= first.x + first.width) expect(Math.abs(first.y + first.height / 2 - second.y - second.height / 2)).toBeLessThan(1.5);
    await contained(page);
    if (!parameters) await page.screenshot({ path: test.info().outputPath("headers.png"), fullPage: true });
  });
}
test("category header aligns Add category beside its heading", async ({ page }) => {
  await page.goto("https://headers.test/fixture?category=1");
  await aligned(page.locator("#service-category-header-content"), page.locator("#service-category-add-button"));
  await contained(page);
});
test("dialog Close is vertically centered with its title and description", async ({ page }) => {
  await page.goto("https://headers.test/fixture?dialog=1");
  await aligned(page.locator("#alignment-dialog-header > div"), page.locator("#alignment-dialog-close-button"));
  await expect(page.getByRole("link", { name: /^Back/ })).toHaveCount(0);
  await contained(page);
  await page.locator("#alignment-dialog-close-button").click();
  await expect(page).toHaveURL("https://headers.test/fixture");
});
test("header actions fit constrained tablet and desktop content", async ({ page }) => {
  for (const width of [640, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("https://headers.test/fixture?long=1&nested=1");
    if (width >= 1024) await page.locator("#root").evaluate(element => { element.style.marginLeft = "260px"; });
    await aligned(page.locator("#alignment-page-header-content"), page.locator("#alignment-page-header-actions"));
    await contained(page);
  }
});
