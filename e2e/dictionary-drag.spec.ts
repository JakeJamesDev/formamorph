import { test, expect, type Page } from '@playwright/test';
import { openApp, gotoDev } from './app';
import {
  IN_DIALOG, dragBy, dragWatchingHover, editorGrip, intermediates, samples, startSampler,
} from './dragSampling';

/**
 * Dragging a dictionary entry must animate the displaced neighbors, both directions.
 *
 * Guards a reference-identity trap: useSortable compares its SortableContext's `items` array by
 * reference, and an inline `entries.map(...)` re-created on a mid-drag render downgrades every
 * displaced row's transition to 0ms — rows snap instead of sliding. jsdom cannot see this (no layout,
 * no transitions), so it is proven here by sampling computed transforms per frame during a real drag.
 * With the bug present a displaced row shows no intermediate positions (0 → ±60 in one frame).
 */

const BOOK = 'Drag Anim Book';

/** Import a standalone dictionary through the real file input (no picker in headless). */
async function importBook(page: Page, count: number): Promise<void> {
  await page.evaluate(([n, c]) => {
    const entries = [] as unknown[];
    for (let i = 0; i < (c as number); i++) {
      entries.push({ id: 'e' + i, name: 'Entry ' + i, key: ['kw' + i], value: 'Lore ' + i });
    }
    const json = JSON.stringify({ formamorphKind: 'dictionary', version: '2.0.3', name: n, entries });
    const input = document.querySelector('input[accept=".json,application/json"]') as HTMLInputElement;
    const dt = new DataTransfer();
    dt.items.add(new File([json], n + '.json', { type: 'application/json' }));
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, [BOOK, count] as const);
  await expect(page.getByText(BOOK, { exact: true })).toBeVisible();
}

const grip = (page: Page, label: string) => editorGrip(page, IN_DIALOG, label);

test('displaced entry rows slide, not snap, in both drag directions', async ({ page }) => {
  await openApp(page);
  await gotoDev(page, 'mainMenu', { tab: 'dictionaries' });
  // Over the virtualization threshold, so the windowed path (the riskier one) is what's measured.
  await importBook(page, 600);
  await page.getByText(BOOK, { exact: true }).click();
  // Mobile's ListDetail pushes the book's detail pane over the tree and parallaxes the rows off-screen;
  // pop back so the tree is front and interactable. Desktop shows both panes and renders no back button.
  const back = page.locator(IN_DIALOG).getByRole('button', { name: 'Dictionary', exact: true });
  if (await back.isVisible()) {
    await back.click();
    await page.waitForTimeout(250); // the list pane slides back over 200ms
  }
  await expect(grip(page, 'Entry 3')).toBeVisible();

  // Down: Entry 1 over Entry 2 → Entry 2 slides up through intermediate positions. Mid-drag, no row
  // may sit in the :hover state — the tree's hit-testing goes dark so rows don't light under the cursor.
  await startSampler(page, IN_DIALOG, ['Entry 2']);
  const hovered = await dragWatchingHover(page, IN_DIALOG, grip(page, 'Entry 1'), { dy: 120 });
  expect(hovered, 'no row may show hover at any point while dragging').toBe(0);
  expect(intermediates(await samples(page), 'Entry 2'), 'down-drag should animate').toBeGreaterThanOrEqual(3);

  // Up: Entry 5 over Entry 4 → Entry 4 slides down through intermediate positions.
  await startSampler(page, IN_DIALOG, ['Entry 4']);
  await dragBy(page, grip(page, 'Entry 5'), { dy: -120 });
  expect(intermediates(await samples(page), 'Entry 4'), 'up-drag should animate').toBeGreaterThanOrEqual(3);
});
