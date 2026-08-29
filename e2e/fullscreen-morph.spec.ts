import { test, expect } from '@playwright/test';
import { openApp, openPromptEditor, chrome } from './app';

/**
 * The full-screen morph, measured rather than eyeballed. jsdom cannot see any of this (no layout, no
 * animation clock), and a DOM snapshot cannot either — a class can be present while the paint is a
 * single instant jump. These specs record the window's computed style per animation frame across a
 * toggle and assert the timeline itself: intermediate values must exist, not just the end states.
 */

/** Per-frame record of the fullscreen window, taken inside the page. */
interface Sample {
  t: number;
  opacity: number;
  transform: string;
  /** A docked "Edit full screen" toggle exists outside the window — the panel is back underneath. */
  docked: boolean;
}

declare global {
  interface Window {
    __morphRec?: Sample[];
  }
}

/** Start recording one sample per animation frame until `ms` have passed. */
function record(page: import('@playwright/test').Page, ms: number): Promise<void> {
  return page.evaluate((duration) => {
    window.__morphRec = [];
    const t0 = performance.now();
    const tick = () => {
      // Exact token: the Settings dialog carries `max-sm:w-screen`, which a substring match also hits.
      const box = [...document.querySelectorAll('[role="dialog"]')].find((d) => d.classList.contains('w-screen'));
      if (box) {
        const cs = getComputedStyle(box);
        window.__morphRec!.push({
          t: Math.round(performance.now() - t0),
          opacity: parseFloat(cs.opacity),
          transform: cs.transform,
          docked: [...document.querySelectorAll('button[aria-label="Edit full screen"]')].some((b) => !box.contains(b)),
        });
      }
      if (performance.now() - t0 < duration) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, ms);
}

const samples = (page: import('@playwright/test').Page): Promise<Sample[]> =>
  page.evaluate(() => window.__morphRec ?? []);

test('the window grows out of the field on open — intermediate frames exist', async ({ page }) => {
  await openApp(page);
  await openPromptEditor(page);

  await record(page, 700);
  await chrome.enterFullscreen(page).click();
  await page.waitForTimeout(750);

  const frames = await samples(page);
  expect(frames.length).toBeGreaterThan(5);
  // A real trip passes through positions between the field and full size. One or two distinct values
  // is a jump cut; a transition produces a different matrix nearly every frame.
  const transforms = new Set(frames.map((s) => s.transform));
  expect(transforms.size).toBeGreaterThanOrEqual(3);
});

test('the window fades out over the restored panel on close — a gradual fade, panel under it', async ({ page }) => {
  await openApp(page);
  await openPromptEditor(page);
  await chrome.enterFullscreen(page).click();
  // Let the enter trip land fully, the way a person toggles.
  await page.waitForTimeout(600);

  await record(page, 700);
  await chrome.exitFullscreen(page).click();
  await page.waitForTimeout(750);

  const frames = await samples(page);
  expect(frames.length).toBeGreaterThan(5);
  // The fade must actually paint intermediate opacities — an instant 1→0 is the disappearing act
  // this design replaced.
  const mid = frames.filter((s) => s.opacity > 0.05 && s.opacity < 0.95);
  expect(mid.length).toBeGreaterThanOrEqual(2);
  // And the docked panel must be back underneath while the window is still fading, so the fade
  // reveals a finished view instead of an empty slot.
  const fading = frames.filter((s) => s.opacity < 0.95);
  expect(fading.length).toBeGreaterThan(0);
  expect(fading.every((s) => s.docked)).toBe(true);
  // The window really leaves at the end.
  await expect(page.getByRole('dialog', { name: /prompt/i })).toHaveCount(0);
});
