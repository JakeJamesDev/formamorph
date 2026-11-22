import { expect, test } from '@playwright/test';
import { openApp } from './app';

/**
 * A Layered Image in a box its caller caps by percentage keeps the canvas aspect, as `object-contain` keeps an
 * image's. jsdom lays nothing out, so the boxes are measured here.
 */

// Short enough that the zoom viewer caps the 240 × 288 rig below its natural height.
test.use({ viewport: { width: 1000, height: 300 } });

test('the zoom viewer fits a Layered Image at its canvas aspect', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One layout is enough; the fit is the shared picture component');
  await page.route('**/v1/models', (route) => route.fulfill({ json: { data: [{ id: 'e2e-model' }] } }));
  await openApp(page, {}, { url: '/#dev?view=gameViewer&fixture=layeredImages' });
  await page.locator('[data-layered-picture][aria-label="Wren"]').first().click();
  const picture = page.getByRole('dialog').locator('[data-layered-picture]');
  await expect(picture.locator('[data-layer-stack]')).toBeVisible();

  const fit = await picture.evaluate((el) => {
    const canvas = el.querySelector('img')!;
    const box = el.getBoundingClientRect();
    const stack = el.querySelector('[data-layer-stack]')!.getBoundingClientRect();
    return {
      natural: canvas.naturalWidth / canvas.naturalHeight,
      naturalHeight: canvas.naturalHeight,
      box: box.width / box.height,
      boxHeight: box.height,
      stack: stack.width / stack.height,
    };
  });
  // The cap bites: the box is shorter than the canvas and off its aspect, which is when a stretch would show.
  expect(fit.boxHeight).toBeLessThan(fit.naturalHeight);
  expect(Math.abs(fit.box - fit.natural)).toBeGreaterThan(0.02);
  expect(fit.stack).toBeCloseTo(fit.natural, 2);
});
