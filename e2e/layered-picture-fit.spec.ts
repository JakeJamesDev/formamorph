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

test('an entity gallery frame shows the whole Layered Image, never a stretched frame while it loads', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One layout is enough; the fit is the shared picture component');
  await page.setViewportSize({ width: 1400, height: 900 });
  await openApp(page);
  await page.evaluate(() => (window as unknown as { __fmDev: { goto: (v: string, o: object) => void } }).__fmDev.goto('mainMenu', { modal: 'layeredEditor', tab: 'entities' }));
  // Every frame from the click on: the frame picture's visible stack and its aspect.
  await page.evaluate(() => {
    const frames: { visible: boolean; ratio: number }[] = [];
    (window as unknown as { fitFrames: typeof frames }).fitFrames = frames;
    const tick = () => {
      const stack = document.querySelector('[data-layered-picture][aria-label="Uploaded"] [data-layer-stack]');
      if (stack) {
        const r = stack.getBoundingClientRect();
        frames.push({ visible: getComputedStyle(stack).visibility === 'visible' && r.height > 0, ratio: r.width / r.height });
      }
      if (frames.length < 120) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.getByText('Corin', { exact: true }).click();
  const picture = page.locator('[data-layered-picture][aria-label="Uploaded"]');
  await expect(picture.locator('[data-layer-stack]')).toBeVisible();

  const fit = await picture.evaluate((el) => {
    const canvas = el.querySelector('img')!;
    const box = el.getBoundingClientRect();
    const stack = el.querySelector('[data-layer-stack]')!.getBoundingClientRect();
    return { natural: canvas.naturalWidth / canvas.naturalHeight, box, stack: { width: stack.width, height: stack.height, top: stack.top, left: stack.left } };
  });
  // The frame is off the canvas aspect, so cover would crop and only contain keeps the whole picture.
  expect(Math.abs(fit.box.width / fit.box.height - fit.natural)).toBeGreaterThan(0.02);
  expect(fit.stack.width / fit.stack.height).toBeCloseTo(fit.natural, 2);
  expect(fit.stack.top).toBeGreaterThanOrEqual(fit.box.top - 0.5);
  expect(fit.stack.left).toBeGreaterThanOrEqual(fit.box.left - 0.5);
  expect(fit.stack.top + fit.stack.height).toBeLessThanOrEqual(fit.box.bottom + 0.5);
  expect(fit.stack.left + fit.stack.width).toBeLessThanOrEqual(fit.box.right + 0.5);

  const frames = await page.evaluate(() => (window as unknown as { fitFrames: { visible: boolean; ratio: number }[] }).fitFrames);
  expect(frames.some((f) => f.visible)).toBe(true);
  const stretched = frames.filter((f) => f.visible && Math.abs(f.ratio - fit.natural) > 0.01);
  expect(stretched).toEqual([]);
});
