import { expect, test } from "@playwright/test";
import { renderFormFixture } from "./fixtures/form-browser";
let html: string;
test.beforeAll(async () => { html = await renderFormFixture("e2e/fixtures/credit-reports.tsx"); });
for (const width of [320, 768, 1440]) test(`included paid reports, saved pagination, retry and CSV at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.route("https://forms.test/**", route => route.fulfill({ contentType: "text/html", body: html }));
  let posts = 0; const ids: string[] = [];
  await page.route("**/api/dashboard/credit-reports", async route => {
    const body = route.request().postDataJSON(); posts++; ids.push(body.requestId);
    if (posts === 1) return route.abort();
    return route.fulfill({ json: { id: body.requestId, payload: body.payload, cost: body.payload.maxCost, remaining: 100 - body.payload.maxCost, createdAt: "2026-10-15T12:00:00Z", report: { count: 51, summary: { records: 51, total: 51000, paid: 51000, balance: 0 }, rows: Array.from({ length: 51 }, (_, index) => ({ key: String(index), clientId: null, name: `Client ${index + 1}`, lastActivity: "2026-10-15", records: 1, branches: ["Main"], total: 1000, paid: 1000, balance: 0, staff: [{ id: "staff", name: "Jamie" }], items: [] })) } } });
  });
  await page.goto("https://forms.test/reports");
  await expect(page.locator("#credit-report-generate")).toHaveText("Apply filters");
  await page.locator("#reports-category-clients").click();
  await page.locator("#reports-filters-button").click();

  await expect(page.locator("#credit-report-kind, #credit-report-client, #reports-more-filters, #credit-report-section")).toHaveCount(0);
  expect(posts).toBe(0);
  await page.locator("#credit-report-generate").click();
  await expect(page.locator("#credit-report-error")).toContainText("Retry with the same filters");
  await page.locator("#credit-report-generate").click();
  await expect(page.locator("#trial-credit-balance")).toHaveCount(0);
  expect(ids[0]).toBe(ids[1]);
  await page.locator("#client-purchases-next").click();
  await expect(page.locator("#client-purchases-table")).toContainText("Client 51");
  expect(posts).toBe(2);
  await page.locator("#reports-filters-button").click();
  await page.locator("#credit-report-export").click();
  await expect(page.locator("#credit-report-download")).toHaveAttribute("href", /download=1/);
  await expect(page.locator("#trial-credit-balance")).toHaveCount(0);
  expect(ids[2]).not.toBe(ids[1]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.goto("https://forms.test/reports?empty=1&free=1");
  await expect(page.locator("#credit-report-generate")).toBeEnabled();
  await expect(page.locator("#credit-report-cost")).toHaveCount(0);
  await expect(page.locator("#reports-bookings-table")).toBeVisible();
  await expect(page.locator("#credit-report-generate")).toHaveAttribute("title", "Apply report filters");
  await page.locator("#reports-category-clients").click();
  await page.locator("#reports-filters-button").click();
  await page.locator("#credit-report-generate").click();
  await expect(page.locator("#credit-report-result")).toBeVisible();
  await expect(page.locator("#credit-report-result")).not.toContainText("remaining");
  await page.locator("#reports-filters-button").click();
  await page.locator("#credit-report-export").click();
  await expect(page.locator("#upgrade-dialog")).toBeVisible();
  await expect(page.locator("#credit-report-download")).toHaveCount(0);

  await page.goto("https://forms.test/reports?empty=1&paid=1");
  await expect(page.locator("#credit-report-generate")).toBeEnabled();
  await expect(page.locator("#credit-report-generate")).toHaveText("Apply filters");
});
test("paid image retry retains request key without credit charges", async ({ page }) => {
  await page.route("https://forms.test/**", route => route.fulfill({ contentType: "text/html", body: html }));
  const ids: string[] = [];
  await page.route("**/api/dashboard/images", async route => {
    if (route.request().method() === "GET") return route.fulfill({ json: { allowed: true, owner: true, organizationId: "org", cost: 0 } });
    const body = route.request().postData() ?? "";
    ids.push(body.match(/name="requestId"\r\n\r\n([^\r]+)/)?.[1] ?? "");
    if (ids.length === 1) return route.abort();
    return route.fulfill({ json: { url: "https://images.test/picture.png" } });
  });
  await page.goto("https://forms.test/reports?image=1");
  await expect(page.locator("#trial-image-file")).toBeAttached();
  await page.locator("#trial-image-file").setInputFiles({ name: "picture.png", mimeType: "image/png", buffer: Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]) });
  await expect(page.locator("#trial-image-retry")).toBeVisible();
  await page.locator("#trial-image-retry").click();
  await expect(page.locator("#trial-image")).toContainText("Uploaded. Save this form");
  expect(ids[0]).toBeTruthy(); expect(ids[0]).toBe(ids[1]);
  await expect(page.locator("#trial-image-upgrade")).toHaveCount(0);
});

test("table-first tabs and hidden popup filters do not charge on navigation", async ({page}) => {
 let posts=0;
 await page.setViewportSize({width:375,height:812});
 await page.route("https://forms.test/**",route=>route.fulfill({contentType:"text/html",body:html}));
 await page.route("**/api/dashboard/credit-reports",route=>{posts++;return route.fulfill({json:{}});});
 await page.goto("https://forms.test/reports?free=1");
 await expect(page.locator("#reports-bookings-table")).toBeVisible();
 await expect(page.locator("#reports-filters-popover")).toBeHidden();
 const tabs=await page.locator("#reports-view-tabs").boundingBox();
 const toolbar=await page.locator("#reports-toolbar").boundingBox();
 const results=await page.locator("#reports-main-content").boundingBox();
 expect(tabs!.y+tabs!.height).toBeLessThanOrEqual(toolbar!.y);
 expect(toolbar!.y+toolbar!.height).toBeLessThanOrEqual(results!.y);
 await expect(page.locator("#reports-filter-sidebar")).toHaveCount(0);
 await expect(page.locator("#reports-category-daily, #reports-view-saved, #reports-category-filters")).toHaveCount(0);
 for(const tab of ["bookings","payments","products","clients","services","staff"]) {
  await page.locator(`#reports-category-${tab}`).click();
  await expect(page.locator(`#reports-${tab}-table`)).toBeVisible();
 }
 await page.locator("#reports-filters-button").click();
 await expect(page.locator("#reports-filters-popover")).toBeVisible();
 await expect(page.locator("#reports-period-previous")).toHaveCount(0);
 await page.locator("#reports-period-month").click();
 await expect(page.locator("#credit-report-start")).toHaveValue("2026-10-01");
 await page.locator("#reports-reset-filters").click();
 await page.keyboard.press("Escape");
 await expect(page.locator("#reports-filters-popover")).toBeHidden();
 expect(posts).toBe(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test("salon filtered appointments retain details and payments show full-period totals",async({page})=>{
 await page.setViewportSize({width:375,height:812});
 await page.route("https://forms.test/**",route=>route.fulfill({contentType:"text/html",body:html}));
 await page.route("**/api/dashboard/credit-reports",route=>{
  const body=route.request().postDataJSON();
  return route.fulfill({json:{id:body.requestId,payload:body.payload,cost:1,remaining:99,createdAt:"2026-10-15T12:00:00Z",report:{summary:{grossSalesCentavos:15000,paymentsReceivedCentavos:12000},daily:[],services:[],categories:[],technicians:[],branches:[],salonDetails:{appointments:[{id:"visit",starts_at:"2026-10-15T00:00:00Z",timezone:"Asia/Manila",client:"Alex",staff:"Jamie",products:"Shampoo × 2",total:15000,status:"completed"}],payments:[{id:"receipt",paid_at:"2026-10-15T00:00:00Z",timezone:"Asia/Manila",method:"cash",status:"paid",amount:12000}]}}}});
 });
 await page.goto("https://forms.test/reports?free=1");
 await page.locator("#reports-filters-button").click();
 await page.locator("#credit-report-generate").click();
 await expect(page.locator("#credit-report-table")).toContainText("Alex");
 await expect(page.locator("#credit-report-table")).toContainText("Jamie");
 await expect(page.locator("#credit-report-table")).toContainText("Shampoo × 2");
 await expect(page.locator("#credit-report-table")).toContainText("150.00");
 await expect(page.locator("#reports-total-sales")).toContainText("150.00");
 await expect(page.locator("#credit-report-table-section")).toHaveCount(0);
 await page.locator("#reports-category-payments").click();
 await page.locator("#reports-filters-button").click();
 await page.locator("#credit-report-generate").click();
 await expect(page.locator("#reports-total-sales")).toContainText("150.00");
 await expect(page.locator("#reports-revenue-collected")).toHaveCount(0);
 await expect(page.locator("#credit-report-table")).not.toContainText("Total amount");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

for (const width of [320,1440]) test(`report search expands beside filters and searches loaded rows at ${width}px`,async({page})=>{
 let requests=0;
 await page.setViewportSize({width,height:900});
 await page.route("https://forms.test/**",route=>route.fulfill({contentType:"text/html",body:html}));
 await page.route("**/api/dashboard/credit-reports",route=>{requests++;return route.fulfill({json:{}});});
 await page.goto("https://forms.test/reports?free=1");
 await expect(page.locator("#reports-search-input")).toHaveCount(0);
 await expect(page.locator("#reports-toolbar #reports-search-button")).toBeVisible();
 await expect(page.locator("#reports-toolbar #reports-filters-button")).toBeVisible();
 await expect(page.locator("#reports-bookings-table-search")).toHaveCount(0);
 await page.locator("#reports-search-button").click();
 await expect(page.locator("#reports-search-input")).toBeFocused();
 await page.locator("#reports-search-input").fill("no matching name");
 await expect(page.locator("#reports-bookings-table-empty")).toHaveText("No matching records in this list.");
 await page.locator("#reports-search-input").fill("Example");
 await expect(page.locator("#reports-bookings-table")).toContainText("Example record");
 await page.keyboard.press("Escape");
 await expect(page.locator("#reports-search-input")).toHaveCount(0);
 await expect(page.locator("#reports-search-button")).toBeFocused();
 await page.locator("#reports-search-button").click();
 await page.locator("#reports-search-input").fill("no match");
 await page.locator("#reports-category-products").click();
 await expect(page.locator("#reports-search-input")).toHaveValue("");
 await expect(page.locator("#reports-products-table")).toContainText("Example record");
 await page.locator("#reports-search-close").click();
 await expect(page.locator("#reports-search-input")).toHaveCount(0);
 expect(requests).toBe(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

for(const industry of ["automotive","pet_care"]) test(`${industry} filtered bookings use vertical columns`,async({page})=>{
 await page.setViewportSize({width:375,height:812});
 await page.route("https://forms.test/**",route=>route.fulfill({contentType:"text/html",body:html}));
 await page.route("**/api/dashboard/credit-reports",route=>{
  const body=route.request().postDataJSON();
  return route.fulfill({json:{id:body.requestId,payload:body.payload,cost:1,remaining:99,createdAt:"2026-10-15T12:00:00Z",report:{summary:{grossSalesCentavos:15000,paymentsReceivedCentavos:12000},daily:[],services:[],categories:[],technicians:[],branches:[],bookingDetails:{industry,appointments:[{id:"visit",starts_at:"2026-10-15T00:00:00Z",timezone:"Asia/Manila",client:"Alex",staff:"Jamie",products:"Product × 2",total:15000,status:"completed"}],payments:[]}}}});
 });
 await page.goto(`https://forms.test/reports?free=1&industry=${industry}`);
 await page.locator("#reports-filters-button").click();await page.locator("#credit-report-generate").click();
 const table=page.locator("#credit-report-table");
 await expect(table).toContainText(industry==="automotive"?"Customer":"Pet owner");
 await expect(table).toContainText(industry==="automotive"?"Technicians":"Grooming staff");
 for(const value of ["Alex","Jamie","Product × 2"]) await expect(table).toContainText(value);
 await expect(table).toContainText("150.00");
 await expect(page.locator("#reports-total-sales")).toContainText("150.00");
 await expect(page.locator("#credit-report-table-section")).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

for(const category of ["promos","rooms"]) test(`${category} tab keeps prices and total cards above results`,async({page})=>{
 await page.setViewportSize({width:375,height:812});
 await page.route("https://forms.test/**",route=>route.fulfill({contentType:"text/html",body:html}));
 let posts=0;
 await page.route("**/api/dashboard/credit-reports",route=>{
  posts++;const body=route.request().postDataJSON();expect(body.payload.kind).toBe("catalog");expect(body.payload.section).toBe(category);
  return route.fulfill({json:{id:body.requestId,payload:body.payload,cost:1,createdAt:"2026-10-15T12:00:00Z",report:{category,count:1,summary:{amount:15000,revenue:12000},rows:[{id:"one",name:"Example",branch:"Main",status:"active",price:5000,rates:[{label:"3 hours",priceCentavos:5000}],amount:15000,revenue:12000}]}}});
 });
 await page.goto("https://forms.test/reports?free=1&industry=hospitality");
 await page.locator(`#reports-category-${category}`).click();expect(posts).toBe(0);
 await expect(page.locator(`#reports-${category}-table`)).toBeVisible();
 await page.locator("#reports-filters-button").click();await page.locator("#credit-report-generate").click();
 await expect(page.locator(`#reports-category-${category}`)).toHaveAttribute("aria-pressed","true");
 await expect(page.locator("#reports-total-sales")).toContainText("150.00");
 await expect(page.locator("#reports-revenue-collected")).toHaveCount(0);
 await expect(page.locator("#credit-report-table")).not.toContainText("Total amount");
 await expect(page.locator("#credit-report-table")).toContainText("50.00");
 const cards=await page.locator("#reports-payment-totals").boundingBox(),table=await page.locator("#credit-report-table").boundingBox();expect(cards!.y+cards!.height).toBeLessThanOrEqual(table!.y);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

for (const width of [320,1440]) test(`staff transactions have one total card and detail columns at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 await page.route("https://forms.test/**",route=>route.fulfill({contentType:"text/html",body:html}));
 await page.route("**/api/dashboard/credit-reports",async route=>{
  const body=route.request().postDataJSON();expect(body.payload.kind).toBe("staff");expect(body.payload.maxCost).toBe(0);
  await route.fulfill({json:{id:body.requestId,payload:body.payload,cost:0,remaining:0,createdAt:"2026-10-15T04:00:00Z",report:{rows:[{key:"appointment:work:taylor",staff:"Taylor",occurred_at:"2026-10-15T04:00:00Z",timezone:"Asia/Manila",transaction:"Grooming",client:"Alex",price:75000},{key:"appointment:work:morgan",staff:"Morgan",occurred_at:"2026-10-15T04:00:00Z",timezone:"Asia/Manila",transaction:"Grooming",client:"Alex",price:75000}]}}});
 });
 await page.goto("https://forms.test/reports");await page.locator("#reports-category-staff").click();
 await expect(page.locator("#reports-staff-table")).toContainText("Jamie 1");
 await expect(page.locator("#reports-main-content")).not.toContainText("Total revenue");
 await expect(page.locator("#reports-total-sales")).toContainText("25,500.00");
 await expect(page.locator("#reports-staff-table")).not.toContainText("Total amount");
 await page.locator("#reports-staff-next").click();await expect(page.locator("#reports-staff-table")).toContainText("Jamie 51");
 await page.locator("#reports-filters-button").click();await page.locator("#credit-report-generate").click();
 await expect(page.locator("#credit-report-table")).toContainText("Morgan, Taylor");await expect(page.locator("#credit-report-table")).toContainText("Grooming");
 await expect(page.locator("#credit-report-table")).toContainText("750.00");
 await expect(page.locator("#credit-report-result")).not.toContainText("Total revenue");
 await expect(page.locator("#reports-total-sales")).toContainText("750.00");
 await expect(page.locator("#credit-report-table")).not.toContainText("Total amount");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
