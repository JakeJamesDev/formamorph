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
  // re-render is measured against tiles that are about to move. The toast is the settled signal —
  // polling the world list goes true one tick early, and the cards carry no delete button anymore.
  await page.getByText('Loaded default worlds').waitFor({ state: 'visible' });
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
  /** Points to travel through on the way, for a gesture that turns rather than going straight there. */
  via?: { x: number; y: number }[];
  /** Which half of the destination tile to rest on. See {@link aimAt}; defaults to dead center. */
  aim?: 'center' | 'near' | 'far';
  /** Re-reads the destination once the travel is done, for a list that scrolled under the hand. */
  reaim?: () => Promise<{ x: number; y: number }>;
  /** How far off the destination's center `aim` steps, in px. See {@link aimAt}. */
  reach?: number;
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
  const box = await tiles(page).nth(toIndex).boundingBox();
  await dragBetween(page, await tileCenter(page, fromIndex), await tileCenter(page, toIndex), {
    reach: box ? reachOf(box) : undefined,
    reaim: () => tileCenter(page, toIndex),
    ...options,
  });
}

/** The same gesture between two points, for a tile the thumbnail selectors do not reach — a folder. */
export async function dragBetween(
  page: Page,
  start: { x: number; y: number },
  target: { x: number; y: number },
  options: DragOptions = {},
): Promise<void> {
  const {
    steps = 12, hold = 250, interval = 0, cancel = false, onHeld, via = [], aim, reaim, reach,
  } = options;
  const end = aimAt(start, target, aim, reach);

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 12, start.y, { steps: 2 });
  let from = { x: start.x + 12, y: start.y };
  for (const leg of [...via, end]) {
    for (let i = 1; i <= steps; i++) {
      await page.mouse.move(
        from.x + ((leg.x - from.x) * i) / steps,
        from.y + ((leg.y - from.y) * i) / steps,
      );
      if (interval) await page.waitForTimeout(interval);
    }
    from = leg;
  }
  await page.mouse.move(end.x, end.y);
  if (reaim) {
    // A list auto-scrolls when a drag nears its edge, so the tile aimed at may not be where it was when
    // the travel began. Re-read it and correct, which is what a hand watching the screen does.
    await page.waitForTimeout(150);
    const corrected = aimAt(start, await reaim(), aim, reach);
    if (Math.hypot(corrected.x - end.x, corrected.y - end.y) > 2) {
      await page.mouse.move(corrected.x, corrected.y, { steps: 3 });
    }
  }
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

/** One sample of the watched tiles' painted boxes, stamped with the frame's clock. */
export interface TileSample {
  t: number;
  at: Record<string, { x: number; y: number; w: number; h: number } | null>;
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
          const at: Record<string, { x: number; y: number; w: number; h: number } | null> = {};
          const imgs = [...document.querySelectorAll(w.__tileSelector)] as HTMLImageElement[];
          for (const name of w.__tileWatch) {
            const el = imgs.find((img) => img.alt === name);
            const box = el?.getBoundingClientRect();
            at[name] = box ? { x: box.left, y: box.top, w: box.width, h: box.height } : null;
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

/** One tile's footprint on the board, in base cells. */
export interface TileCell {
  row: number;
  col: number;
  span: number;
}

/**
 * Where every tile stands, by the name on its thumbnail, read off the rendered grid.
 *
 * The cells come from the browser's own resolved grid placement rather than from anything the drag
 * keeps, so this measures where a player sees a tile — not what the board believes about it.
 */
export function boardCells(page: Page): Promise<Record<string, TileCell>> {
  return page.evaluate(() => {
    const grid = document.querySelector('[data-radix-scroll-area-viewport] div.grid');
    if (!grid) return {};
    const cells: Record<string, { row: number; col: number; span: number }> = {};
    for (const cell of [...grid.children]) {
      const img = cell.querySelector('img[alt]:not([alt=""])') as HTMLImageElement | null;
      const name = img?.alt ?? cell.querySelector('h3')?.textContent?.trim();
      if (!name) continue;
      const style = getComputedStyle(cell);
      const span = Number(style.gridColumnEnd.replace('span ', '')) || 1;
      cells[name] = {
        row: Number(style.gridRowStart) - 1,
        col: Number(style.gridColumnStart) - 1,
        span,
      };
    }
    return cells;
  });
}

/** How far off a target's center an aimed rest lands when the caller has not measured the tile, in px. */
const AIM_REACH = 30;

/** A quarter of a tile's smaller side: clear of the split, and well inside the tile at every size. */
const reachOf = (box: { width: number; height: number }) => Math.min(box.width, box.height) / 4;

/**
 * Where to rest on a target for a given intent.
 *
 * The drag splits a target along the line from the pickup: resting past its center moves it, resting
 * short of the center folds the two into a folder. `far` and `near` step off the center along that line
 * by `reach`, which lands in the right half from whichever side the drag approaches — and keeps a test
 * that means one of the two off the boundary between them. The step is a distance rather than a share
 * of the travel, because a long carry onto a small tile would otherwise overshoot it entirely.
 */
export function aimAt(
  from: { x: number; y: number },
  target: { x: number; y: number },
  aim: 'center' | 'near' | 'far' = 'center',
  reach = AIM_REACH,
): { x: number; y: number } {
  if (aim === 'center') return target;
  const length = Math.hypot(target.x - from.x, target.y - from.y) || 1;
  const step = (aim === 'far' ? reach : -reach) / length;
  return { x: target.x + (target.x - from.x) * step, y: target.y + (target.y - from.y) * step };
}

/** The center of a footprint on the page, for a tile the thumbnail selectors do not reach. */
export function cellCenter(
  pitch: { left: number; top: number; x: number; y: number },
  cell: TileCell,
  gap = 16,
): { x: number; y: number } {
  return {
    x: pitch.left + cell.col * pitch.x + (cell.span * pitch.x - gap) / 2,
    y: pitch.top + cell.row * pitch.y + (cell.span * pitch.y - gap) / 2,
  };
}

/** The grid's own geometry, so a cell can be turned into a point on the page. */
export function gridPitch(page: Page): Promise<{ left: number; top: number; x: number; y: number }> {
  return page.evaluate(() => {
    const grid = document.querySelector('[data-radix-scroll-area-viewport] div.grid') as HTMLElement;
    const box = grid.getBoundingClientRect();
    const style = getComputedStyle(grid);
    const gap = parseFloat(style.rowGap) || 0;
    const columns = style.gridTemplateColumns.split(' ').map(parseFloat);
    const rows = style.gridTemplateRows.split(' ').map(parseFloat);
    return { left: box.left, top: box.top, x: columns[0] + gap, y: rows[0] + gap };
  });
}

/**
 * Carry one named tile until its top-left corner sits on a chosen base cell.
 *
 * The drag is aimed at the tile's corner rather than at another tile, because a mixed-size board has
 * cells no tile occupies and the whole point is which cell the footprint claims. There is no target
 * tile to take a side of, so `aim` has no meaning here; use {@link dragTile} where it does.
 */
export async function dragTileToCell(
  page: Page,
  name: string,
  cell: { row: number; col: number },
  options: DragOptions & {
    via?: never;
    aim?: never;
    through?: { row: number; col: number }[];
  } = {},
): Promise<void> {
  const box = await page.getByRole('img', { name, exact: true }).first().boundingBox();
  if (!box) throw new Error(`no tile named ${name}`);
  const pitch = await gridPitch(page);
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const aim = (at: { row: number; col: number }) => ({
    x: start.x + (pitch.left + at.col * pitch.x - box.x),
    y: start.y + (pitch.top + at.row * pitch.y - box.y),
  });
  const { through, ...rest } = options;
  await dragBetween(page, start, aim(cell), { ...rest, via: through?.map(aim) });
}

/** Set one tile's size through the context menu, the only place a player can. */
export async function setTileSize(
  page: Page,
  name: string,
  size: 'Small' | 'Medium' | 'Large',
): Promise<void> {
  await page.getByRole('img', { name, exact: true }).first().click({ button: 'right' });
  await page.getByRole('menuitemradio', { name: size }).click();
  await page.waitForTimeout(150);
}

/** True when two footprints claim any base cell in common. */
export const cellsOverlap = (a: TileCell, b: TileCell): boolean =>
  a.row < b.row + b.span && b.row < a.row + a.span
  && a.col < b.col + b.span && b.col < a.col + a.span;

/**
 * Start recording how far any tile is pushed from its grid cell by an inline transform, per frame.
 *
 * A board that simply redraws never pushes anything; only a slide does. One rAF loop for the page's
 * life, emptied on each call, the same lifetime rule the other samplers here follow.
 */
export function startTransformSampler(page: Page): Promise<void> {
  return page.evaluate(() => {
    const w = window as unknown as { __shiftMax: number; __shiftLoop?: boolean };
    w.__shiftMax = 0;
    if (w.__shiftLoop) return;
    w.__shiftLoop = true;
    const tick = () => {
      const grid = document.querySelector('[data-radix-scroll-area-viewport] div.grid');
      for (const cell of grid ? [...grid.children] : []) {
        const matrix = new DOMMatrixReadOnly(getComputedStyle(cell).transform);
        w.__shiftMax = Math.max(w.__shiftMax, Math.hypot(matrix.m41, matrix.m42));
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/** The furthest any tile was pushed since the last {@link startTransformSampler}, in pixels. */
export function maxTransformSeen(page: Page): Promise<number> {
  return page.evaluate(() => Math.round((window as unknown as { __shiftMax: number }).__shiftMax));
}

/**
 * Carry one tile with a finger: press, hold still until the touch sensor lets go of the scroll, travel,
 * rest, and lift.
 *
 * Dispatched through the browser's own input pipeline rather than synthesized in the page, because a
 * scripted `TouchEvent` is untrusted and the board reads the real one. The still press is the gesture's
 * own: the touch sensor waits 200ms with the finger within a few pixels, which is what tells a drag
 * apart from a scroll.
 */
export async function touchDrag(
  page: Page,
  start: { x: number; y: number },
  target: { x: number; y: number },
  options: {
    steps?: number;
    hold?: number;
    aim?: 'center' | 'near' | 'far';
    reach?: number;
    /** Runs once the finger has arrived and rested, just before it lifts. */
    onHeld?: () => Promise<void>;
  } = {},
): Promise<void> {
  const { steps = 12, hold = 600, aim, reach, onHeld } = options;
  const end = aimAt(start, target, aim, reach);
  const cdp = await page.context().newCDPSession(page);
  const point = (x: number, y: number) => [{ x, y, radiusX: 1, radiusY: 1, force: 1 }];
  const send = (type: 'touchStart' | 'touchMove' | 'touchEnd', at?: { x: number; y: number }) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: at ? point(at.x, at.y) : [],
    });

  await send('touchStart', start);
  await page.waitForTimeout(300);
  for (let i = 1; i <= steps; i++) {
    await send('touchMove', {
      x: start.x + ((end.x - start.x) * i) / steps,
      y: start.y + ((end.y - start.y) * i) / steps,
    });
  }
  await page.waitForTimeout(hold);
  await onHeld?.();
  await send('touchEnd');
  await page.waitForTimeout(300);
  await cdp.detach();
}
