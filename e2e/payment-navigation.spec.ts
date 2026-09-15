import { test, expect, type Page } from "@playwright/test";
import { authenticatedSmokeEnabled, loginAsOwner } from "./helpers/auth";

test.use({browserName:"chromium",trace:"off"});
const local = (value: string | undefined) => !!value && ["localhost","127.0.0.1"].includes(new URL(value).hostname);
test.skip(!local(process.env.E2E_BASE_URL) || !authenticatedSmokeEnabled(), "Requires local authenticated fixtures.");
async function login(page: Page, industry: string) {
  if (industry !== "pet_care") return loginAsOwner(page,industry as "automotive"|"salon");
  await page.goto("/login");
  await page.locator("#negosu-login-email-input").fill(process.env.QA_PET_OWNER_EMAIL!);
  await page.locator("#negosu-login-password-input").fill(process.env.QA_OWNER_PASSWORD!);
  await page.locator("#negosu-login-submit-button").click();
  await expect(page.locator("#pet-care-dashboard")).toBeVisible();
}
for (const industry of ["automotive","salon","pet_care"]) {
  test(`${industry}: payment tabs, search, row navigation and responsive tables`, async ({page},info) => {
    test.setTimeout(120000);
    await login(page,industry);
    await page.goto("/dashboard/payments");
    await expect(page.locator("#payments-tab-outstanding")).toHaveAttribute("aria-current","page");
    await expect(page.locator("#payments-outstanding-table")).toBeVisible();
    await expect(page.locator("#payments-history-table")).toHaveCount(0);
    const totals=await page.locator("#payments-metrics").innerText();
    const customer=await page.locator('[id^="payments-document-"]').first().innerText();
    await page.locator("#payments-search-input").fill(customer);
    await page.locator("#payments-search-button").click();
    await expect(page.locator("#payments-search-results")).toContainText(customer);
    await expect(page.locator("#payments-metrics")).toHaveText(totals,{useInnerText:true});
    const row=page.locator("#payments-outstanding-table tbody tr").first();
    const href=await row.locator("a").getAttribute("href");
    // Clicking the balance cell follows the row's native record link.
    await row.locator("td").last().click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await page.goBack();
    await expect(page.locator("#payments-search-input")).toHaveValue(customer);
    await page.locator("#payments-tab-history").click();
    await expect(page.locator("#payments-tab-history")).toHaveAttribute("aria-current","page");
    await expect(page.locator("#payments-search-input")).toHaveValue(customer);
    await expect(page.locator("#payments-outstanding-table")).toHaveCount(0);
    await page.locator("#payments-search-clear").click();
    await expect(page.locator("#payments-search-input")).toHaveValue("");
    await expect(page.locator("#payments-history-table tbody tr").first()).toBeVisible();
    const historyLink=page.locator('[id^="payment-record-"]').first();
    const historyHref=await historyLink.getAttribute("href");
    await historyLink.click();await expect(page).toHaveURL(new RegExp(`${historyHref}$`));await page.goBack();
    await page.locator("#payments-search-input").fill("No matching payment fixture 914772");
    await page.locator("#payments-search-button").click();
    await expect(page.locator("#payments-history-empty")).toBeVisible();
    await expect(page.locator("#payments-history-table tbody tr")).toHaveCount(0);
    await page.locator("#payments-search-clear").click();
    await expect(page.locator("#payments-search-input")).toHaveValue("");
    await expect(page.locator("#payments-history-table tbody tr").first()).toBeVisible();
    for (const tab of ["history","outstanding"]) {
      await page.locator(`#payments-tab-${tab}`).click();
      await expect(page.locator(`#payments-tab-${tab}`)).toHaveAttribute("aria-current","page");
      await expect(page.locator(`#payments-${tab}-table tbody tr`).first()).toBeVisible();
      for(const width of [320,390,768,1024,1440]) {
        await page.setViewportSize({width,height:900});
        expect(await page.locator("#dashboard-main-content").evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
        expect(await page.locator(`#payments-${tab}-table`).evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
        if([320,1440].includes(width)) await page.screenshot({path:info.outputPath(`${tab}-${width}.png`)});
      }
    }
    if(industry==="pet_care") {
      await page.goto("/dashboard/pet-care/payments?tab=history&q=Core");
      await expect(page.locator("#pet-payments-list")).toBeVisible();
      await expect(page.locator("#payments-search-input")).toHaveValue("Core");
      await page.locator("#payments-tab-outstanding").click();
      await expect(page).toHaveURL(/\/dashboard\/pet-care\/payments\?tab=outstanding&q=Core/);
    }
    await page.goto("/dashboard/payments?tab=history&tab=outstanding&q=Core&q=ignored");
    await expect(page.locator("#payments-tab-history")).toHaveAttribute("aria-current","page");
    await expect(page.locator("#payments-search-input")).toHaveValue("Core");
  });
}
