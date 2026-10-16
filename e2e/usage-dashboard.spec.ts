import {expect,test} from "@playwright/test";
import {renderFormFixture} from "./fixtures/form-browser";
let html:string;
test.beforeAll(async()=>{html=await renderFormFixture("e2e/fixtures/usage-dashboard.tsx");});
const org="81000000-0000-4000-8000-000000000001",branch="81000000-0000-4000-8000-000000000002",notice="81000000-0000-4000-8000-000000000008";
const usage={organizationId:org,remaining:10,allowance:100,oneTimeRemaining:10,reserved:0,monthlyRemaining:0,monthlyAllowance:0,nextRefresh:null,periodStart:null,periodKey:"one-time",status:"CRITICAL",count:0,history:[]};
for(const [width,height] of [[320,740],[375,812],[390,844],[430,932],[1366,768]])test(`usage, notifications, recovery and upgrade interactions ${width}x${height}`,async({page})=>{
 await page.setViewportSize({width,height});let recovered=false,read=false;
 await page.route("https://forms.test/**",route=>route.fulfill({contentType:"text/html",body:html}));
 await page.route("**/api/dashboard/credits**",route=>route.fulfill({json:recovered?{...usage,remaining:100,oneTimeRemaining:100,status:"NORMAL"}:usage}));
 await page.route("**/api/dashboard/notifications",route=>{
  if(route.request().method()==="POST"){read=true;return route.fulfill({json:{success:true}});}
  return route.fulfill({json:{organizationId:org,branchId:branch,total:read?0:1,items:[],unavailable:[],updatedAt:new Date().toISOString(),creditNotices:[{id:notice,kind:"CRITICAL",remaining:10,createdAt:"2026-10-16T00:00:00Z",readAt:read?"2026-10-16T01:00:00Z":null}]}});
 });
 await page.goto("https://forms.test/account");
 await expect(page.locator("#account-credit-remaining")).toContainText("10");
 await expect(page.locator("#account-credit-usage")).not.toContainText("Next refresh");
 await expect(page.locator("#account-credit-usage")).not.toContainText("monthly allowance");
 await page.locator("#account-credit-history-button").click();await expect(page.locator("#credit-usage-dialog")).toBeVisible();
 await expect(page.locator("#credit-usage-table-empty")).toContainText("No credit activity yet");
 await page.keyboard.press("Escape");await expect(page.locator("#account-credit-history-button")).toBeFocused();
 await page.locator("#dashboard-notification-bell").click();await page.locator(`#credit-notice-read-${notice}`).click();
 await expect(page.locator(`#credit-notice-${notice}`)).toContainText("Read");await page.locator("#dashboard-notification-close").click();
 await expect(page.locator("#fixture-upgrade-button")).toHaveCount(0);
 await expect(page.locator("#credit-critical-warning")).toHaveCount(0);
 await page.locator("#dashboard-notification-bell").click();
 await expect(page.locator("#plan-notice-advanced_reports-link")).toHaveAttribute("href","/dashboard/settings/billing#billing-plan-starter");
 await expect(page.locator("#plan-notice-advanced_reports")).toContainText("Starter includes");
 await page.locator("#dashboard-notification-close").click();
 recovered=true;await page.evaluate(()=>window.dispatchEvent(new Event("focus")));
 await expect(page.locator("#credit-critical-warning")).toHaveCount(0);
 await expect(page.locator("#account-credit-remaining")).toContainText("100");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
for(const vertical of ["automotive","salon","pet_care","hospitality"])for(const [width,height] of [[320,740],[375,812],[390,844],[430,932],[1366,768],[1440,900]])test(`${vertical} command center ${width}x${height}`,async({page})=>{
 await page.setViewportSize({width,height});await page.route("https://forms.test/**",route=>route.fulfill({contentType:"text/html",body:html}));
 await page.goto(`https://forms.test/dashboard?dashboard=1&vertical=${vertical}`);
 await expect(page.locator("#negosu-command-center-metrics").locator(":scope > *")).toHaveCount(6);
 await expect(page.locator("#negosu-operation-visit")).toContainText("Jamie");
 await expect(page.locator("#negosu-command-center-quick-action-new-appointment")).toHaveAttribute("href","/dashboard/appointments/new");
 await page.locator("#negosu-command-center-branch-selector").selectOption("all");
 await expect(page.locator("#negosu-command-center-branch-selector")).toHaveValue("all");
 expect(await page.locator("#command-center-workspace-sidebar").evaluate(el=>getComputedStyle(el).overflowY)).toBe("visible");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 if (vertical === "salon" && [375,1366].includes(width)) await page.screenshot({path:`/tmp/negosu-command-${width}.png`,fullPage:true});
 await expect(page.locator("#credit-critical-warning")).toHaveCount(0);
});
test("usage error recovery, pagination and configured monthly display",async({page})=>{
 await page.setViewportSize({width:390,height:844});let fail=true;
 await page.route("https://forms.test/**",route=>route.fulfill({contentType:"text/html",body:html}));
 await page.route("**/api/dashboard/notifications",route=>route.fulfill({json:{organizationId:org,branchId:branch,total:0,items:[],unavailable:[],updatedAt:new Date().toISOString()}}));
 await page.route("**/api/dashboard/credits**",route=>fail?route.fulfill({status:503,json:{error:"Unavailable"}}):route.fulfill({json:{...usage,remaining:22,oneTimeRemaining:10,monthlyRemaining:12,monthlyAllowance:12,nextRefresh:"2026-11-01T00:00:00Z",periodStart:"2026-10-01T00:00:00Z",periodKey:"synthetic-month",status:"NORMAL",count:26,history:[{id:"81000000-0000-4000-8000-000000000009",createdAt:"2026-10-16T00:00:00Z",activity:new URL(route.request().url()).searchParams.get("page")==="2"?"Earlier synthetic usage":"Synthetic configured period",amount:12,status:"GRANT"}]}}));
 await page.goto("https://forms.test/account?unavailable=1");await expect(page.locator("#account-credit-error")).toBeVisible();
 await page.locator("#account-credit-refresh").click();await expect(page.locator("#account-credit-error")).toContainText("Try again");
 fail=false;await page.locator("#account-credit-refresh").click();await expect(page.locator("#account-credit-remaining")).toContainText("22");
 await expect(page.locator("#account-credit-usage")).toContainText("12 / 12 included period credits");
 await expect(page.locator("#account-credit-usage")).toContainText("Next refresh (UTC)");
 await page.locator("#account-credit-history-button").click();await page.locator("#credit-usage-next").click();await expect(page.locator("#credit-usage-table")).toContainText("Earlier synthetic usage");
 await page.locator("#credit-usage-close").click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test("all-branch overview asks for a branch before operational work",async({page})=>{
 await page.route("https://forms.test/**",route=>route.fulfill({contentType:"text/html",body:html}));
 await page.goto("https://forms.test/dashboard?dashboard=1&vertical=pet_care&all=1");
 await expect(page.locator("#negosu-command-center-quick-action-new-appointment")).toHaveCount(0);
 await expect(page.locator("#negosu-command-center-quick-actions-branch-guidance")).toContainText("Select a branch");
 await expect(page.locator("#negosu-action-item-work")).toHaveAttribute("href","#negosu-command-center-branch-selector");
});

test("dashboard warning is dismissible, updates after recovery and stays off normal dashboards",async({page})=>{
 await page.setViewportSize({width:320,height:740});let dismissed=false,recovered=false;
 await page.route("https://forms.test/**",route=>route.fulfill({contentType:"text/html",body:html}));
 await page.route("**/api/dashboard/credits**",route=>route.fulfill({json:usage}));
 await page.route("**/api/dashboard/notifications",route=>{
  if(route.request().method()==="POST"){dismissed=true;return route.fulfill({json:{success:true}});}
  return route.fulfill({json:{organizationId:org,branchId:branch,total:0,items:[],unavailable:[],creditNotices:recovered?[]:[{id:notice,kind:"EMPTY",remaining:0,createdAt:"2026-10-16T00:00:00Z",readAt:dismissed?"2026-10-16T01:00:00Z":null,nextRefresh:null}]}});
 });
 await page.goto("https://forms.test/account?pathname=/dashboard");
 await expect(page.locator("#credit-empty-notice")).toContainText("Starter credits do not refresh");
 await expect(page.locator("#dashboard-credit-view-usage")).toHaveAttribute("href","/dashboard/settings/billing#account-credit-usage");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.locator("#dashboard-credit-dismiss").click();await expect(page.locator("#credit-empty-notice")).toHaveCount(0);
 await page.reload();await expect(page.locator("#credit-empty-notice")).toHaveCount(0);
 dismissed=false;recovered=true;await page.evaluate(()=>window.dispatchEvent(new Event("negosu-usage-changed")));
 await expect(page.locator("#credit-empty-notice")).toHaveCount(0);
});
