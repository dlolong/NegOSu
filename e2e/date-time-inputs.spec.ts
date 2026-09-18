import { expect, test } from "@playwright/test";
import { renderFormFixture } from "./fixtures/form-browser";

let html: string;
test.beforeAll(async () => { html = await renderFormFixture("e2e/fixtures/date-time-inputs.tsx"); });
test.beforeEach(async ({ page }) => {
  await page.route("https://forms.test/**", route => route.fulfill({ contentType: "text/html", body: html }));
  await page.goto("https://forms.test/date-time");
});

test("native date/time controls and visible hints fit their form containers", async ({ page }) => {
  for (const [id, hint] of [
    ["date", "Select a date"], ["time", "Select a time"],
    ["datetime", "Select a date and time"], ["expiry", "Choose an expiry date"],
    ["month", "Select a month"], ["week", "Select a week"],
  ]) {
    await expect(page.locator(`#test-${id}-hint`)).toBeVisible();
    await expect(page.locator(`#test-${id}-hint`)).toHaveText(hint);
  }
  await expect(page.locator("#test-date")).toHaveAccessibleDescription("Choose a date in 2026. Select a date");
  await expect(page.locator("#test-date")).toHaveAccessibleName("Date");
  await expect(page.locator("#test-existing")).toHaveValue("2026-09-18T10:30");
  const bounds = await page.locator("input").evaluateAll(inputs => inputs.map(input => {
    const box = input.getBoundingClientRect();
    const label = input.closest("label")!.getBoundingClientRect();
    return { id: input.id, left: box.left - label.left, right: box.right - label.right, height: box.height };
  }));
  for (const bound of bounds) {
    expect(bound.left, bound.id).toBeGreaterThanOrEqual(-1);
    expect(bound.right, bound.id).toBeLessThanOrEqual(1);
    expect(bound.height, bound.id).toBeGreaterThanOrEqual(44);
  }
  expect(await page.locator("#date-time-form").evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("date-time-inputs.png"), fullPage: true });
});

test("native validation, submitted values, controlled edits, refs, and reset are preserved", async ({ page }) => {
  const date = page.locator("#test-date"), time = page.locator("#test-time");
  await page.locator("#date-time-submit").click();
  await expect(page.locator("#date-time-result")).toBeEmpty();
  expect(await date.evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
  await date.fill("2027-01-01");
  expect(await date.evaluate((input: HTMLInputElement) => input.validity.rangeOverflow)).toBe(true);
  await date.fill("2026-09-18");
  await time.fill("08:00");
  expect(await time.evaluate((input: HTMLInputElement) => input.validity.rangeUnderflow)).toBe(true);
  await time.fill("10:07");
  expect(await time.evaluate((input: HTMLInputElement) => input.validity.stepMismatch)).toBe(true);
  await time.fill("10:30");
  await page.locator("#test-datetime").fill("2026-09-20T14:45");
  await page.locator("#test-expiry").fill("2026-12-01");
  await expect(page.locator("#test-disabled")).toBeDisabled();
  await expect(page.locator("#test-readonly")).not.toBeEditable();
  await page.locator("#date-time-focus").click();
  await expect(page.locator("#test-expiry")).toBeFocused();
  await page.locator("#date-time-submit").click();
  expect(JSON.parse(await page.locator("#date-time-result").innerText())).toMatchObject({
    date: "2026-09-18", time: "10:30", datetime: "2026-09-20T14:45", existing: "2026-09-18T10:30", expiry: "2026-12-01", readonly: "2026-09-18",
  });
  await page.locator("#test-expiry").fill("");
  await expect(page.locator("#test-expiry-hint")).toBeVisible();
  await page.locator("#date-time-reset").click();
  await expect(date).toHaveValue("");
  await expect(time).toHaveValue("");
  await expect(page.locator("#test-datetime")).toHaveValue("");
  await expect(page.locator("#test-existing")).toHaveValue("2026-09-18T10:30");
  await expect(page.locator("#test-expiry")).toHaveValue("");
  await expect(page.locator("#test-date-hint")).toBeVisible();
});
