import { expect, test, type Locator, type Page } from '@playwright/test';
import { gotoDev, openApp } from './app';

/** The Inventory Tab reference: a Greatsword in both hands, and a 240×720 Silver Ring whose box sits over Main Hand. */
const openReference = async (page: Page) => {
  await openApp(page);
  await gotoDev(page, 'mainMenu', { modal: 'designSystem', tab: 'inventory-tab' });
  const doll = page.locator('[data-body-doll]').first();
  await expect(doll).toBeVisible({ timeout: 60_000 });
  await doll.scrollIntoViewIfNeeded();
  return doll;
};

const rect = async (locator: Locator) => {
  const box = await locator.boundingBox();
  if (!box) throw new Error('not laid out');
  return box;
};

test.describe('Inventory doll', () => {
  test.slow();

  test('hover names an item with an image, and an empty box by its slot', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'only the desktop project hovers');
    const doll = await openReference(page);
    // A tip has no role. Each string shows nowhere else while the ring is worn and no popover is open.
    const itemTip = page.getByText('Silver Ring', { exact: true });
    const slotTip = page.getByText('Ring', { exact: true });
    await expect(itemTip).toHaveCount(0);
    await expect(slotTip).toHaveCount(0);
    await doll.getByRole('button', { name: 'Ring 1: Silver Ring' }).hover();
    await expect(itemTip).toBeVisible();
    await doll.getByRole('button', { name: 'Ring 2: Empty' }).hover();
    await expect(slotTip).toBeVisible();
  });

  test('an image keeps its aspect, its frame fits it, and a tap on the margin reaches the box below', async ({ page }) => {
    const doll = await openReference(page);
    const ringBox = await rect(doll.locator('[data-doll-box="Ring 1"]'));
    const ring = doll.getByRole('button', { name: 'Ring 1: Silver Ring' });
    await expect.poll(async () => { const r = await rect(ring); return r.width / r.height; }).toBeCloseTo(1 / 3, 1);
    const frame = await rect(ring);
    expect(frame.height).toBeCloseTo(ringBox.height, 0);
    expect(frame.width).toBeLessThan(ringBox.width / 2);

    await ring.click();
    await expect(page.getByRole('button', { name: 'Unequip Silver Ring' })).toBeVisible();
    await page.keyboard.press('Escape');

    // The left margin of Ring 1's box lies over Main Hand, which holds the Greatsword.
    const margin = { x: ringBox.x + 2, y: ringBox.y + ringBox.height / 2 };
    expect(margin.x).toBeLessThan(frame.x);
    await page.mouse.click(margin.x, margin.y);
    await expect(page.getByRole('button', { name: 'Unequip Greatsword' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Unequip Silver Ring' })).toHaveCount(0);
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`a Humanoid figure stays within the height cap and Carried starts below it in ${theme}`, async ({ page }, testInfo) => {
      const mobile = testInfo.project.name === 'mobile';
      const width = mobile ? 375 : 1440;
      await page.setViewportSize({ width, height: mobile ? 812 : 900 });
      await page.addInitScript((value) => localStorage.setItem('vite-ui-theme', value), theme);
      await openApp(page);
      await gotoDev(page, 'gameViewer', { tab: 'inventory', fixture: 'items' });
      // No spec makes an AI call, so the game opens on the unreachable endpoint's dialog.
      await page.getByRole('button', { name: 'Continue anyway' }).click({ timeout: 60_000 });
      if (mobile) await page.getByRole('button', { name: 'Status', exact: true }).click();
      const doll = page.locator('[data-body-doll]').first();
      await expect(doll).toBeVisible({ timeout: 60_000 });
      await page.getByRole('button', { name: 'Equip Greatsword' }).click();
      await page.getByRole('button', { name: 'Equip Silver Ring' }).first().click();
      await expect(doll.getByRole('button', { name: /: Greatsword$/ })).toHaveCount(2);
      await expect(doll.getByRole('button', { name: 'Ring 1: Silver Ring' })).toBeVisible();
      const figure = await rect(doll);
      expect(figure.height).toBeLessThanOrEqual(322);
      expect(figure.height).toBeGreaterThan(200);
      expect(figure.width / figure.height).toBeCloseTo(0.5, 1);
      const carried = await rect(page.getByText('Carried', { exact: true }).first());
      expect(carried.y).toBeGreaterThanOrEqual(figure.y + figure.height);
      await page.screenshot({ path: `.scratch/frames/inventory-doll-${theme}-${width}.png`, animations: 'disabled' });
    });
  }
});
