import { expect, test, type Page } from '@playwright/test';
import { cameraSettled, dragTile, openLibrary, tileOrder, tiles } from './tileDrag';

/**
 * The folder camera, measured as numbers rather than watched.
 *
 * Two layers move as one camera: the library board zooms into the folder tile and fades, while the
 * folder board grows out of that tile to full size. The contract a player can see is that the tile's
 * picture and the board's picture are the same picture at every instant — so the folder tile's
 * rectangle in the library layer must equal the region's rectangle in the folder layer on every frame,
 * in both directions, and the sizes in between must be real intermediate sizes rather than a swap.
 *
 * jsdom reaches none of this: no layout, no animation clock, and nothing painted.
 *
 * **Clips are proved by pixels, never by a rectangle.** `getBoundingClientRect` reports an element's own
 * box and knows nothing about an ancestor's clip, and a fix that widened one clip while an ancestor went
 * on cutting at the identical line passed exactly such a check. `elementFromPoint` is out too: the raised
 * frame and the scroll viewport both carry `pointer-events: none` while the camera runs, so a hit test
 * returns neither layer and every clip assertion would pass for the wrong reason. So each clip claim here
 * pauses the camera on a frame, photographs a strip, hides one layer, photographs the same strip again,
 * and compares the two images. Identical means that layer painted nothing there.
 */

/** The folder every test builds, named so the menus and the headings can find it. */
const FOLDER = 'Zoom';

/** Worlds folded into it. Five, so the board is two rows deep and the face leaves four of them out. */
const MEMBERS = 5;

/** How close two rectangles must stand to count as locked, in px. */
const LOCK_TOLERANCE = 1;

/** The window the scrolled tests use, short enough that a one-screen library board overflows it. */
const SHORT_WINDOW = 420;

/** A rectangle, in the shape the page-side recorder writes and `page.screenshot` reads. */
interface Box { x: number; y: number; width: number; height: number }

/** One animation frame of the camera, recorded inside the page. */
interface Frame {
  t: number;
  /** The folder tile's painted rectangle inside the library layer. */
  tile: Box;
  /** The region's painted rectangle inside the folder layer. */
  region: Box;
  /** The library layer's own opacity. Above zero for exactly as long as it is on screen. */
  outerOpacity: number;
  /** The folder layer's own opacity. */
  innerOpacity: number;
  /** The folder header: how transparent it is, and how far above its place it stands, in px. */
  header: { opacity: number; raised: number; height: number } | null;
  /** Every member tile in the folder layer, by id, at the opacity it is painted with. */
  members: Record<string, number>;
}

/** The page-side surface the helpers below drive. Installed once per test, after the app has loaded. */
interface CameraApi {
  /** The two boards on screen: the one carrying the folder's face, and the other one. */
  layers(): { outer: HTMLElement; inner: HTMLElement } | null;
  /** Every animation the camera is running right now. */
  animations(): Animation[];
  /** Hold the next camera at its first frame, so it can be read one frame at a time. */
  hold(): void;
  /** Put the held camera on one frame, and answer with the library layer's opacity there. */
  seek(t: number): number;
  /** The held camera's duration, in ms. */
  duration(): number;
  /** Let the held camera finish. */
  release(): void;
}

declare global {
  interface Window {
    __cam?: CameraApi;
    __camFrames?: Frame[];
    __camOn?: boolean;
    __camHeld?: Animation[] | null;
  }
}

/* -------------------------------------------------------------------------- */
/* The fixture                                                                 */
/* -------------------------------------------------------------------------- */

/** Open one tile's context menu and pick an entry from it. */
async function pickFromTileMenu(page: Page, tileIndex: number, item: string): Promise<void> {
  await tiles(page).nth(tileIndex).click({ button: 'right' });
  await page.getByRole('menuitem', { name: item, exact: true }).click();
  await expect(page.getByRole('menu')).toHaveCount(0);
}

/** The folder tile on the library board: the only tile drawing a folder's face. */
const folderTile = (page: Page) =>
  page.locator('[data-tile-id]').filter({ has: page.locator('[data-folder-face]') });

/** Fold the first board tile into a fresh folder, the only way one is ever made. */
async function newFolder(page: Page): Promise<void> {
  await pickFromTileMenu(page, 0, 'Create New Group…');
  await page.getByRole('textbox', { name: 'Group Name' }).fill(FOLDER);
  await page.getByRole('button', { name: 'Create Group' }).click();
  await expect(folderTile(page)).toHaveCount(1);
}

/**
 * A library holding one small folder of five worlds, standing in the board's top-left cell.
 *
 * Small on purpose. A small tile's face is two base columns wide, so the region is a fraction of the
 * board in both axes and the clip has something real to hold back; and the member in the board's corner
 * is wider than the tile, which is the case the clip guard must not read off that member's own box. Five
 * members leave four of them off the face, so the staged reveal is on screen.
 *
 * @param scrolling - Shorten the window and grow the one loose world, so the board overflows and the
 *   library can be scrolled. Five of six worlds are in the folder, so a board of default sizes is one
 *   row deep and cannot scroll at any window height the app still lays out properly in
 */
async function libraryWithFolder(page: Page, opts: { scrolling?: boolean } = {}): Promise<void> {
  if (opts.scrolling) {
    const size = page.viewportSize();
    if (size) await page.setViewportSize({ width: size.width, height: SHORT_WINDOW });
  }
  await openLibrary(page);

  await newFolder(page);
  for (let i = 1; i < MEMBERS; i++) await pickFromTileMenu(page, 0, FOLDER);

  if (opts.scrolling) {
    await tiles(page).first().click({ button: 'right' });
    await page.getByRole('menuitemradio', { name: 'Large' }).click();
    await expect(page.getByRole('menu')).toHaveCount(0);
  }

  await folderTile(page).click({ button: 'right' });
  await page.getByRole('menuitemradio', { name: 'Small' }).click();
  await expect(page.getByRole('menu')).toHaveCount(0);
  // The face redraws at the new tile size, and every measurement below reads it. The badge counts the
  // members it leaves out, so this also pins that the staged reveal has something to reveal.
  await expect(page.locator('[data-folder-badge]')).toHaveText(`+${MEMBERS - 1}`);

  await installCamera(page);
}

/**
 * Open the folder by its tile. A small folder tile carries no name bar, so the tile is the control.
 *
 * Pressed with the real mouse where the tile stands right now, rather than through the locator: a
 * locator click scrolls a partly hidden element fully into view first, and on a scrolled library that
 * is the folder tile — so the scroll the test set up would be undone in the same breath as the click.
 */
async function openFolder(page: Page): Promise<void> {
  const at = await page.evaluate(() => {
    const tile = document.querySelector<HTMLElement>('[data-folder-face]')
      ?.closest<HTMLElement>('[data-tile-id]');
    const viewport = tile?.closest<HTMLElement>('[data-radix-scroll-area-viewport]');
    if (!tile || !viewport) throw new Error('no folder tile on the board');
    const box = tile.getBoundingClientRect();
    const view = viewport.getBoundingClientRect();
    const top = Math.max(box.top, view.top);
    const bottom = Math.min(box.bottom, view.bottom);
    return { x: (Math.max(box.left, view.left) + Math.min(box.right, view.right)) / 2, y: (top + bottom) / 2, showing: bottom - top };
  });
  expect(at.showing, 'the folder tile must be on screen to be pressed').toBeGreaterThan(10);
  await page.mouse.click(at.x, at.y);
}

/** Leave the folder the way the header offers. */
const leaveFolder = (page: Page) => page.getByRole('button', { name: 'Library' }).click();

/* -------------------------------------------------------------------------- */
/* Reading the camera                                                          */
/* -------------------------------------------------------------------------- */

async function installCamera(page: Page): Promise<void> {
  await page.evaluate(() => {
    /** Everything a camera animation can be attached to. */
    const OWNED = '[data-folder-overlay], [data-library-focus-root], [data-folder-header]';
    const animations = (): Animation[] => document.getAnimations().filter((animation) => {
      // The camera is script-driven, so a plain `Animation` — never a `CSSTransition` or a
      // `CSSAnimation`. A hover transition on a control inside the header is otherwise picked up
      // alongside it, and one with a different duration makes every seek below mean something else.
      if (Object.getPrototypeOf(animation) !== Animation.prototype) return false;
      const effect = animation.effect;
      const target = effect && 'target' in effect ? (effect as KeyframeEffect).target : null;
      return !!target && !!target.closest(OWNED);
    });

    window.__cam = {
      layers() {
        const boards = [...document.querySelectorAll<HTMLElement>('[data-library-focus-root]')];
        // The library board is the one drawing the folder's face, whichever side of the swap it is on.
        const outer = boards.find((board) => board.querySelector('[data-folder-face]'));
        const inner = boards.find((board) => board !== outer);
        return outer && inner ? { outer, inner } : null;
      },
      animations,
      hold() {
        window.__camHeld = null;
        const arm = () => {
          // The raised frame is what says a camera is on screen at all, so nothing is held before it.
          const running = document.querySelector('[data-folder-overlay]') ? animations() : [];
          if (running.length) {
            // Everything on the page stops, not only the camera. The two photographs a clip check
            // compares are taken a moment apart, and any other animation still running — the endpoint
            // indicator's own pulse sits right above the board — changes pixels between them.
            document.getAnimations().forEach((animation) => animation.pause());
            window.__camHeld = running;
            return;
          }
          requestAnimationFrame(arm);
        };
        requestAnimationFrame(arm);
      },
      seek(t) {
        for (const animation of window.__camHeld ?? []) animation.currentTime = t;
        const outer = window.__cam?.layers()?.outer;
        return outer ? Number(getComputedStyle(outer).opacity) : -1;
      },
      duration() {
        const animation = (window.__camHeld ?? [])[0];
        return animation ? Number((animation.effect as KeyframeEffect).getTiming().duration) : 0;
      },
      release() {
        for (const animation of window.__camHeld ?? []) animation.play();
        window.__camHeld = null;
      },
    };
  });
}

/**
 * Start recording one sample per animation frame. Frames exist only while two boards are on screen, so
 * the buffer holds the motion and nothing on either side of it.
 *
 * @param region - The region's size in board pixels, from {@link regionOf}
 */
function startRecording(page: Page, region: { width: number; height: number }): Promise<void> {
  return page.evaluate((size) => {
    window.__camFrames = [];
    window.__camOn = true;
    const boxOf = (el: Element): Box => {
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, width: r.width, height: r.height };
    };
    const scaleOf = (el: Element) => new DOMMatrixReadOnly(getComputedStyle(el).transform).a;
    const liftOf = (el: Element) => -new DOMMatrixReadOnly(getComputedStyle(el).transform).f;

    const tick = () => {
      const pair = window.__cam?.layers();
      const face = pair?.outer.querySelector('[data-folder-face]');
      const tile = face?.closest<HTMLElement>('[data-tile-id]');
      if (pair && tile) {
        const innerBox = boxOf(pair.inner);
        const k = scaleOf(pair.inner);
        // The frozen copy first: on a fly-out the live header is already gone.
        const headers = [...document.querySelectorAll<HTMLElement>('[data-folder-header]')];
        const header = headers.find((el) => el.closest('[data-folder-overlay]')) ?? headers[0];
        const members: Record<string, number> = {};
        for (const member of pair.inner.querySelectorAll<HTMLElement>('[data-tile-id]')) {
          members[member.dataset.tileId ?? ''] = Number(getComputedStyle(member).opacity);
        }
        window.__camFrames?.push({
          t: performance.now(),
          tile: boxOf(tile),
          // The region stands at the folder layer's own corner, and scales with it.
          region: { x: innerBox.x, y: innerBox.y, width: size.width * k, height: size.height * k },
          outerOpacity: Number(getComputedStyle(pair.outer).opacity),
          innerOpacity: Number(getComputedStyle(pair.inner).opacity),
          header: header
            ? {
              opacity: Number(getComputedStyle(header).opacity),
              raised: liftOf(header),
              height: header.offsetHeight,
            }
            : null,
          members,
        });
      }
      if (window.__camOn) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, region);
}

/** Everything recorded since the last {@link startRecording}, with the loop stopped. */
function recorded(page: Page): Promise<Frame[]> {
  return page.evaluate(() => {
    window.__camOn = false;
    return window.__camFrames ?? [];
  });
}

/**
 * The region's size in board pixels, read off the resting folder tile.
 *
 * The face draws the region at the board's real size and shrinks it by one transform, so the region is
 * as wide as the tile. Dividing the tile by that scale gives the region's width, and the region has the
 * tile's own shape.
 *
 * The width comes from the grid tracks the tile claims, and the shape from the box it paints. Chromium
 * snaps a grid item's painted box to a device pixel, so it stands a fraction wider than its track, while
 * the face's scale is built from the track — taking both from the same reading drifts the region by
 * more than a pixel.
 */
function regionOf(page: Page): Promise<{ width: number; height: number }> {
  return page.evaluate(() => {
    const face = document.querySelector<HTMLElement>('[data-folder-face]');
    const tile = face?.closest<HTMLElement>('[data-tile-id]');
    const board = face?.querySelector<HTMLElement>('.grid');
    const grid = tile?.closest<HTMLElement>('[data-library-focus-root]');
    if (!face || !tile || !board || !grid) throw new Error('no folder face on the board');
    const scale = new DOMMatrixReadOnly(getComputedStyle(board).transform).a;
    const boardStyle = getComputedStyle(grid);
    const gap = parseFloat(boardStyle.columnGap) || 0;
    const cell = parseFloat(boardStyle.gridTemplateColumns.split(' ')[0]);
    const span = Number(getComputedStyle(tile).gridColumnEnd.replace('span ', '')) || 1;
    const box = tile.getBoundingClientRect();
    const width = (span * cell + (span - 1) * gap) / scale;
    return { width, height: box.height * (width / box.width) };
  });
}

/** The members the face draws. Everything else in the folder is a left-out member. */
function faceMembers(page: Page): Promise<string[]> {
  return page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-face-member]')]
    .map((el) => el.dataset.faceMember ?? ''));
}

/** The library board's scroll offset. */
const scrollOffset = (page: Page): Promise<number> => page.evaluate(() =>
  document.querySelector<HTMLElement>('[data-radix-scroll-area-viewport]')?.scrollTop ?? -1);

/* -------------------------------------------------------------------------- */
/* Reading the camera one paused frame at a time                               */
/* -------------------------------------------------------------------------- */

/** A camera held at its first frame, with the clock readings the strip tests need. */
interface Held {
  duration: number;
  /** Clock readings at which the library layer still has opacity. Dense, ending at the reveal point. */
  lit: number[];
  /** The first whole frame past the reveal point, where the library layer has gone. */
  dark: number;
}

/** One screen refresh at 60Hz, which is what "the next frame" means on the camera's clock. */
const FRAME_MS = 17;

/** Arm the hold, so the next camera stops on its first frame instead of running. */
const holdCamera = (page: Page): Promise<void> => page.evaluate(() => window.__cam?.hold());

/**
 * Wait for the held camera, and work out where the reveal point falls on its clock.
 *
 * The reveal point is not a time the test can be told; it is the instant the library layer reaches zero
 * opacity, which is the one thing about it a player can see. A bisection on that opacity finds it to the
 * millisecond, whichever way the clock runs — a fly-out plays the same keyframes reversed.
 */
async function heldCamera(page: Page): Promise<Held> {
  await page.waitForFunction(() => (window.__camHeld?.length ?? 0) > 0);
  return page.evaluate((frameMs) => {
    const cam = window.__cam;
    if (!cam) throw new Error('no camera installed');
    const duration = cam.duration();
    const lit = (t: number) => cam.seek(t) > 0;
    // A fly-in starts with the library on screen; a fly-out ends with it there.
    const startLit = lit(0);
    let on = startLit ? 0 : duration;
    let off = startLit ? duration : 0;
    for (let i = 0; i < 24; i++) {
      const mid = (on + off) / 2;
      if (lit(mid)) on = mid; else off = mid;
    }
    // Nine readings across the window the library is on screen: the first frame of the motion and the
    // last one before the reveal included, which is where both of the known faults showed.
    const readings: number[] = [];
    for (let i = 0; i <= 8; i++) readings.push(startLit ? (on * i) / 8 : on + ((duration - on) * i) / 8);
    cam.seek(readings[0]);
    // One whole frame past the boundary rather than the boundary itself: the bisection lands on the
    // instant opacity rounds to zero, which is a hair short of the reveal, and the clip steps open
    // exactly there. A frame later is the first frame a player sees the open clip on.
    const step = startLit ? frameMs : -frameMs;
    return { duration, lit: readings, dark: Math.min(duration, Math.max(0, off + step)) };
  }, FRAME_MS);
}

/** One paused frame: where each layer stands, and how solidly it is painted there. */
interface Paused {
  tile: Box;
  outer: Box;
  inner: Box;
  /** The board area, which is the frame both layers are held inside. */
  area: Box;
  opacity: { outer: number; inner: number };
}

/** Put the held camera on one frame and hand back what it paints there. */
function atFrame(page: Page, t: number): Promise<Paused> {
  return page.evaluate((time) => {
    const cam = window.__cam;
    const pair = cam?.layers();
    const frame = document.querySelector<HTMLElement>('[data-folder-overlay="board"]');
    const tile = pair?.outer.querySelector('[data-folder-face]')?.closest<HTMLElement>('[data-tile-id]');
    if (!cam || !pair || !frame || !tile) throw new Error('the camera is not on screen');
    cam.seek(time);
    const boxOf = (el: Element): Box => {
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, width: r.width, height: r.height };
    };
    return {
      tile: boxOf(tile),
      outer: boxOf(pair.outer),
      inner: boxOf(pair.inner),
      area: boxOf(frame),
      opacity: {
        outer: Number(getComputedStyle(pair.outer).opacity),
        inner: Number(getComputedStyle(pair.inner).opacity),
      },
    };
  }, t);
}

/** Which layer a pixel test is asking about. */
type Layer = 'outer' | 'inner';

/**
 * True when the named layer paints anything inside `strip`.
 *
 * Photograph the strip, hide that layer, photograph it again. Identical images mean the layer reached
 * none of those pixels — through its own clip or any ancestor's, which is the whole point. Hidden with
 * `visibility`, so nothing in the layout moves between the two shots.
 *
 * A third photograph, with the layer back, says whether anything else on the page moved while this ran.
 * It would make the reading meaningless, so it raises rather than answering.
 */
async function paintsIn(page: Page, layer: Layer, strip: Box): Promise<boolean> {
  const clip = {
    x: Math.round(strip.x),
    y: Math.round(strip.y),
    width: Math.max(1, Math.round(strip.width)),
    height: Math.max(1, Math.round(strip.height)),
  };
  const show = (visible: boolean) => page.evaluate(([which, on]) => {
    const target = window.__cam?.layers()?.[which as Layer];
    if (target) target.style.visibility = on ? '' : 'hidden';
  }, [layer, visible] as const);

  const shown = await page.screenshot({ clip });
  await show(false);
  const hidden = await page.screenshot({ clip });
  await show(true);
  const again = await page.screenshot({ clip });
  if (!shown.equals(again)) {
    throw new Error(`something else on the page moved while the ${layer} strip was read: ${JSON.stringify(clip)}`);
  }
  return !shown.equals(hidden);
}

/** Let the held camera finish, and wait for it to land. */
async function releaseCamera(page: Page): Promise<void> {
  await page.evaluate(() => window.__cam?.release());
  await cameraSettled(page);
}

/* -------------------------------------------------------------------------- */
/* Reading what was recorded                                                   */
/* -------------------------------------------------------------------------- */

/** How far the two rectangles stand apart, on their worst edge. */
const lockError = (frame: Frame): number => Math.max(
  Math.abs(frame.tile.x - frame.region.x),
  Math.abs(frame.tile.y - frame.region.y),
  Math.abs(frame.tile.width - frame.region.width),
  Math.abs(frame.tile.height - frame.region.height),
);

/** Distinct sizes the camera passed through, ignoring the two it rests at. A swap reports none. */
function intermediateSizes(frames: Frame[]): number {
  const widths = frames.map((frame) => frame.tile.width);
  const low = Math.min(...widths);
  const span = Math.max(...widths) - low;
  const seen = new Set<number>();
  for (const width of widths) {
    if (width > low + span * 0.1 && width < low + span * 0.9) seen.add(Math.round(width));
  }
  return seen.size;
}

/** Everything the camera has to hand back when it lands, either way round. */
async function expectNothingLeftBehind(page: Page): Promise<void> {
  await expect(page.locator('[data-folder-overlay]')).toHaveCount(0);
  // The computed transform, not the inline one: the camera moves the boards through the animation API
  // rather than through a style attribute, and an animation left in place holds its end state with
  // nothing in `style` to show for it. That is what dnd-kit then measures the board against.
  const leftovers = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>(
    '[data-library-focus-root], [data-folder-header]',
  )].map((el) => `${el.style.transform}|${getComputedStyle(el).transform}`));
  expect(leftovers, 'a board was left standing where the camera put it')
    .toEqual(leftovers.map(() => '|none'));
}

/* -------------------------------------------------------------------------- */
/* The camera locks the two layers together                                    */
/* -------------------------------------------------------------------------- */

/** Scroll the library, and prove it really moved: an unscrolled board tests nothing that needs one. */
async function scrollLibrary(page: Page): Promise<number> {
  const room = await page.evaluate(() => {
    const viewport = document.querySelector<HTMLElement>('[data-radix-scroll-area-viewport]');
    return viewport ? viewport.scrollHeight - viewport.clientHeight : 0;
  });
  expect(room, 'the library board must overflow, or the scroll proves nothing').toBeGreaterThan(30);
  const offset = Math.min(60, Math.round(room / 2));
  await page.evaluate((to) => {
    const viewport = document.querySelector<HTMLElement>('[data-radix-scroll-area-viewport]');
    if (viewport) viewport.scrollTop = to;
  }, offset);
  expect(await scrollOffset(page)).toBe(offset);
  return offset;
}

test.describe('the camera carries the tile into the board', () => {
  test('flying in: the layers stay locked, travel through real sizes, and hold the header back', async ({ page }) => {
    await libraryWithFolder(page, { scrolling: true });
    const region = await regionOf(page);
    const onFace = await faceMembers(page);
    await scrollLibrary(page);

    await startRecording(page, region);
    await openFolder(page);
    await cameraSettled(page);
    const frames = await recorded(page);

    expect(frames.length, 'the camera must have run').toBeGreaterThan(8);
    // The lock itself: the tile's picture in the library layer and the region's picture in the folder
    // layer are one rectangle on every frame. Dropping the camera's origin-offset term pulls them apart
    // by the library's scroll offset plus the header's own height.
    for (const frame of frames) expect(lockError(frame)).toBeLessThanOrEqual(LOCK_TOLERANCE);
    // Real travel, not a swap dressed as one.
    expect(intermediateSizes(frames)).toBeGreaterThanOrEqual(4);
    const widths = frames.map((frame) => frame.tile.width);
    expect(Math.max(...widths)).toBeGreaterThan(Math.min(...widths) * 1.3);

    // The header waits for the library to go. Until then it is invisible and stands a header's height
    // above its place, so it never sits against the tile the camera is flying into.
    const lit = frames.filter((frame) => frame.outerOpacity > 0);
    expect(lit.length).toBeGreaterThan(4);
    for (const frame of lit) {
      expect(frame.header).not.toBeNull();
      expect(frame.header?.opacity, 'the header showed over the library').toBeLessThan(0.01);
      expect(frame.header?.raised, 'the header stood in its place over the library')
        .toBeGreaterThan((frame.header?.height ?? 0) * 0.9);
    }
    const last = frames[frames.length - 1];
    expect(last.header?.opacity, 'the header never arrived').toBeGreaterThan(0.5);
    expect(last.header?.raised, 'the header never came down').toBeLessThan((last.header?.height ?? 0) * 0.25);

    // The members the face leaves out wait for the same moment, and they arrive together rather than in
    // a growing slice. One opacity between them on every frame is what makes it a fade and not a wipe.
    const shown = new Set(onFace);
    for (const frame of frames) {
      const leftOut = Object.entries(frame.members)
        .filter(([id]) => !shown.has(id)).map(([, opacity]) => opacity);
      expect(leftOut.length).toBe(MEMBERS - onFace.length);
      expect(Math.max(...leftOut) - Math.min(...leftOut), 'the left-out members arrived as a wipe')
        .toBeLessThan(0.01);
      if (frame.outerOpacity > 0) {
        expect(Math.max(...leftOut), 'a left-out member showed over the library').toBeLessThan(0.01);
      }
    }

    await expectNothingLeftBehind(page);
    await expect(page.getByRole('textbox', { name: 'Group name' })).toHaveValue(FOLDER);
  });

  test('flying out: the same lock in reverse, and the library scroll comes back', async ({ page }) => {
    await libraryWithFolder(page, { scrolling: true });
    const region = await regionOf(page);
    const before = await scrollLibrary(page);

    await openFolder(page);
    await cameraSettled(page);

    await startRecording(page, region);
    await leaveFolder(page);
    await cameraSettled(page);
    const frames = await recorded(page);

    expect(frames.length, 'the camera must have run').toBeGreaterThan(8);
    for (const frame of frames) expect(lockError(frame)).toBeLessThanOrEqual(LOCK_TOLERANCE);
    expect(intermediateSizes(frames)).toBeGreaterThanOrEqual(4);

    // Mirrored: the header leaves first, so it has already gone by the time the library has any opacity.
    const lit = frames.filter((frame) => frame.outerOpacity > 0);
    expect(lit.length).toBeGreaterThan(4);
    for (const frame of lit) {
      expect(frame.header?.opacity).toBeLessThan(0.01);
      expect(frame.header?.raised).toBeGreaterThan((frame.header?.height ?? 0) * 0.9);
    }
    const first = frames[0];
    expect(first.header?.opacity).toBeGreaterThan(0.5);
    expect(first.header?.raised).toBeLessThan((first.header?.height ?? 0) * 0.25);

    await expectNothingLeftBehind(page);
    expect(await scrollOffset(page)).toBe(before);
    await expect(folderTile(page)).toHaveCount(1);
  });
});

/* -------------------------------------------------------------------------- */
/* What the clips let through, in pixels                                       */
/* -------------------------------------------------------------------------- */

test.describe('what the clips let through, in pixels', () => {
  /** Strips beside the tile's frame, inside the board area, where an unclipped folder board would show. */
  function beside(tile: Box, inner: Box, area: Box): Box[] {
    const right = Math.min(inner.x + inner.width, area.x + area.width) - (tile.x + tile.width);
    const below = Math.min(inner.y + inner.height, area.y + area.height) - (tile.y + tile.height);
    const strips: Box[] = [];
    if (right > 8 && tile.height > 8) {
      strips.push({
        x: tile.x + tile.width + 1,
        y: Math.max(tile.y + 2, area.y + 1),
        width: Math.min(40, right - 2),
        height: Math.min(30, tile.height - 4),
      });
    }
    if (below > 8 && tile.width > 8) {
      strips.push({
        x: Math.max(tile.x + 2, area.x + 1),
        y: tile.y + tile.height + 1,
        width: Math.min(40, tile.width - 4),
        height: Math.min(30, below - 2),
      });
    }
    return strips;
  }

  test('the folder board never shows past the tile frame while the library is on screen', async ({ page }) => {
    await libraryWithFolder(page);

    await holdCamera(page);
    await openFolder(page);
    const held = await heldCamera(page);

    let measured = 0;
    for (const t of held.lit) {
      const { tile, inner, area } = await atFrame(page, t);
      for (const strip of beside(tile, inner, area)) {
        measured++;
        expect(await paintsIn(page, 'inner', strip),
          `the folder board reached past the tile frame at ${Math.round(t)}ms`).toBe(false);
      }
    }
    // A guard that measured nothing would pass here too, so pin how much of it was measured.
    expect(measured, 'no strip stood outside the tile frame, so nothing was measured')
      .toBeGreaterThanOrEqual(held.lit.length);

    // The positive control, on the same frames and by the same method: inside the tile's frame the
    // folder board does paint. Without it, a layer that painted nothing at all would pass every check.
    const mid = await atFrame(page, held.lit[held.lit.length - 1]);
    expect(await paintsIn(page, 'inner', {
      x: mid.tile.x + 3,
      y: mid.tile.y + 3,
      width: Math.max(8, mid.tile.width - 6),
      height: Math.max(8, mid.tile.height - 6),
    }), 'the folder board painted nothing inside the tile frame either').toBe(true);

    // And the step: one frame past the reveal point the clip is open, so the board reaches the strip it
    // was held out of. This is what fails when the clip opens as a wipe, or from the first frame.
    const open = await atFrame(page, held.dark);
    const [strip] = beside(open.tile, open.inner, open.area);
    expect(strip, 'the folder board had no room to open into').toBeTruthy();
    expect(await paintsIn(page, 'inner', strip),
      'the clip never opened, so the guard above proves nothing').toBe(true);

    await releaseCamera(page);
  });

  test('neither board is cut off at the top by the strip the header takes', async ({ page }) => {
    await libraryWithFolder(page);
    // The board's top row, unscrolled: the only place the header's own strip can cut a layer.
    expect(await scrollOffset(page)).toBe(0);
    const corner = await page.evaluate(() => {
      const tile = document.querySelector<HTMLElement>('[data-folder-face]')
        ?.closest<HTMLElement>('[data-tile-id]');
      const board = tile?.closest<HTMLElement>('[data-library-focus-root]');
      if (!tile || !board) throw new Error('no folder tile on the board');
      return Math.round(tile.getBoundingClientRect().top - board.getBoundingClientRect().top);
    });
    expect(corner, 'the folder tile must stand in the board top row').toBeLessThan(2);

    await holdCamera(page);
    await openFolder(page);
    const held = await heldCamera(page);

    const measured = { outer: 0, inner: 0 };
    for (const t of held.lit) {
      const at = await atFrame(page, t);
      for (const layer of ['outer', 'inner'] as Layer[]) {
        // A layer still fading in paints nothing anywhere, so it can say nothing about its own top.
        if (at.opacity[layer] < 0.5) continue;
        const box = at[layer];
        // The board area has to reach the layer in the first place. A board area cut to the viewport
        // the swap leaves behind starts one header height down, and the layer above it is simply gone.
        expect(box.y, `the ${layer} board stood above the board area at ${Math.round(t)}ms`)
          .toBeGreaterThanOrEqual(at.area.y - 1);
        // The layer's own first rows. A clip laid along the viewport's top edge takes exactly these.
        const strip = {
          x: Math.max(box.x + 2, at.area.x + 1),
          y: box.y,
          width: Math.min(60, box.width - 4),
          height: 4,
        };
        if (strip.width < 4) continue;
        measured[layer]++;
        expect(await paintsIn(page, layer, strip),
          `the ${layer} board lost its top edge at ${Math.round(t)}ms`).toBe(true);
      }
    }
    // Each board has to have been read on its own, or one of them was never guarded at all.
    expect(measured.outer, 'the library board was never read at its top edge').toBeGreaterThanOrEqual(3);
    expect(measured.inner, 'the folder board was never read at its top edge').toBeGreaterThanOrEqual(3);

    await releaseCamera(page);
  });

  test('flying out, the zoomed library board stays inside the board area', async ({ page }) => {
    // The scrolled fixture, because this is the one guard the board's own size decides. A library board
    // that fits inside the board area only spills out of it once the zoom has nearly faded, where a
    // pixel test reads almost nothing. A board taller than the area spills at full opacity, and its
    // scroll also carries its first rows above the area, so both strips have something to measure.
    await libraryWithFolder(page, { scrolling: true });
    await scrollLibrary(page);
    await openFolder(page);
    await cameraSettled(page);

    await holdCamera(page);
    await leaveFolder(page);
    const held = await heldCamera(page);

    const windowHeight = page.viewportSize()?.height ?? 0;
    let measured = 0;
    for (const t of held.lit) {
      const at = await atFrame(page, t);
      // The library board arrives blown up by the zoom factor, so without the scroll viewport's own
      // overflow it would reach over the tabs above the board and past the window below it.
      const above = { x: at.area.x + 2, y: at.area.y - 6, width: at.area.width - 4, height: 5 };
      if (above.y >= 0) {
        measured++;
        expect(await paintsIn(page, 'outer', above),
          `the library board reached above the board area at ${Math.round(t)}ms`).toBe(false);
      }
      const below = { x: at.area.x + 2, y: at.area.y + at.area.height + 1, width: at.area.width - 4, height: 5 };
      if (below.y + below.height <= windowHeight) {
        measured++;
        expect(await paintsIn(page, 'outer', below),
          `the library board reached below the board area at ${Math.round(t)}ms`).toBe(false);
      }
    }
    expect(measured, 'the board area filled the window, so nothing was measured')
      .toBeGreaterThanOrEqual(held.lit.length);

    // The positive control: on the same frame and by the same method, the blown-up library board does
    // paint inside the board area. Without it a layer painting nothing at all would pass every check.
    const inside = await atFrame(page, held.lit[held.lit.length - 1]);
    expect(await paintsIn(page, 'outer', {
      x: inside.area.x + 2,
      y: inside.area.y + 2,
      width: Math.min(60, inside.area.width - 4),
      height: 20,
    }), 'the library board painted nothing inside the board area either').toBe(true);

    await releaseCamera(page);
  });
});

/* -------------------------------------------------------------------------- */
/* The guards, and what the camera must not break                              */
/* -------------------------------------------------------------------------- */

test.describe('reduced motion', () => {
  test('opens and leaves the folder with no camera at all', async ({ page }) => {
    // Emulated before the app loads, so the first render already reads the query the hook watches.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await libraryWithFolder(page);
    // A watcher rather than a check afterwards: a camera that ran and finished leaves nothing to find.
    await page.evaluate(() => {
      window.__camOn = true;
      window.__camHeld = null;
      const tick = () => {
        if (document.querySelector('[data-folder-overlay]')) window.__camHeld = [];
        if (window.__camOn) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    await openFolder(page);
    await expect(page.getByRole('textbox', { name: 'Group name' })).toHaveValue(FOLDER);
    await leaveFolder(page);
    await expect(folderTile(page)).toHaveCount(1);

    const raised = await page.evaluate(() => {
      window.__camOn = false;
      return window.__camHeld !== null;
    });
    expect(raised, 'a camera ran under reduced motion').toBe(false);
    await expectNothingLeftBehind(page);
  });
});

test('a tile still drags after a fly-in and a fly-out', async ({ page }) => {
  // A lighter folder than the fixture above: this is about what the camera hands back when it lands,
  // and a board needs loose tiles left on it to sort.
  await openLibrary(page);
  await newFolder(page);

  const names = await tileOrder(page);
  await openFolder(page);
  await cameraSettled(page);
  await leaveFolder(page);
  await cameraSettled(page);

  // A leftover transform or a leftover overlay is what dnd-kit measures, and the drop lands elsewhere.
  await dragTile(page, 1, 0, { aim: 'far' });
  expect(await tileOrder(page)).toEqual([names[1], names[0], ...names.slice(2)]);
});
