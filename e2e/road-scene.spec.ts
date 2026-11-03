import { expect, test, type Page } from '@playwright/test';
import { gotoDev, openApp } from './app';

const TIERS = ['supporter', 'supporter_plus', 'supporter_top'] as const;
const NAMES = { supporter: 'Spark', supporter_plus: 'Flame', supporter_top: 'Beacon' };

interface Sample {
  t: number;
  height: number;
  fire: string | null;
  widgetTransforms: string[];
}

const stubTierReply = (page: Page) => page.route('**/patreon/tier-names', (route) => route.fulfill({
  json: { success: true, data: { ...NAMES, prices: { supporter: 500, supporter_plus: 1000, supporter_top: 2000 } } },
}));

async function openScene(page: Page, tier: string = 'supporter_plus') {
  await stubTierReply(page);
  await openApp(page);
  await gotoDev(page, 'mainMenu', { modal: 'road', tab: tier });
  // The dev pane chunk compiles on first use.
  await expect(page.locator('[data-road-stage]')).toBeVisible({ timeout: 60_000 });
  // The enter Jelly and the menu's loading work settle first: a loading menu starves the frames.
  await page.waitForTimeout(1500);
}

/** Records every frame for `ms` from the page. */
async function sampleFrames(page: Page, ms: number, picks: { at: number; name: string }[]): Promise<Sample[]> {
  return page.evaluate(({ ms, picks }) => new Promise<Sample[]>((resolve) => {
    const morphie = document.querySelector<HTMLElement>('[data-morphie]')!;
    const widgets = [...document.querySelectorAll<HTMLElement>('[role="dialog"], [role="dialog"] button, [role="radiogroup"], [data-road-stage]')];
    const samples: Sample[] = [];
    const start = performance.now();
    const pending = [...picks];
    const tick = () => {
      const t = performance.now() - start;
      while (pending.length && t >= pending[0].at) {
        const { name } = pending.shift()!;
        widgets.find((widget) => widget.getAttribute('role') === 'radio' && widget.textContent?.includes(name))?.click();
      }
      const transform = getComputedStyle(morphie).transform;
      samples.push({
        t,
        height: transform === 'none' ? 1 : new DOMMatrix(transform).d,
        fire: document.querySelector('[data-fire]')?.getAttribute('data-fire') ?? null,
        // The dialog's translate-x-0 computes to an identity matrix, which moves nothing.
        widgetTransforms: widgets.map((widget) => getComputedStyle(widget).transform).filter((value) => value !== 'none' && !new DOMMatrix(value).isIdentity),
      });
      if (t < ms) requestAnimationFrame(tick);
      else resolve(samples);
    };
    requestAnimationFrame(tick);
  }), { ms, picks });
}

test.describe('The Road scene motion', () => {
  test('a change dips, peaks and swaps at the dip, on Morphie only', async ({ page }) => {
    await openScene(page);
    const samples = await sampleFrames(page, 900, [{ at: 100, name: 'Beacon' }]);
    expect(samples.length).toBeGreaterThan(30);

    const running = samples.filter((sample) => sample.t >= 100);
    const dip = running.reduce((low, sample) => (sample.height < low.height ? sample : low));
    const peak = running.filter((sample) => sample.t > dip.t).reduce((high, sample) => (sample.height > high.height ? sample : high));
    expect(dip.height).toBeLessThan(0.84);
    expect(peak.height).toBeGreaterThan(1.1);

    // CHANGE_JELLY's dip lands at 560 / 4.5 ms; the swap follows within a few frames.
    const swap = running.find((sample) => sample.fire === 'supporter_top');
    expect(swap).toBeTruthy();
    expect(Math.abs(swap!.t - dip.t)).toBeLessThan(50);

    expect(samples.at(-1)!.height).toBe(1);
    expect(samples.flatMap((sample) => sample.widgetTransforms)).toEqual([]);
  });

  test('an interrupted change lands on the last pick, from the height on screen', async ({ page }) => {
    await openScene(page);
    // The second pick lands just before the first run's dip, when the height is far from normal.
    const samples = await sampleFrames(page, 1100, [{ at: 100, name: 'Beacon' }, { at: 210, name: 'Spark' }]);
    const steps = samples.slice(1).map((sample, index) => Math.abs(sample.height - samples[index].height));
    expect(Math.max(...steps)).toBeLessThan(0.14);
    expect(samples.at(-1)!.fire).toBe('supporter');
    expect(samples.at(-1)!.height).toBe(1);
    expect(samples.every((sample) => sample.fire !== 'supporter_top')).toBe(true);
  });

  test('reduced motion swaps at once and keeps the fire still', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openScene(page);
    const samples = await sampleFrames(page, 400, [{ at: 100, name: 'Beacon' }]);
    expect(samples.every((sample) => sample.height === 1)).toBe(true);
    const after = samples.filter((sample) => sample.t >= 150);
    expect(after.every((sample) => sample.fire === 'supporter_top')).toBe(true);
    expect(await page.locator('[data-fire] animate, [data-fire] .road-ember, [data-fire] .road-rays').count()).toBe(0);
  });
});

test('the scene stays dark under the light theme', async ({ page }) => {
  await openScene(page);
  const lightness = await page.evaluate(() => {
    document.documentElement.classList.remove('dark');
    const read = (element: Element) => {
      const [r, g, b] = getComputedStyle(element).backgroundColor.match(/[\d.]+/g)!.map(Number);
      return (r + g + b) / 3;
    };
    return { app: read(document.body), scene: read(document.querySelector('[role="dialog"]')!) };
  });
  expect(lightness.app).toBeGreaterThan(200);
  expect(lightness.scene).toBeLessThan(40);
});

test.describe('The Road scene layout', () => {
  for (const width of [1280, 375]) {
    test(`at ${width} the text clears the stage and every action is reachable`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 375 ? 812 : 800 });
      await openScene(page);
      for (const tier of TIERS) {
        await page.getByRole('radio', { name: NAMES[tier] }).click();
        await page.waitForTimeout(800);

        const stage = (await page.locator('[data-road-stage]').boundingBox())!;
        const title = (await page.getByRole('heading', { name: /Keep in Mind/ }).boundingBox())!;
        const picker = (await page.getByRole('radiogroup', { name: 'Level' }).boundingBox())!;
        expect(title.y + title.height).toBeLessThanOrEqual(stage.y);
        expect(stage.y + stage.height).toBeLessThanOrEqual(picker.y);

        for (const name of ['Keep Playing', 'Support on Patreon']) {
          const button = (await page.getByRole('button', { name }).boundingBox())!;
          expect(button.y + button.height).toBeLessThanOrEqual(page.viewportSize()!.height);
          expect(button.x + button.width).toBeLessThanOrEqual(width);
        }
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(0);

        // The menu's own toast arrives at any time and is not part of the scene.
        if (process.env.ROAD_FRAMES) await page.screenshot({ path: `.scratch/frames/road-${width}-${NAMES[tier].toLowerCase()}.png`, style: '[aria-label^="Notifications"] { display: none !important; }' });
      }
    });
  }
});
