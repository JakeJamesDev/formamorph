import { expect, test, type Page } from '@playwright/test';

/**
 * The badge heart's beat, read from what the browser painted. jsdom has no animation, and the Browser
 * pane suspends rAF, so only a real page can say whether the icon moved. Each frame records the icon's
 * and the pill's computed transform; the specs then compare distinct values per time window.
 */

const PILL = 'section[aria-label="Light Theme"] .supporter-badge';
const BEAT_MS = 700;

type Frame = { t: number; icon: string | null; pill: string | null };

async function startSampling(page: Page): Promise<void> {
  await page.evaluate((selector) => {
    const w = window as unknown as { __frames: Frame[]; __sampling: boolean };
    w.__frames = [];
    w.__sampling = true;
    const tick = () => {
      if (!w.__sampling) return;
      const pill = document.querySelector<HTMLElement>(selector);
      const icon = pill?.querySelector<SVGElement>('.supporter-heart');
      w.__frames.push({
        t: performance.now(),
        icon: icon ? getComputedStyle(icon).transform : null,
        pill: pill ? getComputedStyle(pill).transform : null,
      });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, PILL);
}

async function stopSampling(page: Page): Promise<Frame[]> {
  return page.evaluate(() => {
    const w = window as unknown as { __frames: Frame[]; __sampling: boolean };
    w.__sampling = false;
    return w.__frames;
  });
}

const distinct = (frames: Frame[], key: 'icon' | 'pill') => new Set(frames.map((f) => f[key]));

/** Frames from `from` to `to` ms after the badge's first painted frame. */
const timeWindow = (frames: Frame[], t0: number, from: number, to: number) =>
  frames.filter((f) => f.t >= t0 + from && f.t < t0 + to);

/** The scale of each pulse: the top of every stretch of frames above rest. */
function pulsePeaks(frames: Frame[]): number[] {
  const peaks: number[] = [];
  let peak = 0;
  for (const { icon } of frames) {
    const scale = icon && icon !== 'none' ? Number(icon.match(/^matrix\(([^,]+),/)![1]) : 1;
    if (scale > 1.02) peak = Math.max(peak, scale);
    else if (peak) { peaks.push(peak); peak = 0; }
  }
  return peaks;
}

async function openReference(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('FORMAMORPH_introSeen', '1'));
  await page.goto('/#dev?modal=designSystem');
  await expect(page.locator('[data-design-system-showcase]')).toBeVisible();
  // Rest the pointer off the page content so no badge starts hovered.
  await page.mouse.move(1, 1);
  await startSampling(page);
  await page.getByRole('tab', { name: 'Supporter Flair', exact: true }).click();
  await expect(page.locator(PILL).first()).toBeVisible();
  await page.mouse.move(1, 1);
  await page.waitForTimeout(2200);
}

/** Beats the heart on hover: leaves the badge, enters it, and returns the frames of the next 800 ms. */
async function hoverFrames(page: Page): Promise<Frame[]> {
  await page.mouse.move(1, 1);
  await page.waitForTimeout(200);
  await startSampling(page);
  await page.locator(PILL).first().hover();
  await page.waitForTimeout(800);
  return stopSampling(page);
}

test('the heart beats on arrival, rests, and beats again on every hover', async ({ page }) => {
  await openReference(page);
  const frames = await stopSampling(page);
  const t0 = frames.find((f) => f.icon !== null)!.t;

  expect(distinct(timeWindow(frames, t0, 0, BEAT_MS), 'icon').size).toBeGreaterThan(1);
  expect(distinct(timeWindow(frames, t0, BEAT_MS + 100, BEAT_MS + 1100), 'icon').size).toBe(1);
  // The pill holds still while the icon beats.
  expect(distinct(frames.filter((f) => f.pill !== null), 'pill').size).toBe(1);

  expect(distinct(await hoverFrames(page), 'icon').size).toBeGreaterThan(1);
  expect(distinct(await hoverFrames(page), 'icon').size).toBeGreaterThan(1);
});

test('keyboard focus beats the heart', async ({ page }) => {
  await openReference(page);
  await stopSampling(page);
  await page.mouse.move(1, 1);
  await page.waitForTimeout(200);
  await startSampling(page);
  // Tab from just before the badge, so the focus is keyboard-made and :focus-visible applies.
  await page.locator(PILL).first().evaluate((el) => {
    const probe = document.createElement('button');
    probe.textContent = 'probe';
    el.parentElement!.insertBefore(probe, el);
    probe.focus();
  });
  await page.keyboard.press('Tab');
  await expect(page.locator(PILL).first()).toBeFocused();
  await page.waitForTimeout(800);

  expect(distinct(await stopSampling(page), 'icon').size).toBeGreaterThan(1);
});

test('the second pulse is smaller than the first', async ({ page }) => {
  await openReference(page);
  const [first, second, ...more] = pulsePeaks(await hoverFrames(page));

  expect(more).toEqual([]);
  expect(second).toBeLessThan(first - 0.1);
});

test('reduced motion skips the arrival beat and keeps the hover beat', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openReference(page);
  const frames = await stopSampling(page);

  expect(distinct(frames.filter((f) => f.icon !== null), 'icon').size).toBe(1);
  expect(distinct(await hoverFrames(page), 'icon').size).toBeGreaterThan(1);
});
