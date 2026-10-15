import { test, expect, type Page } from "@playwright/test";
import { renderFormFixture } from "./fixtures/form-browser";
let html: string;
test.beforeAll(async () => { html = await renderFormFixture("e2e/fixtures/public-page-styles.tsx"); });
const pairs = { salon: "elegant", automotive: "precision", hospitality: "retreat", pet_care: "friendly" } as const;
async function open(page: Page, query: string) {
  await page.route("https://forms.test/**", route => route.fulfill({ contentType: "text/html", body: html }));
  await page.route("https://images.test/**", route => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="800"><rect width="1400" height="800" fill="#eac8b4"/><circle cx="1000" cy="360" r="240" fill="#946657"/><text x="50" y="80" font-size="40">Business image</text></svg>' }));
  await page.goto(`https://forms.test/styles?${query}`);
}
for (const [industry, style] of Object.entries(pairs)) {
  for (const width of [1440, 390, 320]) test(`${style} at ${width}px preserves catalog scrolling and working actions`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page, `industry=${industry}&photo=1`);
    await expect(page.locator("main[data-public-style]")).toHaveAttribute("data-public-style", style);
    await expect(page.locator("#public-automotive-shop-hero h1")).toBeVisible();
    const action = page.locator("#public-automotive-shop-book-button");
    await expect(action).toHaveAttribute("href", industry === "hospitality" ? "#public-shop-contact" : "/shop/example/book");
    await expect(page.locator("#public-shop-closing-action")).toHaveAttribute("href", industry === "hospitality" ? "#public-shop-contact" : "/shop/example/book");
    if (industry === "hospitality") await expect(page.locator("main").getByRole("link", { name: /Book/ })).toHaveCount(0);
    const rows = industry === "hospitality" ? ["Essentials"] : ["Care", "Essentials", "promos"];
    for (const label of rows) {
      const row = page.getByRole("region", { name: label, exact: true });
      await row.focus(); await page.keyboard.press("ArrowRight");
      await expect.poll(() => row.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await expect(page.getByText(/testimonial/i)).toHaveCount(0);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath(`${style}-${width}.png`), fullPage: false });
  });
  test(`${style} admin selection, live text preview, cancel, save and return to Standard`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await open(page, `industry=${industry}&admin=1`);
    await expect(page.getByRole("radio")).toHaveCount(2);
    await page.locator(`#public-page-style-radio-standard`).focus(); await page.keyboard.press("ArrowRight");
    await expect(page.locator(`#public-page-style-radio-${style}`)).toBeChecked();
    await page.locator("#public-page-hero-headline").fill("W".repeat(120));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator("#public-page-hero-headline").fill("Our custom welcome");
    await page.locator("#public-page-hero-position").selectOption("right");
    await expect(page.locator("#public-page-style-preview h1")).toHaveText("Our custom welcome");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator("#public-page-style-actions-cancel-button").click();
    await expect(page.locator("#public-page-style-radio-standard")).toBeChecked();
    await page.locator(`#public-page-style-option-${style}`).click();
    await expect(page.locator("#public-page-hero-headline")).toHaveValue("");
    await page.locator("#public-page-hero-headline").fill("Saved headline");
    await page.locator("#public-page-style-save-button").click();
    await expect(page.locator("body")).toHaveAttribute("data-saved-style", style);
    await expect(page.locator("#public-page-style-save-button")).toBeDisabled();
    await expect(page.locator("#public-page-style-save-button")).toBeEnabled();
    await expect(page.locator(`#public-page-style-radio-${style}`)).toBeChecked();
    await expect(page.locator("#public-page-style-preview h1")).toHaveText("Saved headline");
    await page.locator("#public-page-style-option-standard").click();
    await page.locator("#public-page-style-save-button").click();
    await expect(page.locator("body")).toHaveAttribute("data-saved-style", "standard");
    await expect(page.locator("#public-page-style-preview")).toHaveCount(0);
  });
}

for (const [industry, style] of Object.entries(pairs)) test(`${style} falls back when the cover image fails`, async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await open(page, `industry=${industry}&photo=1`);
  await page.route("https://images.test/cover.svg", route => route.abort());
  await page.reload();
  await expect(page.locator(".public-style-hero-placeholder")).toBeVisible();
  await expect(page.locator("#public-automotive-shop-book-button")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
