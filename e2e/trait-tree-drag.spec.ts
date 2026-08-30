import { test, expect, type Page } from '@playwright/test';
import { openApp, openWorldEditor } from './app';
import {
  IN_TAB_PANEL, dragBy, dragWatchingHover, editorGrip, intermediates, rowIndents, rowLabels,
  ROW_STEP, samples, startSampler,
} from './dragSampling';

/**
 * The depth-nesting wiring shape: the Traits tab's tree.
 *
 * This is the surface that cannot take the flat lists' modifiers. `restrictToVerticalAxis` and
 * `restrictToFirstScrollableAncestor` both clamp the horizontal delta, and the tree reads that delta as
 * the nesting depth — so either one silently turns re-parenting into plain reordering. Nothing in the
 * types says so, which is why it is asserted here: drag a nested row sideways and watch its indent.
 */

const ROOT = IN_TAB_PANEL;
/** Indent per nesting level, and a top-level row's own left padding (see `EditorRow`). */
const INDENT = 24;
const ROOT_PADDING = 8;

/** Open the Traits tab of a stored world. */
async function openTraits(page: Page): Promise<void> {
  await openApp(page);
  await openWorldEditor(page);
  await page.getByRole('tab', { name: 'Traits' }).click();
  await expect(page.locator(`${ROOT} span.cursor-grab`).first()).toBeVisible();
}

/**
 * A nested row that is free to come up a level: the last child of a group, whose follower sits at the
 * top level. A row followed by another nested one is pinned by the projection's own floor, so dragging
 * that one sideways would prove nothing.
 */
async function lastChildOfAGroup(page: Page): Promise<{ label: string; indent: number }> {
  const [labels, indents] = await Promise.all([rowLabels(page, ROOT), rowIndents(page, ROOT)]);
  for (let i = 0; i < indents.length; i++) {
    const nested = indents[i] >= ROOT_PADDING + INDENT;
    const freeBelow = i + 1 >= indents.length || indents[i + 1] <= ROOT_PADDING;
    if (nested && freeBelow) return { label: labels[i], indent: indents[i] };
  }
  throw new Error('the traits tree has no nested row with a top-level row under it');
}

test('a sideways drag still changes a row\'s nesting depth', async ({ page }) => {
  await openTraits(page);
  const target = await lastChildOfAGroup(page);

  // Left by one indent step: the row leaves its group and lands at the top level.
  await dragBy(page, editorGrip(page, ROOT, target.label), { dx: -INDENT });

  const [labels, indents] = await Promise.all([rowLabels(page, ROOT), rowIndents(page, ROOT)]);
  const at = labels.indexOf(target.label);
  expect(at, 'the dragged row should still be listed').toBeGreaterThanOrEqual(0);
  expect(indents[at], 'a sideways drag should have un-nested the row').toBe(ROOT_PADDING);
  expect(target.indent, 'the row must start nested for this to prove anything').toBeGreaterThan(ROOT_PADDING);
});

/**
 * Two adjacent rows at one depth — a row and the sibling below it.
 *
 * The drag has to start on a row showing no children, because a tree hides the dragged row's whole subtree
 * for the length of the drag. A neighbor that vanishes mid-drag can be measured neither for its slide nor
 * for its hover; a sibling at the same depth stays on screen throughout, and one at the same depth means
 * the row above it has nothing nested under it.
 */
async function siblingPair(page: Page): Promise<[string, string]> {
  const [labels, indents] = await Promise.all([rowLabels(page, ROOT), rowIndents(page, ROOT)]);
  for (let i = 0; i + 1 < indents.length; i++) {
    if (indents[i] === indents[i + 1]) return [labels[i], labels[i + 1]];
  }
  throw new Error('the traits tree has no two adjacent rows at one depth');
}

test('displaced tree rows slide, and nothing lights up under the drag', async ({ page }) => {
  await openTraits(page);
  const [dragged, neighbor] = await siblingPair(page);

  // One row down, so the pair swaps: far enough to displace the neighbor, not far enough to leave the group.
  await startSampler(page, ROOT, [neighbor]);
  const hovered = await dragWatchingHover(page, ROOT, editorGrip(page, ROOT, dragged), { dy: ROW_STEP });

  expect(hovered, 'no row may show hover at any point while dragging').toBe(0);
  expect(
    intermediates(await samples(page), neighbor),
    'the displaced row should pass through intermediate positions, not snap',
  ).toBeGreaterThanOrEqual(3);
});
