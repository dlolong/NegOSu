import { expect, test } from "@playwright/test";
import { renderFormFixture } from "./fixtures/form-browser";
let html: string;
test.beforeAll(async () => { html = await renderFormFixture("e2e/fixtures/public-shop-navigation.tsx"); });
test.beforeEach(async ({ page }) => { await page.route("https://forms.test/**", route => route.fulfill({ contentType: "text/html", body: html })); });

test("public menu prioritizes offerings and fits each header breakpoint", async ({ page }) => {
  for (const width of [320, 390, 640, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("https://forms.test/navigation");
    const desktop = page.locator("#public-shop-section-navigation");
    const mobile = page.locator("#public-shop-mobile-actions");
    const nav = width < 640 ? mobile : desktop;
    await expect(nav).toBeVisible();
    await expect(width < 640 ? desktop : mobile).toBeHidden();
    await expect(nav.getByRole("link")).toHaveText(["Treatments", "Products", "Promos", "Locations", "Contact", "Gallery"]);
    await expect(page.locator("#public-shop-header-book-button")).toHaveAttribute("href", "/shop/test-shop/book");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const home = (await page.locator("#public-shop-home-link").boundingBox())!;
    const book = (await page.locator("#public-shop-header-book-button").boundingBox())!;
    expect(home.width).toBeGreaterThan(100);
    expect(home.x + home.width).toBeLessThanOrEqual(book.x);
    if (width >= 640) {
      const menu = (await nav.boundingBox())!;
      const links = await nav.getByRole("link").all();
      const boxes = await Promise.all(links.map(link => link.boundingBox()));
      expect(new Set(boxes.map(box => box!.y)).size).toBe(1);
      if (width >= 1024) {
        expect(menu.x).toBeGreaterThanOrEqual(home.x + home.width);
        expect(menu.x + menu.width).toBeLessThanOrEqual(book.x);
        expect(Math.abs(menu.y + menu.height / 2 - book.y - book.height / 2)).toBeLessThan(1);
      } else expect(menu.y).toBeGreaterThanOrEqual(home.y + home.height);
    }
    await nav.getByRole("link", { name: "Products", exact: true }).click();
    await expect(page).toHaveURL(/#public-shop-products$/);
  }
});

test("unavailable sections are omitted and visit action retains its destination", async ({ page }) => {
  await page.goto("https://forms.test/navigation?minimal=1");
  for (const id of ["public-shop-section-navigation", "public-shop-mobile-actions"]) {
    await expect(page.locator(`#${id}`).locator("a")).toHaveText(["Locations", "Contact"]);
  }
  await expect(page.locator("#public-shop-header-book-button")).toHaveText("Visit us");
  await expect(page.locator("#public-shop-header-book-button")).toHaveAttribute("href", "#public-automotive-shop-branches");
});

test("header stays pinned with a light shadow and anchors clear its height", async ({ page }) => {
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("https://forms.test/navigation");
    const header = page.locator("#public-shop-header");
    await expect(header).toHaveAttribute("data-scrolled", "false");
    await page.evaluate(() => window.scrollTo(0, 300));
    await expect(header).toHaveAttribute("data-scrolled", "true");
    expect((await header.boundingBox())!.y).toBe(0);
    await expect.poll(() => header.evaluate(el => getComputedStyle(el).boxShadow)).not.toBe("none");
    await page.locator(width < 640 ? "#public-mobile-products-button" : "#public-shop-products-nav").click();
    await expect(page).toHaveURL(/#public-shop-products$/);
    await expect.poll(async () => (await page.locator("#public-shop-products").boundingBox())!.y).toBeGreaterThanOrEqual((await header.boundingBox())!.height);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(header).toHaveAttribute("data-scrolled", "false");
  }
});
test("sections reveal once on scroll and reduced motion keeps content visible", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("https://forms.test/navigation");
  await page.evaluate(() => {
    const section = document.getElementById("public-shop-products")!;
    const original = section.animate.bind(section);
    section.animate = (...args) => { section.dataset.animationCount = String(Number(section.dataset.animationCount ?? 0) + 1); return original(...args); };
    window.scrollTo(0, section.offsetTop - 250);
  });
  await expect(page.locator("#public-shop-products")).toHaveAttribute("data-animation-count", "1");
  await expect.poll(() => page.locator("#public-shop-products").evaluate(el => getComputedStyle(el).opacity)).toBe("1");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator("#public-shop-products").scrollIntoViewIfNeeded();
  await expect(page.locator("#public-shop-products")).toHaveAttribute("data-animation-count", "1");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("https://forms.test/navigation");
  await page.locator("#public-shop-products").scrollIntoViewIfNeeded();
  expect(await page.locator("#public-shop-products").evaluate(el => el.getAnimations().length)).toBe(0);
  expect(await page.locator("#public-shop-products").evaluate(el => getComputedStyle(el).opacity)).toBe("1");
});
test("small-screen booking and basket fit together with a saved product count", async ({page})=>{
 await page.setViewportSize({width:320,height:800});
 await page.goto("https://forms.test/navigation");
 await page.evaluate(()=>{localStorage.setItem("negosu-basket:test-shop",JSON.stringify([{productId:"10000000-0000-4000-8000-000000000001",branchId:"20000000-0000-4000-8000-000000000001",quantity:"1"}]));window.dispatchEvent(new Event("negosu-basket-change"));});
 await expect(page.locator("#public-header-basket-link")).toHaveAccessibleName("View basket, 1 product");
 await expect(page.locator("#public-shop-header-book-button")).toHaveAccessibleName("Book");
 const book=(await page.locator("#public-shop-header-book-button").boundingBox())!;
 const basket=(await page.locator("#public-header-basket-link").boundingBox())!;
 expect(Math.abs(book.y-basket.y)).toBeLessThan(2);
 expect(basket.x).toBeGreaterThanOrEqual(book.x+book.width);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
