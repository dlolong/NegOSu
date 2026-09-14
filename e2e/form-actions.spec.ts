import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

test.use({ browserName: "chromium" });

// esbuild is the locked compiler dependency of the project's tsx test runner.
const projectRequire = createRequire(path.join(process.cwd(), "package.json"));
const { build } = createRequire(projectRequire.resolve("tsx/package.json"))("esbuild") as typeof import("esbuild");
let html: string;

test.beforeAll(async () => {
  const result = await build({
    entryPoints: ["e2e/fixtures/form-actions.tsx"], bundle: true, write: false, format: "iife", jsx: "automatic",
    alias: { "@": process.cwd() }, define: { "process.env.NODE_ENV": '"production"' },
    plugins: [{ name: "synthetic-form-boundaries", setup(builder) {
      builder.onResolve({ filter: /^next\/(link|navigation|image)$/ }, args => ({ path: args.path, namespace: "form-boundary" }));
      builder.onResolve({ filter: /^@\/app\/.*(?:actions|entity-actions)$/ }, args => ({ path: args.path, namespace: "form-boundary" }));
      builder.onLoad({ filter: /.*/, namespace: "form-boundary" }, args => {
        let contents: string;
        if (args.path === "next/link") contents = 'import React from "react"; export default function Link({replace,prefetch,...props}) { return React.createElement("a",props); }';
        else if (args.path === "next/image") contents = 'import React from "react"; export default function Image({unoptimized,fill,priority,...props}) { return React.createElement("img",props); }';
        else if (args.path === "next/navigation") contents = 'export function useRouter(){ return {replace: href => location.assign(href)}; }';
        else {
          const source = readFileSync(path.join(process.cwd(), args.path.replace("@/", "") + ".ts"), "utf8");
          const names = [...source.matchAll(/export async function (\w+)/g)].map(match => match[1]);
          contents = names.map(name => `export async function ${name}(data) { await window.recordFormAction(${JSON.stringify(name)}, data instanceof FormData ? [...data] : []); return {}; }`).join("\n");
        }
        return { contents, loader: "jsx", resolveDir: process.cwd() };
      });
    } }],
  });
  const postcss = projectRequire("postcss") as typeof import("postcss").default;
  const tailwind = projectRequire("@tailwindcss/postcss") as typeof import("@tailwindcss/postcss").default;
  const css = (await postcss([tailwind()]).process(readFileSync("app/globals.css", "utf8"), { from: path.resolve("app/globals.css") })).css;
  html = `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><main id="root" class="mx-auto max-w-3xl p-4"></main><script>${result.outputFiles[0].text}</script></body></html>`;
});

const mutations: string[] = [];
test.beforeEach(async ({ page }) => {
  mutations.length = 0;
  await page.exposeFunction("recordFormAction", (name: string) => { mutations.push(name); });
  await page.route("https://forms.test/**", route => route.fulfill({ contentType: "text/html", body: new URL(route.request().url()).pathname === "/fixture" ? html : '<h1 id="destination">Returned without saving</h1>' }));
});

for (const [fixture, cancelId, destination] of [
  ["customer", "customer-cancel-button", "/dashboard/customers?q=Ana"],
  ["customer-edit", "customer-cancel-button", "/dashboard/customers?q=Ana"],
  ["vehicle", "vehicle-cancel-button", "/dashboard/vehicles?q=Toyota"],
  ["vehicle-edit", "vehicle-cancel-button", "/dashboard/vehicles?q=Toyota"],
  ["customer-standalone-edit", "customer-cancel-button", "/dashboard/customers/customer-one"],
  ["vehicle-standalone-edit", "vehicle-cancel-button", "/dashboard/vehicles/vehicle-one"],
  ["branch", "branch-cancel-button", "/dashboard/settings/branches"],
  ["service", "service-cancel-button", "/dashboard/services"],
  ["appointment", "appointment-cancel-button", "/dashboard/appointments"],
  ["appointment-edit", "appointment-cancel-button", "/dashboard/appointments/appointment-one"],
  ["walk-in", "walk_in-cancel-button", "/dashboard/queue"],
  ["staff", "salon-staff-create-cancel-button", "/dashboard/settings/staff"],
]) {
  test(`${fixture} Cancel discards edits, navigates correctly, and stays right-aligned`, async ({ page }) => {
    await page.goto(`https://forms.test/fixture?fixture=${fixture}`);
    const cancel = page.locator(`#${cancelId}`);
    await cancel.scrollIntoViewIfNeeded();
    const row = cancel.locator("..");
    const submit = row.locator('button[type="submit"]');
    await expect(cancel.locator("svg")).toHaveCount(1);
    await expect(submit.locator("svg")).toHaveCount(1);
    expect(await row.evaluate(el => getComputedStyle(el).justifyContent)).toBe("flex-end");
    const box = await row.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    const input = page.locator('input:not([type="hidden"]):not([type="checkbox"])').first();
    await input.fill(""); // Cancel must also work when required fields are invalid.
    await cancel.click();
    await expect(page).toHaveURL(`https://forms.test${destination}`);
    expect(mutations).toEqual([]);
  });
}

test("Escape and the dialog close icon both dismiss without saving", async ({ page }) => {
  for (const method of ["escape", "close"]) {
    await page.goto("https://forms.test/fixture?fixture=customer");
    await expect(page.locator("#fixture-dialog")).toBeVisible();
    if (method === "escape") await page.keyboard.press("Escape");
    else await page.locator("#fixture-dialog-close-button").click();
    await expect(page).toHaveURL("https://forms.test/dashboard/customers?q=Ana");
  }
  expect(mutations).toEqual([]);
});

test("inline Cancel restores controlled branding input and preview without saving", async ({ page }) => {
  await page.goto("https://forms.test/fixture?fixture=branding");
  await page.locator("#settings-business-logo-url-input").fill("https://example.test/changed.svg");
  await page.locator("#settings-business-branding-actions-cancel-button").click();
  await expect(page.locator("#settings-business-logo-url-input")).toHaveValue("https://example.test/original.svg");
  expect(mutations).toEqual([]);
});

test("Save validates required fields, submits once, and disables actions while pending", async ({ page }) => {
  await page.goto("https://forms.test/fixture?fixture=pending");
  await page.locator("#pending-name").fill("");
  await page.locator("#pending-save").click();
  expect(mutations).toEqual([]);
  await page.locator("#pending-name").fill("Changed");
  await page.locator("#pending-actions-cancel-button").click();
  await expect(page.locator("#pending-name")).toHaveValue("Ana");
  await page.locator("#pending-save").click();
  await expect(page.locator("#pending-save")).toBeDisabled();
  await expect(page.locator("#pending-actions-cancel-button")).toBeDisabled();
  expect(mutations).toEqual(["savePending"]);
  await page.evaluate(() => window.releaseFormSave?.());
  await expect(page.locator("#save-success")).toBeVisible();
});

test("quick-create Cancel restores customer and vehicle selection without submitting the visit", async ({ page }) => {
  await page.goto("https://forms.test/fixture?fixture=quick-create");
  for (const kind of ["customer", "vehicle"]) {
    await page.locator(`#appointment-quick-${kind}-open-button`).click();
    await page.locator(`#appointment-quick-${kind}-cancel-button`).click();
    await expect(page.locator("#appointment-customer-select")).toHaveValue("customer-one");
    await expect(page.locator("#appointment-vehicle-select")).toHaveValue("vehicle-one");
  }
  expect(mutations).toEqual([]);
});

test("customer Save keeps the existing server action and customer field contract", async ({ page }) => {
  await page.goto("https://forms.test/fixture?fixture=customer");
  await page.locator("#customer-full-name-input").fill("New customer");
  await page.locator("#customer-save-button").click();
  await expect.poll(() => mutations).toEqual(["saveCustomer"]);
});
