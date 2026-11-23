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

/** The picture's on-screen rectangle, zoom and pan included. */
const pictureRect = (page: Page) => page.locator('[data-mask-view]').evaluate((el) => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
});

test('the wheel zooms toward the pointer and a middle-button drag pans', async ({ page }) => {
  await openEditor(page);
  const box = (await page.locator('[data-mask-paint]').boundingBox())!;
  const x = box.x + box.width * 0.3;
  const y = box.y + box.height * 0.6;
  await page.mouse.move(x, y);
  const fit = await pictureRect(page);
  await page.mouse.wheel(0, -400);
  await expect.poll(async () => Number(await page.locator('[data-mask-view]').getAttribute('data-mask-view'))).toBeGreaterThan(150);
  const zoomed = await pictureRect(page);
  expect(zoomed.width).toBeGreaterThan(fit.width * 1.5);
  // The picture point under the pointer stays put.
  expect((x - zoomed.left) / zoomed.width).toBeCloseTo((x - fit.left) / fit.width, 2);
  expect((y - zoomed.top) / zoomed.height).toBeCloseTo((y - fit.top) / fit.height, 2);
  await expect(page.locator('[data-mask-fit]')).toHaveText(/^\d+%$/);

  // Records whether a middle press could start the browser's autoscroll: a mousedown it did not cancel.
  await page.evaluate(() => {
    window.addEventListener('mousedown', (e) => {
      if (e.button === 1) (window as unknown as { middleOpen?: boolean }).middleOpen = !e.defaultPrevented;
    });
  });
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(x - 60, y - 40, { steps: 4 });
  await page.mouse.up({ button: 'middle' });
  const panned = await pictureRect(page);
  expect(panned.left - zoomed.left).toBeCloseTo(-60, 0);
  expect(panned.top - zoomed.top).toBeCloseTo(-40, 0);
  expect(await page.evaluate(() => (window as unknown as { middleOpen?: boolean }).middleOpen)).not.toBe(true);

  await page.keyboard.press('0');
  expect(await pictureRect(page)).toEqual(fit);
});

test('Ctrl + wheel sizes the brush, shows its value and leaves the page zoom alone', async ({ page }) => {
  await openEditor(page);
  const size = page.getByRole('slider', { name: 'Size' });
  const before = Number(await size.getAttribute('aria-valuenow'));
  const box = (await page.locator('[data-mask-paint]').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const ring = await page.locator('[data-mask-ring]').boundingBox();
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -300);
  await page.keyboard.up('Control');
  // The tip hides a second after the last change, so read it before anything slower.
  const tip = (await page.locator('[data-flash-tip]').textContent({ timeout: 900 }))!;
  const after = Number(await size.getAttribute('aria-valuenow'));
  expect(after).toBeGreaterThan(before);
  expect(tip).toBe(`${after} px`);
  expect((await page.locator('[data-mask-ring]').boundingBox())!.width).toBeGreaterThan(ring!.width);
  expect(await page.locator('[data-mask-view]').getAttribute('data-mask-view')).toBe('100');
  expect(await page.evaluate(() => window.visualViewport?.scale ?? 1)).toBe(1);
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
