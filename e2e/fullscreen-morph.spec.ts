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
  /** A docked full-screen toggle exists outside the window — the panel is back underneath. */
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
          docked: [...document.querySelectorAll('button[aria-label="Edit full screen"], button[aria-label="View full screen"]')].some((b) => !box.contains(b)),
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

type Page = import('@playwright/test').Page;

/** Waits out every animation under `locator`, so a later click lands at once. */
const settle = (locator: import('@playwright/test').Locator) =>
  locator.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)));

/** Opens a Formaquestion Settings tab the way a player does. */
async function openHelpSettingsTab(page: Page, tab: 'Prompts' | 'Mascot'): Promise<void> {
  // The player's path: the window's menu opens Formaquestion Settings and hides the window meanwhile.
  // The dev route keeps both on screen, a state no player reaches.
  await openApp(page, { FORMAMORPH_helpSettings: { mascot: false } });
  await page.keyboard.press('F1');
  await page.locator('#formaquestion-window').getByRole('button', { name: 'More Actions' }).click();
  await page.getByRole('menuitem', { name: 'Settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Formaquestion Settings' });
  // Below `sm` (640px) the tab strip is a select.
  const goTo = async (name: string) => {
    if (page.viewportSize()!.width >= 640) await dialog.getByRole('tab', { name }).click();
    else {
      await dialog.getByRole('combobox', { name: 'Tab' }).click();
      await page.getByRole('option', { name }).click();
    }
  };
  // The Mascot tab edits nothing while the Mascot is off; its switch is on General.
  if (tab === 'Mascot') await dialog.getByRole('checkbox', { name: 'Mascot' }).click();
  await goTo(tab);
  await dialog.getByRole('combobox', { name: 'Preset' }).waitFor();
  // Settled first: a click on a still-zooming dialog waits for it, and the recorder's clock runs meanwhile.
  await settle(dialog);
}

/** One way through the toggle: `arm` readies it off the clock, `press` is the click the trip answers. */
interface Toggle {
  arm?: (page: Page) => Promise<void>;
  press: (page: Page) => Promise<void>;
}

const narrow = (page: Page) => page.viewportSize()!.width < 768;

/** A preset header action: an icon at `md` (768px) and up, a ⋯ menu item below. */
const headerAction = (name: string): Toggle => ({
  arm: async (page) => {
    if (!narrow(page)) return;
    await page.getByRole('button', { name: 'Preset Actions' }).last().click();
    // Settled, so the press is one click and not a wait on the menu's open animation.
    await settle(page.getByRole('menu'));
  },
  press: (page) => (narrow(page) ? page.getByRole('menuitem', { name }) : page.getByRole('button', { name, exact: true })).click(),
});

const toggle = async (page: Page, way: Toggle) => { await way.arm?.(page); await way.press(page); };

interface Surface {
  name: string;
  /** The window's accessible name: the tab it grows out of. */
  window: string;
  open: (page: Page) => Promise<void>;
  enter: Toggle;
  exit: Toggle;
  /** Runs at this size on a desktop project only, in place of the project's own. */
  viewport?: { width: number; height: number };
}

const fieldToggle = { enter: { press: (page: Page) => chrome.enterFullscreen(page).click() }, exit: { press: (page: Page) => chrome.exitFullscreen(page).click() } };

/** Each panel that lifts into the window whole: the trip is the same shell from either modal. */
const SURFACES: Surface[] = [
  { name: 'Settings Prompts', window: 'Prompts', open: async (page) => { await openApp(page); await openPromptEditor(page); }, ...fieldToggle },
  { name: 'Formaquestion Prompts', window: 'Prompts', open: (page) => openHelpSettingsTab(page, 'Prompts'), ...fieldToggle },
  {
    name: 'Formaquestion Mascot',
    window: 'Mascot',
    open: (page) => openHelpSettingsTab(page, 'Mascot'),
    enter: headerAction('View full screen'),
    exit: headerAction('Exit full screen'),
  },
];

const WIDE_VIEWPORT = { width: 1600, height: 900 };
/** The docked preview column: 22rem at 16px. */
const DOCKED_PREVIEW_PX = 352;

test.describe('Formaquestion Mascot split', () => {
  test.use({ viewport: WIDE_VIEWPORT });

  test('full screen gives the preview a third of the viewport, and the dock keeps 22rem', async ({ page }) => {
    await openHelpSettingsTab(page, 'Mascot');
    const dialog = page.getByRole('dialog', { name: 'Formaquestion Settings' });
    const previewWidth = () => dialog.locator('[data-fq-scroll="mascot-preview"]').evaluate((el) => Math.round(el.getBoundingClientRect().width));
    expect(await previewWidth()).toBe(DOCKED_PREVIEW_PX);

    await headerAction('View full screen').press(page);
    const full = page.getByRole('dialog', { name: 'Mascot', exact: true });
    await expect(full).toBeVisible();
    // The Mascot tab runs an endless animation, so `settle` would never return; the trip is well under a second.
    await page.waitForTimeout(900);
    // One third of the window less its share of the gap and padding: within a fifth of the viewport's third.
    const width = await full.locator('[data-fq-scroll="mascot-preview"]').evaluate((el) => el.getBoundingClientRect().width);
    expect(Math.abs(width - 1600 / 3)).toBeLessThan(1600 / 3 * 0.2);
    const controls = await full.locator('[data-fq-scroll="mascot-controls"]').evaluate((el) => el.getBoundingClientRect().width);
    expect(controls / width).toBeGreaterThan(1.95);
    expect(controls / width).toBeLessThan(2.05);

    await headerAction('Exit full screen').press(page);
    await expect(full).toHaveCount(0);
    expect(await previewWidth()).toBe(DOCKED_PREVIEW_PX);
  });
});

/** The frames in which the window is visibly mid-travel: meaningfully smaller than its final size. */
const travelFrames = (frames: Sample[], full: number) => frames.filter((s) => area(s) < full * 0.95);

/** The Mascot trip again at a desktop size, where the columns reflow from 22rem to a third during the morph. */
const WIDE_MASCOT: Surface = {
  ...SURFACES.find((s) => s.name === 'Formaquestion Mascot')!,
  name: 'Formaquestion Mascot at 1600×900',
  viewport: WIDE_VIEWPORT,
};

for (const surface of [...SURFACES, WIDE_MASCOT]) test.describe(surface.name, () => {
  if (surface.viewport) {
    test.use({ viewport: surface.viewport });
    test.skip(({ isMobile, hasTouch }) => isMobile || hasTouch, 'A desktop-size run');
  }

  test('opening: the window grows through intermediate sizes, solid, over a dimmed backdrop', async ({ page }) => {
    await surface.open(page);
    await surface.enter.arm?.(page);

    await record(page, 800);
    await surface.enter.press(page);
    await page.waitForTimeout(850);

    // The panel's window, not the field's own: a field's window is named by its label.
    await expect(page.getByRole('dialog', { name: surface.window, exact: true })).toBeVisible();
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

    // The reveal starts at landing, not after the settle buffer: the veil is fully off well before the
    // buffered timeline (~540ms after the window appears) could manage it. Timed from the window's first
    // frame, so a ⋯ menu closing before its action runs is not charged to the morph.
    const revealed = frames.find((s) => s.veil >= 0 && s.veil < 0.1);
    expect(revealed).toBeTruthy();
    expect(revealed!.t - frames[0].t).toBeLessThan(480);
  });

  test('closing: the window shrinks back into the docked slot, solid, with the panel restored under it', async ({ page }) => {
    await surface.open(page);
    await toggle(page, surface.enter);
    // Let the enter trip land fully, the way a person toggles.
    await page.waitForTimeout(700);
    await surface.exit.arm?.(page);

    await record(page, 800);
    await surface.exit.press(page);
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

    await expect(page.getByRole('dialog', { name: surface.window, exact: true })).toHaveCount(0);
    // No field window is left behind either: each is named for its prompt.
    await expect(page.getByRole('dialog', { name: /prompt/i })).toHaveCount(0);
  });
});
