import { expect, type Page } from "@playwright/test";
export async function selectRecord(page: Page, id: string, choice: { id: string } | { name: string }) {
 const input=page.locator(`#${id}`);
 await input.click();
 if("name" in choice) await input.fill(choice.name);
 const option="id" in choice?page.locator(`#${id}-option-${choice.id}`):page.locator(`#${id}-options`).getByRole("option").filter({hasText:choice.name}).first();
 await expect(option).toBeVisible();await option.click();
}
