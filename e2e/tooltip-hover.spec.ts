import { test, expect, type Locator, type Page } from '@playwright/test';
import { openApp } from './app';

/**
 * The themed tooltip replaced every native `title` in the app. Two of its three promises are pointer
 * promises, and jsdom has no pointer: it dispatches no real hover, runs no `:focus-visible` heuristic,
 * and loads none of the stylesheet the bubble is positioned by. The wrapper's jsdom test therefore
 * proves the accessibility contract and the focus path in isolation; hover-open and the shared
 * instant-open window need a browser.
 *
 * Surface: the Main Menu's Grid/Detailed view toggle — two icon-only controls side by side, both
 * wrapped in `Tip`, reachable with no server and no world loaded.
 *
 * Nothing here counts milliseconds. The instant window is read off `data-instant`, the state Base UI
 * publishes for exactly this: set when an open skipped the shared delay, absent when it waited. A
 * stopwatch assertion against a 400 ms delay would only manufacture flakes.
 */

const GRID = 'Grid view';
const DETAILED = 'Detailed view';

/**
 * The bubble carrying `text`.
 *
 * There is no `getByRole` for it: a Base UI tooltip popup has no role, because the tip is a visual
 * affordance and is deliberately never announced. Text identifies it instead, and unambiguously — these
 * triggers are icon-only, so the string appears nowhere else on the surface.
 */
function tip(page: Page, text: string): Locator {
  return page.getByText(text, { exact: true });
}

/** Radix renders a single-value ToggleGroup as a radiogroup, so its items are radios. */
function viewToggle(page: Page, name: string): Locator {
  return page.getByRole('radio', { name });
}

/**
 * The Main Menu, settled. Grid layout selected, which is also what makes that item the group's tab stop.
 *
 * The wait is not cosmetic: the bundled worlds are seeded into IndexedDB after the menu mounts, and the
 * re-render that follows cancels a hover that is still counting down its delay. The pointer is already
 * where it wants to be by then, so nothing re-opens it and the tip never arrives at all.
 */
async function openMenu(page: Page): Promise<void> {
  await openApp(page, { FORMAMORPH_layoutMode: 'grid' });
  await viewToggle(page, GRID).waitFor();
  // A card's delete button: present in both layouts, and only once the seeded list has been read back.
  await page.getByRole('button', { name: 'Delete world' }).first().waitFor();
}

/** Walk the real tab order to `target`, so focus arrives in keyboard modality the way a user's does. */
async function tabTo(page: Page, target: Locator, limit = 40): Promise<void> {
  for (let i = 0; i < limit; i++) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error(`Tab never reached the control in ${limit} presses`);
}

test.describe('themed tooltips', () => {
  test('hover opens the themed bubble, and no native tip is left behind', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'a touch profile has no hover, and native title never showed there either');
    await openMenu(page);

    await expect(tip(page, GRID)).toBeHidden();
    await viewToggle(page, GRID).hover();
    await expect(tip(page, GRID)).toBeVisible();

    // The browser paints `title` itself, outside the DOM entirely. So the bubble existing in the DOM is
    // the proof it is ours, and the trigger holding no `title` is the proof there is not a second one
    // fading up underneath it.
    expect(await viewToggle(page, GRID).getAttribute('title')).toBeNull();
  });

  test('moving to the neighboring control opens its tip through the instant window', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'a touch profile has no hover to move');
    await openMenu(page);

    await viewToggle(page, GRID).hover();
    await expect(tip(page, GRID)).toBeVisible();
    // The first tip waited its turn. Asserting that is what keeps the next assertion from being true of
    // every tip whether the group fired or not.
    await expect(tip(page, GRID)).not.toHaveAttribute('data-instant', /./);

    await viewToggle(page, DETAILED).hover();
    await expect(tip(page, DETAILED)).toBeVisible();
    await expect(tip(page, DETAILED)).toHaveAttribute('data-instant', 'delay');
    // One at a time: the tip left behind goes rather than stacking.
    await expect(tip(page, GRID)).toBeHidden();
  });

  test('keyboard focus opens the same tip', async ({ page }) => {
    await openMenu(page);

    await expect(tip(page, GRID)).toBeHidden();
    await tabTo(page, viewToggle(page, GRID));
    await expect(tip(page, GRID)).toBeVisible();
  });
});
