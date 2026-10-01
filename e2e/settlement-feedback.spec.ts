import {expect,test} from '@playwright/test';
import {renderFormFixture} from './fixtures/form-browser';
let html:string;
test.beforeAll(async()=>{html=await renderFormFixture('e2e/fixtures/settlement.tsx');});
test.beforeEach(async({page})=>{
 await page.route('https://forms.test/**',route=>route.fulfill({contentType:'text/html',body:html}));
 await page.goto('https://forms.test/settlement');
});
test('discount selection recalculates final price, deposit total and change',async({page})=>{
 await expect(page.locator('#test-final-price')).toHaveValue('1000.00');
 await page.locator('#test-discount-type').selectOption('senior');
 await expect(page.locator('#test-discount-percent')).toHaveValue('20');
 await expect(page.locator('#test-final-price')).toHaveValue('800.00');
 await page.locator('#test-discount-card').fill('TEST-CARD');
 await page.locator('#test-deposit').fill('100');
 await page.locator('#test-tendered').fill('1000');
 await expect(page.locator('#test-change')).toContainText('100.00');
 await page.locator('#test-discount-percent').fill('25');
 await expect(page.locator('#test-final-price')).toHaveValue('750.00');
 await expect(page.locator('#test-change')).toContainText('150.00');
 await page.locator('#test-discount-percent').fill('101');
 await expect(page.locator('#test-submit')).toBeDisabled();
 await page.locator('#test-discount-percent').fill('');
 await expect(page.locator('#test-submit')).toBeDisabled();
 await page.locator('#test-discount-type').selectOption('none');
 await expect(page.locator('#test-final-price')).toHaveValue('1000.00');
 await page.locator('#test-discount-type').selectOption('manual');
 await expect(page.locator('#test-discount-percent')).toHaveValue('20');
 await page.locator('#test-method').selectOption('card');
 await expect(page.locator('input[name="tendered"]')).toHaveValue('900.00');
 await page.locator('#test-submit').click();
 await expect(page.locator('#test-submit')).toHaveAttribute('aria-busy','true');
 await expect(page.locator('#test-submit')).toContainText('Saving payment');
 await expect(page.locator('#test-submit')).toBeEnabled();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('shared submit and asynchronous action buttons show pending feedback then recover',async({page})=>{
 for(const id of ['plain-submit','async-action']){
  const button=page.locator(`#${id}`);
  await button.click();
  await expect(button).toHaveAttribute('aria-busy','true');
  await expect(button).toBeDisabled();
  await expect(button).toContainText('Processing');
  await expect(button).toBeEnabled();
  await expect(button).toHaveAttribute('aria-busy','false');
 }
});
