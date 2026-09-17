import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { authenticatedSmokeEnabled, loginAsOwner } from "./helpers/auth";

test.use({ trace: "off" });
const local = (value?: string) => Boolean(value && ["localhost", "127.0.0.1"].includes(new URL(value).hostname));
test.skip(!authenticatedSmokeEnabled() || !local(process.env.E2E_BASE_URL) || !local(process.env.NEXT_PUBLIC_SUPABASE_URL), "Requires isolated local fixtures.");
const viewports = [{width:320,height:740},{width:375,height:812},{width:390,height:844},{width:430,height:932},{width:768,height:1024},{width:1366,height:768},{width:1440,height:900}];

async function checkDocument(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  const issues = await page.evaluate(() => {
    const ids = [...document.querySelectorAll("[id]")].map(node => node.id);
    const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
    const heavyText = [...document.querySelectorAll("h1,h2,h3,p,button,label,th,summary,strong")].filter(node => {
      const el = node as HTMLElement;
      return el.checkVisibility() && el.textContent?.trim() && Number(getComputedStyle(el).fontWeight) > 500;
    }).map(node => ({tag:node.tagName,id:node.id,weight:getComputedStyle(node).fontWeight}));
    return { duplicateIds, heavyText };
  });
  expect(issues.duplicateIds).toEqual([]);
  expect(issues.heavyText).toEqual([]);
}

for (const industry of ["automotive", "salon", "pet_care", "hospitality"] as const) {
  test(`${industry}: shared shell, staff and dialog at seven exact viewports`, async ({ page }, info) => {
    test.setTimeout(180000);
    if (industry === "automotive" || industry === "salon") await loginAsOwner(page, industry);
    else {
      await page.goto("/login");
      await page.locator("#negosu-login-email-input").fill(industry === "pet_care" ? process.env.QA_PET_OWNER_EMAIL! : "qa.hospitality.owner@negosu.local.test");
      await page.locator("#negosu-login-password-input").fill(process.env.QA_OWNER_PASSWORD!);
      await page.locator("#negosu-login-submit-button").click();
      if (industry === "hospitality") {
        const fixture = JSON.parse(readFileSync("/private/tmp/negosu-hospitality-fixture.json", "utf8"));
        await page.locator(`#negosu-business-option-${fixture.org}-select-button`).click();
      }
      await expect(page.locator("#dashboard-app-shell")).toBeVisible();
    }
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      for (const [name, path] of [["dashboard", "/dashboard"], ["staff", "/dashboard/settings/staff"], ["staff-dialog", "/dashboard/settings/staff?dialog=create"]]) {
        await page.goto(name === "dashboard" && industry === "pet_care" ? "/dashboard/pet-care" : path);
        await expect(page.locator("#dashboard-app-shell")).toBeVisible();
        const prefix = industry === "salon" ? "salon-staff" : "staff";
        if (name === "dashboard") await expect(page.locator(industry === "pet_care" ? "#pet-care-dashboard" : "#negosu-command-center-page")).toBeVisible();
        if (name === "staff") await expect(page.locator(`#${prefix}-page`)).toBeVisible();
        if (name === "staff-dialog") {
          await expect(page.locator(`#${prefix}-create-dialog`)).toBeVisible();
          await expect(page.locator(`#${prefix}-create-name-input`)).toBeVisible();
          await page.locator(`#${prefix}-create-save-button`).scrollIntoViewIfNeeded();
          await expect(page.locator(`#${prefix}-create-save-button`)).toBeInViewport();
        }
        await checkDocument(page);
        await page.screenshot({path:info.outputPath(`${name}-${viewport.width}.png`)});
      }
    }
  });
}
