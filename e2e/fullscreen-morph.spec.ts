import { test, expect } from '@playwright/test';
import { openApp, openPromptEditor, chrome } from './app';

/**
 * The full-screen morph, measured as raw numbers rather than eyeballed. jsdom cannot see any of this
 * (no layout, no animation clock), and a passing property-interpolation check is not enough either —
 * an animation can move every computed value while changing nothing a person can see (a background-
 * colored box over a background-colored panel). So these specs assert the *visible* contract in
 * numbers: the window's on-screen rectangle must travel between the docked slot and the viewport
 * through intermediate sizes, it must stay solid while it does, and the backdrop dim that gives the
 * moving panel its contrast must actually be dark while the panel moves.
 */

/** Per-frame record of the fullscreen window and its supporting layers, taken inside the page. */
interface Sample {
  t: number;
  /** The window's painted rectangle — `getBoundingClientRect`, so transforms are included. */
  rect: { x: number; y: number; w: number; h: number };
  /** The window's own opacity: 1 while it should be solid. */
  opacity: number;
  /** The solid sheet covering the contents: 1 whenever the window is in flight. */
  veil: number;
  /** The dim layer behind the window: what makes a moving panel visible at all. */
  overlay: number;
  /** The window's computed border width and whether it casts a shadow — its own edge against a
   *  backdrop of the same color, for the frames before the dim has built up. */
  borderW: number;
  shadow: boolean;
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
      // Exact tokens: the Settings dialog carries `max-sm:w-screen`, which a substring match also hits.
      const box = [...document.querySelectorAll('[role="dialog"]')].find((d) => d.classList.contains('w-screen'));
      if (box) {
        const r = box.getBoundingClientRect();
        const veil = [...box.children].find((c) => c.classList.contains('bg-background') && c.classList.contains('absolute'));
        // The shell's own dim sheet, not the Settings modal's: the sheet is rendered immediately before
        // its content, so prefer the sibling and fall back to the last (innermost) match.
        const overlays = [...document.querySelectorAll('div')].filter((d) => d.classList.contains('bg-overlay/80'));
        const overlay = overlays.find((o) => o.nextElementSibling === box) ?? overlays[overlays.length - 1];
        window.__morphRec!.push({
          t: Math.round(performance.now() - t0),
          rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
          opacity: parseFloat(getComputedStyle(box).opacity),
          borderW: parseFloat(getComputedStyle(box).borderTopWidth) || 0,
          shadow: getComputedStyle(box).boxShadow !== 'none',
          veil: veil ? parseFloat(getComputedStyle(veil).opacity) : -1,
          overlay: overlay ? parseFloat(getComputedStyle(overlay).opacity) : 0,
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

const area = (s: Sample) => s.rect.w * s.rect.h;

/** The frames in which the window is visibly mid-travel: meaningfully smaller than its final size. */
const travelFrames = (frames: Sample[], full: number) => frames.filter((s) => area(s) < full * 0.95);

test('opening: the window grows through intermediate sizes, solid, over a dimmed backdrop', async ({ page }) => {
  await openApp(page);
  await openPromptEditor(page);

  await record(page, 800);
  await chrome.enterFullscreen(page).click();
  await page.waitForTimeout(850);

  const frames = await samples(page);
  expect(frames.length).toBeGreaterThan(10);
  const full = area(frames[frames.length - 1]);
  const travel = travelFrames(frames, full);

  // The travel itself: several distinct intermediate sizes, growing monotonically. One or two is a
  // jump cut, which is exactly the bug this spec exists to catch.
  expect(new Set(travel.map(area)).size).toBeGreaterThanOrEqual(4);
  for (let i = 1; i < frames.length; i++) expect(area(frames[i])).toBeGreaterThanOrEqual(area(frames[i - 1]) - 1);
  // It starts far from full size — the growth is from the docked slot, not a near-full pop.
  expect(area(frames[0])).toBeLessThan(full * 0.85);

  // Solid while it moves — never translucent, the veil fully covering the contents — and carrying its
  // own edge: a border and a shadow, because the panel is the same color as what it moves over, and
  // the earliest frames are the ones where a small panel is actually distinguishable.
  for (const s of travel) {
    expect(s.opacity).toBeGreaterThan(0.95);
    expect(s.veil).toBeGreaterThan(0.95);
    expect(s.borderW).toBeGreaterThanOrEqual(1);
    expect(s.shadow).toBe(true);
  }
  // Contrast: the dim fades in with the trip (an instant dim was the very first flash complaint), so
  // the border and shadow above carry the earliest frames, and by mid-travel the dim must be solidly
  // dark and doing the work.
  const mid = travel[Math.floor(travel.length / 2)];
  expect(mid.overlay).toBeGreaterThan(0.5);
});

test('closing: the window shrinks back into the docked slot, solid, with the panel restored under it', async ({ page }) => {
  await openApp(page);
  await openPromptEditor(page);
  await chrome.enterFullscreen(page).click();
  // Let the enter trip land fully, the way a person toggles.
  await page.waitForTimeout(700);

  await record(page, 800);
  await chrome.exitFullscreen(page).click();
  await page.waitForTimeout(850);

  const all = await samples(page);
  // The recorder starts before the click, so the first frames are the resting open state (veil down).
  // The measured run begins when the close commits: the veil snaps opaque.
  const start = all.findIndex((s) => s.veil > 0.95);
  expect(start).toBeGreaterThanOrEqual(0);
  const frames = all.slice(start);
  expect(frames.length).toBeGreaterThan(5);
  const full = area(frames[0]);
  // Mid-travel only: after landing the window sits parked at the docked size until it unmounts, and
  // those parked frames would otherwise drag the "middle of the travel" into the tail.
  const docked = area(frames[frames.length - 1]);
  const travel = frames.filter((s) => area(s) < full * 0.95 && area(s) > docked * 1.05);

  // The return trip is real: several distinct intermediate sizes, shrinking monotonically, ending
  // well below full size. An in-place fade-out records zero travel frames here.
  expect(new Set(travel.map(area)).size).toBeGreaterThanOrEqual(4);
  for (let i = 1; i < frames.length; i++) expect(area(frames[i])).toBeLessThanOrEqual(area(frames[i - 1]) + 1);
  // Loose bound: on a phone the docked editor legitimately fills most of the screen, so the landing
  // size is proven small only relative to full screen, not tiny in absolute terms.
  expect(area(frames[frames.length - 1])).toBeLessThan(full * 0.85);

  // Solid and edged through the travel — the shrink is the animation, and it happens over content of
  // the panel's own color.
  for (const s of travel) {
    expect(s.opacity).toBeGreaterThan(0.95);
    expect(s.veil).toBeGreaterThan(0.95);
    expect(s.borderW).toBeGreaterThanOrEqual(1);
    expect(s.shadow).toBe(true);
  }
  // Then the reveal: once parked at the docked size, the window must fade away over the restored
  // widget through real intermediate opacities. Without this it unmounts as a solid blank panel and
  // the widget appears in a single frame — the pop the whole design exists to remove.
  const landed = frames.filter((s) => area(s) <= docked * 1.05);
  expect(landed.filter((s) => s.opacity > 0.05 && s.opacity < 0.95).length).toBeGreaterThanOrEqual(2);
  for (const s of landed) expect(s.docked).toBe(true);
  // The dim layer is still meaningfully dark halfway through the shrink — it fades with the trip, not
  // ahead of it — and the docked panel is back underneath from the start of the travel, so the window
  // lands flush on the real widget instead of an empty slot.
  const midShrink = travel[Math.floor(travel.length / 2)];
  expect(midShrink.overlay).toBeGreaterThan(0.25);
  for (const s of travel) expect(s.docked).toBe(true);

  await expect(page.getByRole('dialog', { name: /prompt/i })).toHaveCount(0);
});
