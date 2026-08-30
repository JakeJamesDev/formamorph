import type { Locator, Page } from '@playwright/test';

/**
 * Drag sampling for editor lists: drive a real drag with the mouse, then read what the browser actually
 * painted each frame.
 *
 * jsdom cannot see any of this. It has no layout, so a transform is whatever the style string says; no
 * transitions, so a slide and a snap are the same two values; and no hit testing, so nothing ever matches
 * `:hover`. The failures these helpers guard against are all three at once, which is why they live in the
 * browser suite instead of the unit one.
 *
 * Every editor list draws its rows through `EditorRow`, so one set of selectors reaches all of them: the
 * row is the clickable box, the label is its truncating span, and the grip is the cursor-grab span.
 */

/** One editor row, inside whatever root the caller scopes to. The grip is what tells a row apart from
 *  any other clickable box the surrounding panel happens to draw. */
export const ROW = 'div.cursor-pointer:has(span.cursor-grab)';
const LABEL = 'span.truncate';
const GRIP = 'span.cursor-grab';

/** Rows in a dialog — the dictionary editor, the save browser, and every modal list. */
export const IN_DIALOG = '[role="dialog"]';

/** Rows in a tabbed surface's active body — the World Editor's per-tab lists and trees. */
export const IN_TAB_PANEL = '[role="tabpanel"]';

/** The row carrying `label`, matched on its full label text. */
export function editorRow(page: Page, root: string, label: string): Locator {
  return page
    .locator(`${root} ${ROW}`)
    .filter({ has: page.locator(LABEL, { hasText: new RegExp(`^${label}$`) }) });
}

/** The drag grip on the row carrying `label`. */
export function editorGrip(page: Page, root: string, label: string): Locator {
  return editorRow(page, root, label).locator(GRIP).first();
}

/** Every visible row label, in the order the list draws them. */
export function rowLabels(page: Page, root: string): Promise<string[]> {
  return page.evaluate(
    ([r, row, label]) =>
      [...document.querySelectorAll(`${r} ${row}`)].map(
        (el) => el.querySelector(label as string)?.textContent?.trim() ?? '',
      ),
    [root, ROW, LABEL] as const,
  );
}

/** Each row's left padding, which is how a tree row shows its nesting depth. */
export function rowIndents(page: Page, root: string): Promise<number[]> {
  return page.evaluate(
    ([r, row]) =>
      [...document.querySelectorAll(`${r} ${row}`)].map((el) =>
        parseFloat(getComputedStyle(el).paddingLeft),
      ),
    [root, ROW] as const,
  );
}

/** How many rows the pointer is currently lighting up. Must stay 0 for the whole of a drag. */
export function hoverCount(page: Page, root: string): Promise<number> {
  return page.evaluate(
    ([r, row]) => document.querySelectorAll(`${r} ${row}:hover`).length,
    [root, ROW] as const,
  );
}

/**
 * Start a per-frame sampler of the named rows' computed transforms. One rAF loop runs for the whole page
 * life; calling this again re-aims it at different labels and empties the buffer.
 */
export function startSampler(page: Page, root: string, labels: string[]): Promise<void> {
  return page.evaluate(
    ([watch, r, row, label]) => {
      const w = window as unknown as {
        __samples: unknown[];
        __watch: string[];
        __root: string;
        __loop?: boolean;
      };
      w.__samples = [];
      w.__watch = watch as string[];
      w.__root = r as string;
      if (w.__loop) return;
      w.__loop = true;
      const tick = () => {
        const rec: Record<string, string> = {};
        for (const name of w.__watch) {
          const el = [...document.querySelectorAll(`${w.__root} ${row}`)].find(
            (node) => node.querySelector(label as string)?.textContent?.trim() === name,
          ) as HTMLElement | undefined;
          rec[name] = el ? getComputedStyle(el).transform : 'gone';
        }
        w.__samples.push(rec);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },
    [labels, root, ROW, LABEL] as const,
  );
}

/** Everything the sampler has recorded since the last {@link startSampler}. */
export const samples = (page: Page): Promise<Record<string, string>[]> =>
  page.evaluate(() => (window as unknown as { __samples: Record<string, string>[] }).__samples);

/** One editor row's height plus the gap below it — how far one displaced neighbor travels. */
export const ROW_STEP = 60;

/**
 * Distinct intermediate translateY positions a row passed through, ignoring its two rest states (0 and one
 * row step either way). A row that slid reports several; a row that snapped reports none.
 */
export function intermediates(recs: Record<string, string>[], label: string, step = ROW_STEP): number {
  const seen = new Set<number>();
  for (const rec of recs) {
    const value = rec[label];
    if (!value || value === 'none' || value === 'gone') continue;
    const ty = Number(value.split(',').pop()!.replace(')', '').trim());
    if (Number.isFinite(ty) && ty !== 0 && Math.abs(Math.abs(ty) - step) > 1) seen.add(Math.round(ty));
  }
  return seen.size;
}

export interface DragOptions {
  /** Horizontal travel in px. A tree reads this as a change of nesting depth. */
  dx?: number;
  /** Vertical travel in px. */
  dy?: number;
  /** How many mouse moves the travel is split into. */
  steps?: number;
  /** ms to wait after each move, so the browser gets a frame to paint. */
  hold?: number;
  /** ms to wait before releasing, so the displacement transition finishes. */
  settle?: number;
  /** Runs after every move — the hook for a per-step census. */
  onStep?: () => Promise<void>;
}

/**
 * Drag a grip by an offset with the real mouse, in steps, so the browser paints the frames in between.
 *
 * The first move only clears the sensor's activation distance; it goes on the dominant axis so a sideways
 * drag never registers as a vertical one. Its 8px stay in the travel, as they do under a real hand.
 */
export async function dragBy(page: Page, grip: Locator, options: DragOptions): Promise<void> {
  const { dx = 0, dy = 0, steps = 12, hold = 30, settle = 300, onStep } = options;
  await grip.scrollIntoViewIfNeeded();
  const box = (await grip.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const nudgeX = horizontal ? Math.sign(dx) * 8 : 0;
  const nudgeY = horizontal ? 0 : Math.sign(dy) * 8;

  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + nudgeX, cy + nudgeY);
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(cx + nudgeX + (dx * i) / steps, cy + nudgeY + (dy * i) / steps);
    await page.waitForTimeout(hold);
    await onStep?.();
  }
  await page.waitForTimeout(settle);
  await page.mouse.up();
  await page.waitForTimeout(200);
}

/** Drag a grip and collect the hover census at every step; the maximum must be 0. */
export async function dragWatchingHover(
  page: Page,
  root: string,
  grip: Locator,
  options: DragOptions,
): Promise<number> {
  const counts: number[] = [];
  await dragBy(page, grip, {
    ...options,
    onStep: async () => {
      counts.push(await hoverCount(page, root));
      await options.onStep?.();
    },
  });
  return counts.length ? Math.max(...counts) : 0;
}
