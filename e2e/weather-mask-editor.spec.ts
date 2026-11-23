import { expect, test, type Page } from '@playwright/test';
import { gotoDev, openApp } from './app';

/**
 * The brush editor's floating controls sit over the picture in a real browser: a click on a tool reaches the
 * tool, not the paint layer under it, and hovering a group brings it out of its resting fade. jsdom has no
 * stacking or hit testing, so this needs a browser.
 */

test.skip(({ hasTouch }) => hasTouch, 'touch stacks the controls outside the picture');

async function openEditor(page: Page) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openApp(page);
  await gotoDev(page, 'mainMenu', { modal: 'weatherMaskEditor', tab: 'edit' });
  await page.locator('[data-mask-box]').waitFor();
}

test('each floating control group takes the pointer over the picture', async ({ page }) => {
  await openEditor(page);
  for (const name of ['tools', 'card', 'actions']) {
    const group = page.locator(`[data-mask-group="${name}"]`);
    const inside = await group.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
    });
    expect(inside, `${name} group is under the paint layer`).toBe(true);
  }
});

test('a hovered group comes out of its fade and its buttons take clicks', async ({ page }) => {
  await openEditor(page);
  const tools = page.locator('[data-mask-group="tools"]');
  const eraser = page.getByRole('button', { name: 'Eraser' });
  await eraser.hover();
  await expect.poll(() => tools.evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
  await eraser.click();
  const card = page.locator('[data-mask-group="card"]');
  await page.getByRole('button', { name: 'Hide Mask' }).click();
  await expect(card.getByRole('button', { name: 'Show Mask' })).toBeVisible();
});
