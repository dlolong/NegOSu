import { expect, test, type Page } from "@playwright/test";
import { renderFormFixture } from "./fixtures/form-browser";
let html: string;
const snapshot = { status: "open", branchId: "10000000-0000-4000-8000-000000000001", customerName: "Jane", remaining: 2, expiresAt: "2026-10-12T00:00:00Z", messages: [
  { id: "one", sender: "customer", body: "Can you help?", createdAt: "2026-10-05T02:00:00Z" },
  { id: "two", sender: "staff", body: "Of course. What would you like to know?", createdAt: "2026-10-05T02:01:00Z" },
] };
test.beforeAll(async () => { html = await renderFormFixture("e2e/fixtures/public-chat.tsx"); });
test.beforeEach(async ({ page }) => {
  await page.route("https://forms.test/**", route => route.fulfill({ contentType: "text/html", body: html }));
});
async function openChat(page: Page) {
  await page.goto("https://forms.test/chat");
  await page.locator("#public-chat-open").click();
}
async function enterContact(page: Page, method: "phone" | "email" = "phone") {
  await page.locator("#public-chat-topic-message").click();
  await expect(page.locator("#public-chat-message")).toHaveCount(0);
  await page.locator("#public-chat-name").fill("Jane");
  await page.locator(`#public-chat-contact-method-${method}`).check();
  await page.locator("#public-chat-contact").fill(method === "phone" ? "0917 123 4567" : "jane@example.test");
  await page.locator("#public-chat-contact-continue").click();
  await expect(page.locator("#public-chat-message")).toBeFocused();
}
test("quick answers stay separate from the contact-first message composer", async ({ page }) => {
  let calls = 0;
  await page.exposeFunction("recordFormAction", () => { calls++; return {}; });
  await openChat(page);
  await expect(page.locator("#public-chat-selected-question")).toHaveCount(0);
  await expect(page.locator("#public-chat-message-form")).toHaveCount(0);
  await page.locator("#public-chat-topic-hours").click();
  await expect(page.locator("#public-chat-answer")).toContainText("09:00–17:00");
  await page.locator("#public-chat-topic-location").click();
  await expect(page.locator("#public-chat-answer")).toContainText("123 Main Street");
  await enterContact(page);
  await expect(page.locator("#public-chat-quick-options")).toHaveCount(0);
  await page.locator("#public-chat-suggestion-booking").click();
  await expect(page.locator("#public-chat-message")).toHaveValue(/I'd like to book/);
  expect(calls).toBe(0);
  await page.keyboard.press("Escape");
  await expect(page.locator("#public-chat-dialog")).not.toBeVisible();
  await expect(page.locator("#public-chat-open")).toBeFocused();
});
for (const method of ["phone", "email"] as const) {
  test(`${method} contact is sent with the first message, with visible replies and timestamps`, async ({ page }) => {
    const starts: Record<string, unknown>[] = [];
    await page.exposeFunction("recordFormAction", (_name: string, input: Record<string, unknown>) => {
      if (input.operation === "start") starts.push(input);
      return { data: snapshot };
    });
    await openChat(page);
    await enterContact(page, method);
    await page.locator("#public-chat-message").fill("Can you help?");
    await page.locator("#public-chat-send").click();
    await expect(page.getByRole("log")).toContainText("Of course.");
    expect(starts).toHaveLength(1);
    expect(starts[0][method === "phone" ? "customerPhone" : "customerEmail"]).toBe(method === "phone" ? "0917 123 4567" : "jane@example.test");
    await expect(page.getByRole("log").locator("time")).toHaveCount(2);
    await expect(page.locator("#public-chat-message-limit")).toContainText("2 messages left");
    await expect(page.locator("#public-chat-contact-form")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const send = (await page.locator("#public-chat-send").boundingBox())!;
    expect(send.y + send.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  });
}
test("invalid contact cannot open the composer and editing retains the message draft", async ({ page }) => {
  let calls = 0;
  await page.exposeFunction("recordFormAction", () => { calls++; return {}; });
  await openChat(page);
  await page.locator("#public-chat-topic-message").click();
  await page.locator("#public-chat-name").fill("Jane");
  await page.locator("#public-chat-contact").fill("123");
  await page.locator("#public-chat-contact-continue").click();
  await expect(page.locator("#public-chat-contact-error")).toContainText("valid mobile");
  await expect(page.locator("#public-chat-message")).toHaveCount(0);
  await page.locator("#public-chat-contact").fill("09171234567");
  await page.locator("#public-chat-contact-continue").click();
  await page.locator("#public-chat-message").fill("Please keep my draft");
  await page.locator("#public-chat-edit-contact").click();
  await page.locator("#public-chat-contact-method-email").check();
  await page.locator("#public-chat-contact").fill("jane@example.test");
  await page.locator("#public-chat-contact-continue").click();
  await expect(page.locator("#public-chat-message")).toHaveValue("Please keep my draft");
  expect(calls).toBe(0);
});
test("failed first send keeps its draft and retry identity without polling a missing thread", async ({ page }) => {
  const requests: Record<string, unknown>[] = [];
  await page.exposeFunction("recordFormAction", (_name: string, input: Record<string, unknown>) => {
    requests.push(input);
    return requests.length === 1 ? { error: "Please try again." } : { data: snapshot };
  });
  await openChat(page);
  await enterContact(page);
  await page.locator("#public-chat-message").fill("Can you help?");
  await page.locator("#public-chat-send").click();
  await expect(page.locator("#public-chat-error")).toContainText("Please try again.");
  await expect(page.locator("#public-chat-message")).toHaveValue("Can you help?");
  expect(await page.evaluate(() => sessionStorage.getItem("negosu-chat:test"))).toBeNull();
  await page.locator("#public-chat-send").click();
  await expect(page.getByRole("log")).toContainText("Of course.");
  expect(requests[0].operation).toBe("start");
  expect(requests[1].operation).toBe("start");
  expect(requests[1].token).toBe(requests[0].token);
  expect(requests[1].requestId).toBe(requests[0].requestId);
});
test("restored legacy conversation skips onboarding and closed chats allow a fresh contact step", async ({ page }) => {
  await page.exposeFunction("recordFormAction", () => ({ data: { ...snapshot, status: "closed" } }));
  await page.goto("https://forms.test/chat");
  await page.evaluate(() => sessionStorage.setItem("negosu-chat:test", "a".repeat(64)));
  await page.locator("#public-chat-open").click();
  await expect(page.getByRole("log")).toContainText("Of course.");
  await expect(page.locator("#public-chat-contact-form")).toHaveCount(0);
  await expect(page.locator("#public-chat-limit-reached")).toContainText("closed");
  await page.locator("#public-chat-reset").click();
  await expect(page.locator("#public-chat-contact-form")).toBeVisible();
  await expect(page.locator("#public-chat-contact")).toBeEmpty();
});
test("contact and composer remain usable on a short mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 480 });
  await openChat(page);
  await enterContact(page);
  await page.locator("#public-chat-message").fill("Hello");
  const send = (await page.locator("#public-chat-send").boundingBox())!;
  expect(send.y).toBeGreaterThan(0);
  expect(send.y + send.height).toBeLessThanOrEqual(480);
  expect(await page.locator("#public-chat-transcript").evaluate(el => el.clientHeight)).toBeGreaterThan(0);
});
