import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { openApp } from './app';

/** The Entity View slide: height, content size, chevron turn and tab movement, sampled every painted frame. */

const FRAMES_DIR = process.env.WINDOW_FRAMES_DIR;

interface Frame { t: number; section: number | null; content: number | null; angle: number; tabsTop: number }

async function openGame(page: Page) {
  await page.route('**/api/v0/models', (route) => route.fulfill({ status: 404 }));
  await page.route('**/v1/models', (route) => route.fulfill({ json: { data: [{ id: 'e2e-model' }] } }));
  await openApp(page, {}, { url: '/#dev?view=gameViewer&fixture=entityStats&tab=entities' });
  await page.getByRole('button', { name: 'Hide Entity View' }).waitFor();
  await expect(page.locator('img[alt]').first()).toBeVisible();
}

/** Click the toggle, then record every painted frame until `ms` has passed. */
async function clickAndSample(page: Page, ms: number): Promise<Frame[]> {
  return page.evaluate((duration) => new Promise<Frame[]>((resolve) => {
    const toggle = [...document.querySelectorAll('button')].find((b) => /Entity View$/.test(b.getAttribute('aria-label') ?? ''));
    if (!toggle) throw new Error('No Entity View toggle');
    const row = toggle.parentElement as HTMLElement;
    const svg = toggle.querySelector('svg') as SVGElement;
    const tabs = document.querySelector('[role="tablist"]') as HTMLElement;
    const frames: Frame[] = [];
    const read = (): Frame => {
      const section = row.nextElementSibling as HTMLElement | null;
      const content = section?.firstElementChild?.firstElementChild as HTMLElement | null | undefined;
      const transform = getComputedStyle(svg).transform;
      const m = transform === 'none' ? new DOMMatrix() : new DOMMatrix(transform);
      return {
        t: performance.now(),
        section: section ? section.getBoundingClientRect().height : null,
        content: content ? content.getBoundingClientRect().height : null,
        angle: Math.round((Math.atan2(m.b, m.a) * 180) / Math.PI + 360) % 360,
        tabsTop: tabs.getBoundingClientRect().top,
      };
    };
    frames.push(read());
    toggle.click();
    const start = performance.now();
    const tick = () => {
      frames.push(read());
      if (performance.now() - start < duration) requestAnimationFrame(tick); else resolve(frames);
    };
    requestAnimationFrame(tick);
  }), ms);
}

const rest = (page: Page) => page.waitForTimeout(400);

test('closing slides the section from full to 0 in about 200ms, then unmounts; opening slides it back', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The slide is desktop only');
  await openGame(page);

  const close = await clickAndSample(page, 600);
  const full = close[0].section as number;
  expect(full).toBeGreaterThan(100);
  const shrinking = close.filter((f) => f.section !== null);
  // Height falls monotonically to 0 and the section unmounts after.
  for (let i = 1; i < shrinking.length; i++) expect(shrinking[i].section as number).toBeLessThanOrEqual((shrinking[i - 1].section as number) + 0.5);
  expect(close[close.length - 1].section).toBeNull();
  const t0 = close[0].t;
  const done = close.find((f) => f.section === null || f.section < 1) as Frame;
  expect(done.t - t0).toBeGreaterThan(120);
  expect(done.t - t0).toBeLessThan(320);
  // The content never resizes, and the tabs move with the section by exactly its height.
  const sizes = new Set(shrinking.map((f) => Math.round(f.content as number)));
  expect(sizes.size).toBe(1);
  for (const f of shrinking) expect(Math.abs(f.tabsTop - (close[0].tabsTop - (full - (f.section as number))))).toBeLessThan(1.5);
  // The chevron ends down and rests there.
  expect(close[close.length - 1].angle).toBe(180);
  expect(close.some((f) => f.angle > 0 && f.angle < 180)).toBe(true);
  expect(close[close.length - 1].tabsTop).toBeCloseTo(close[0].tabsTop - full, 0);

  if (FRAMES_DIR) {
    mkdirSync(FRAMES_DIR, { recursive: true });
    await page.screenshot({ path: join(FRAMES_DIR, 'entity-view-collapsed.png'), clip: { x: 0, y: 0, width: 420, height: 600 } });
  }

  const open = await clickAndSample(page, 600);
  const growing = open.filter((f) => f.section !== null && f.section > 0);
  expect(open[open.length - 1].section).toBeCloseTo(full, 0);
  for (let i = 1; i < growing.length; i++) expect(growing[i].section as number).toBeGreaterThanOrEqual((growing[i - 1].section as number) - 0.5);
  expect(new Set(growing.map((f) => Math.round(f.content as number))).size).toBe(1);
  const reached = open.find((f) => f.section !== null && f.section >= full - 1) as Frame;
  expect(reached.t - open[0].t).toBeLessThan(400);
  expect(open[open.length - 1].angle).toBe(0);
  expect(open[open.length - 1].tabsTop).toBeCloseTo(close[0].tabsTop, 0);
  await expect(page.locator('img[alt]').first()).toBeVisible();
});

test('toggling quickly in both directions ends in the last requested state', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The slide is desktop only');
  await openGame(page);
  const toggle = (name: string) => page.getByRole('button', { name });

  // Odd count: hide, show, hide mid-slide.
  await toggle('Hide Entity View').click();
  await page.waitForTimeout(60);
  await toggle('Show Entity View').click();
  await page.waitForTimeout(60);
  await toggle('Hide Entity View').click();
  await rest(page);
  await expect(page.locator('img[alt]')).toHaveCount(0);
  await expect(toggle('Show Entity View')).toBeVisible();

  // Even count: show, hide, show.
  await toggle('Show Entity View').click();
  await page.waitForTimeout(60);
  await toggle('Hide Entity View').click();
  await page.waitForTimeout(60);
  await toggle('Show Entity View').click();
  await rest(page);
  await expect(page.locator('img[alt]').first()).toBeVisible();
  const height = await page.getByRole('button', { name: 'Hide Entity View' }).evaluate((el) => (el.parentElement?.nextElementSibling as HTMLElement).getBoundingClientRect().height);
  expect(height).toBeGreaterThan(100);
});

test('with reduced motion, the height and chevron change on the first frame', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The slide is desktop only');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openGame(page);

  const close = await clickAndSample(page, 100);
  expect(close[1].section).toBeNull();
  expect(close[1].angle).toBe(180);

  const open = await clickAndSample(page, 100);
  expect(open[1].section).toBeGreaterThan(100);
  expect(open[1].angle).toBe(0);
});
