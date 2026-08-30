import type { Locator, Page } from '@playwright/test';
import { openApp } from './app';

/**
 * Drag primitives for the library tile board, written against what a player can see.
 *
 * Everything here is an app-level observable — thumbnail alt text, bounding boxes, real pointer input —
 * so the same helpers drive the flat grid the library shipped with and the tile board that replaced it.
 * That is what makes a parity suite possible: one spec, two implementations, one measurement.
 *
 * jsdom reaches none of it. It has no layout, so every tile box is zero; no transitions, so a slide and
 * a snap read the same; and no trusted input, so a sensor's activation distance never fires.
 */

/** Every library tile's thumbnail carries its item's name as alt text, in the order the grid draws it. */
export const TILE_IMG = '[data-radix-scroll-area-viewport] img[alt]:not([alt=""])';

/** The tiles of the open library tab, in grid order. */
export function tiles(page: Page): Locator {
  return page.locator(TILE_IMG);
}

/** The names the board is drawing right now, in grid order. */
export function tileOrder(page: Page): Promise<string[]> {
  return page.locator(TILE_IMG).evaluateAll((imgs) => imgs.map((img) => (img as HTMLImageElement).alt));
}

/** The Main Menu with the bundled worlds read back and drawn, in the named layout. */
export async function openLibrary(page: Page, layout: 'grid' | 'detailed' = 'grid'): Promise<void> {
  await openApp(page, { FORMAMORPH_layoutMode: layout });
  // The bundled worlds are seeded into IndexedDB after the menu mounts; a drag measured before that
  // re-render is measured against tiles that are about to move.
  await page.getByRole('button', { name: 'Delete world' }).first().waitFor();
  await tiles(page).nth(2).waitFor();
}

/** The center of a tile, in page coordinates. */
export async function tileCenter(page: Page, index: number): Promise<{ x: number; y: number }> {
  const box = await tiles(page).nth(index).boundingBox();
  if (!box) throw new Error(`tile ${index} has no box`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

export interface DragOptions {
  /** Moves the travel is split into, so the browser paints frames in between. */
  steps?: number;
  /** ms to rest on the target before releasing. */
  hold?: number;
  /** ms between moves. */
  interval?: number;
  /** Release with Escape instead of the mouse, so the drag cancels rather than drops. */
  cancel?: boolean;
  /** Runs once the pointer has arrived and rested, just before the release. */
  onHeld?: () => Promise<void>;
}

/**
 * Carry one tile onto another with the real mouse.
 *
 * The first move only clears the mouse sensor's activation distance; its 12px stay in the travel, as they
 * would under a real hand. Everything after is stepped, because a single jump gives the drag no
 * intermediate move to resolve which tile it is over.
 */
export async function dragTile(
  page: Page,
  fromIndex: number,
  toIndex: number,
  options: DragOptions = {},
): Promise<void> {
  await dragBetween(page, await tileCenter(page, fromIndex), await tileCenter(page, toIndex), options);
}

/** The same gesture between two points, for a tile the thumbnail selectors do not reach — a folder. */
export async function dragBetween(
  page: Page,
  start: { x: number; y: number },
  end: { x: number; y: number },
  options: DragOptions = {},
): Promise<void> {
  const { steps = 12, hold = 250, interval = 0, cancel = false, onHeld } = options;

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 12, start.y, { steps: 2 });
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(
      start.x + 12 + ((end.x - start.x - 12) * i) / steps,
      start.y + ((end.y - start.y) * i) / steps,
    );
    if (interval) await page.waitForTimeout(interval);
  }
  await page.mouse.move(end.x, end.y);
  if (hold) await page.waitForTimeout(hold);
  await onHeld?.();
  if (cancel) await page.keyboard.press('Escape');
  await page.mouse.up();
  await page.waitForTimeout(250);
}

/**
 * Every painted copy of one tile's artwork, each at the opacity a player actually sees it at.
 *
 * Copies are found by shared image source rather than by element, so a carried tile drawn twice — once
 * in the board and once in a portal that follows the pointer — reports twice however it is built. The
 * opacity is the product of the whole ancestor chain, because the two copies are dimmed at different
 * levels, and a hidden ancestor reports 0.
 *
 * Only sound while no folder is on the board: a folder's mosaic redraws its members' thumbnails, and
 * those are copies of the same artwork by this measure.
 */
export function carriedCopies(page: Page, name: string): Promise<number[]> {
  return page.evaluate(
    ([selector, wanted]) => {
      const source = ([...document.querySelectorAll(selector as string)] as HTMLImageElement[])
        .find((img) => img.alt === wanted);
      if (!source) return [];
      return ([...document.querySelectorAll('img')] as HTMLImageElement[])
        .filter((img) => img.src === source.src)
        .map((img) => {
          let opacity = 1;
          for (let el: Element | null = img; el; el = el.parentElement) {
            const style = getComputedStyle(el);
            if (style.visibility === 'hidden' || style.display === 'none') return 0;
            opacity *= Number(style.opacity);
          }
          return opacity;
        });
    },
    [TILE_IMG, name] as const,
  );
}

/**
 * Start a per-frame sampler of {@link carriedCopies} for one tile, for measuring the settle after a
 * release. Same lifetime rules as {@link startTileSampler}: one rAF loop for the page's life,
 * re-aimed and emptied on each call.
 */
export function startCopySampler(page: Page, name: string): Promise<void> {
  return page.evaluate(
    ([selector, wanted]) => {
      const w = window as unknown as {
        __copySamples: { t: number; copies: number[] }[];
        __copyWatch: string;
        __copySelector: string;
        __copyLoop?: boolean;
      };
      w.__copySamples = [];
      w.__copyWatch = wanted as string;
      w.__copySelector = selector as string;
      if (w.__copyLoop) return;
      w.__copyLoop = true;
      const tick = () => {
        const source = ([...document.querySelectorAll(w.__copySelector)] as HTMLImageElement[])
          .find((img) => img.alt === w.__copyWatch);
        if (source) {
          w.__copySamples.push({
            t: performance.now(),
            copies: ([...document.querySelectorAll('img')] as HTMLImageElement[])
              .filter((img) => img.src === source.src)
              .map((img) => {
                let opacity = 1;
                for (let el: Element | null = img; el; el = el.parentElement) {
                  const style = getComputedStyle(el);
                  if (style.visibility === 'hidden' || style.display === 'none') return 0;
                  opacity *= Number(style.opacity);
                }
                return opacity;
              }),
          });
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },
    [TILE_IMG, name] as const,
  );
}

/** Everything the copy sampler recorded since the last {@link startCopySampler}. */
export function copySamples(page: Page): Promise<{ t: number; copies: number[] }[]> {
  return page.evaluate(
    () => (window as unknown as { __copySamples: { t: number; copies: number[] }[] }).__copySamples,
  );
}

/** One sample of the watched tiles' page positions, stamped with the frame's clock. */
export interface TileSample {
  t: number;
  at: Record<string, { x: number; y: number } | null>;
}

/**
 * Start a per-frame sampler of the named tiles' painted positions, and return the clock reading it starts
 * from. One rAF loop runs for the page's life; calling this again re-aims it and empties the buffer.
 *
 * Positions are read as bounding rects, so a tile moved by a transform and a tile moved by its grid slot
 * both report where they actually are — the two implementations displace tiles differently and this must
 * not be able to tell them apart.
 */
export function startTileSampler(page: Page, names: string[]): Promise<number> {
  return page.evaluate(
    ([selector, watch]) => {
      const w = window as unknown as {
        __tileSamples: TileSample[];
        __tileWatch: string[];
        __tileSelector: string;
        __tileLoop?: boolean;
      };
      w.__tileSamples = [];
      w.__tileWatch = watch as string[];
      w.__tileSelector = selector as string;
      if (!w.__tileLoop) {
        w.__tileLoop = true;
        const tick = () => {
          const at: Record<string, { x: number; y: number } | null> = {};
          const imgs = [...document.querySelectorAll(w.__tileSelector)] as HTMLImageElement[];
          for (const name of w.__tileWatch) {
            const el = imgs.find((img) => img.alt === name);
            const box = el?.getBoundingClientRect();
            at[name] = box ? { x: box.left, y: box.top } : null;
          }
          w.__tileSamples.push({ t: performance.now(), at });
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
      return performance.now();
    },
    [TILE_IMG, names] as const,
  ) as Promise<number>;
}

/** Everything the sampler recorded since the last {@link startTileSampler}. */
export function tileSamples(page: Page): Promise<TileSample[]> {
  return page.evaluate(() => (window as unknown as { __tileSamples: TileSample[] }).__tileSamples);
}

/** The page clock, so a sampled frame can be placed against a moment in the gesture. */
export function now(page: Page): Promise<number> {
  return page.evaluate(() => performance.now());
}

/** How far one tile had moved from where it stood when sampling started, per frame. */
export function travelOf(samples: TileSample[], name: string): { t: number; d: number }[] {
  const first = samples.find((sample) => sample.at[name]);
  if (!first) return [];
  const origin = first.at[name]!;
  return samples
    .filter((sample) => sample.at[name])
    .map((sample) => ({
      t: sample.t,
      d: Math.hypot(sample.at[name]!.x - origin.x, sample.at[name]!.y - origin.y),
    }));
}

/**
 * Distinct positions a tile passed through on its way, ignoring the two rest states it starts and ends
 * at. A tile that slid reports several; a tile that snapped reports none.
 */
export function intermediates(samples: TileSample[], name: string, step: number): number {
  const seen = new Set<number>();
  for (const { d } of travelOf(samples, name)) {
    if (d > step * 0.15 && d < step * 0.85) seen.add(Math.round(d));
  }
  return seen.size;
}
