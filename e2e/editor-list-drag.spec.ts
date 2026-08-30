import { test, expect, type Page } from '@playwright/test';
import { openApp, openWorldEditor } from './app';
import {
  IN_TAB_PANEL, dragWatchingHover, editorGrip, intermediates, rowLabels, samples, startSampler,
} from './dragSampling';

/**
 * The flat-list wiring shape: a World Editor tab's item list.
 *
 * Same two invariants the dictionary tree already guards, checked on the other shape so the shared drag
 * layer cannot fix one surface and leave the rest behind. A displaced neighbor has to travel — it slides
 * only while the sortable context's id array keeps its identity across a mid-drag render — and no row may
 * light up under the cursor, which needs hit-testing to go dark for the length of the drag.
 */

const ROOT = IN_TAB_PANEL;

/** Open the Stats tab of a stored world, and answer with the labels it lists. */
async function openStats(page: Page): Promise<string[]> {
  await openApp(page);
  await openWorldEditor(page);
  await page.getByRole('tab', { name: 'Stats' }).click();
  await expect(page.locator(`${ROOT} span.cursor-grab`).first()).toBeVisible();
  const labels = await rowLabels(page, ROOT);
  expect(labels.length, 'the stats tab needs enough rows to displace one').toBeGreaterThanOrEqual(4);
  return labels;
}

test('a displaced editor row slides, and nothing lights up under the drag', async ({ page }) => {
  const labels = await openStats(page);

  // The second row travels down past the third and fourth; the third is the neighbor that has to move.
  await startSampler(page, ROOT, [labels[2]]);
  const hovered = await dragWatchingHover(page, ROOT, editorGrip(page, ROOT, labels[1]), { dy: 120 });

  expect(hovered, 'no row may show hover at any point while dragging').toBe(0);
  expect(
    intermediates(await samples(page), labels[2]),
    'the displaced row should pass through intermediate positions, not snap',
  ).toBeGreaterThanOrEqual(3);
});

test('the drop lands the dragged row below the rows it passed', async ({ page }) => {
  const labels = await openStats(page);

  await dragWatchingHover(page, ROOT, editorGrip(page, ROOT, labels[1]), { dy: 120 });

  const after = await rowLabels(page, ROOT);
  expect(after.indexOf(labels[1])).toBeGreaterThan(after.indexOf(labels[2]));
  expect(after.indexOf(labels[1])).toBeGreaterThan(after.indexOf(labels[3]));
  expect(after.slice().sort(), 'a reorder may not add or drop a row').toEqual(labels.slice().sort());
});
