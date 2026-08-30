import { test, expect, type Page } from '@playwright/test';
import {
  carriedCopies,
  copySamples,
  dragTile,
  intermediates,
  now,
  openLibrary,
  startCopySampler,
  startTileSampler,
  tileCenter,
  tileOrder,
  tileSamples,
  tiles,
  travelOf,
} from './tileDrag';

/**
 * The library board's drag behavior, as the flat grid did it.
 *
 * This is a parity suite, not a feature suite. Every rule below was measured against the library as it
 * stood before the tile board landed, by running this same file in a worktree checked out at that commit.
 * Anything it asserts, the old grid did; anything the old grid did not do, it does not assert. That is the
 * whole point: four attempts at "the drag feels right again" failed because parity was argued rather than
 * measured, so the definition now lives here as executable checks instead of in anyone's description.
 *
 * The selectors are deliberately app-level — thumbnail alt text, bounding boxes, the absence of a folder
 * heading — because they have to mean the same thing in both implementations. Nothing here knows whether
 * the board displaces a tile with a transform or with a grid slot, or whether the carried tile is the
 * element under the pointer or a portal following it.
 *
 * @see e2e/tileDrag.ts for the gesture and sampling helpers.
 */

/** A folder, if a drag ever made one. Must never appear: a drag moves a tile and nothing else. */
function folders(page: Page) {
  return page.getByRole('heading', { name: 'New Group' });
}

/** Group affordances drawn on a tile mid-drag. The old grid had none, so neither may the new one. */
function rings(page: Page): Promise<number> {
  return page.evaluate(
    () => document.querySelectorAll('[data-radix-scroll-area-viewport] .ring-primary').length,
  );
}

test.describe('library drag parity', () => {
  test('R1/R2 — the displaced tile starts moving at once, and slides there', async ({ page }) => {
    await openLibrary(page);
    const names = await tileOrder(page);
    const from = await tileCenter(page, 0);
    const to = await tileCenter(page, 1);
    const step = Math.hypot(to.x - from.x, to.y - from.y);
    const unit = { x: (to.x - from.x) / step, y: (to.y - from.y) / step };

    await startTileSampler(page, [names[1]]);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    // Clear the activation distance, then travel to a third of the way — far enough to be a real drag,
    // near enough that the carried tile's center is still closest to its own slot.
    await page.mouse.move(from.x + unit.x * 12, from.y + unit.y * 12);
    await page.mouse.move(from.x + (to.x - from.x) * 0.33, from.y + (to.y - from.y) * 0.33, { steps: 6 });
    // Long enough that anything the board was going to do at this position has already happened, so the
    // clock below times the crossing and nothing else.
    await page.waitForTimeout(400);

    const crossed = await now(page);
    await page.mouse.move(to.x, to.y, { steps: 4 });
    await page.waitForTimeout(700);
    const recorded = await tileSamples(page);
    await page.mouse.up();

    const travel = travelOf(recorded, names[1]);
    const moved = travel.find(({ t, d }) => t >= crossed && d > step * 0.2);
    expect(moved, 'the displaced tile never moved').toBeDefined();
    // R1: the slide-aside is the answer to the crossing, not to a timer that ran afterwards. The board
    // used to wait 150ms before reading a hover at all, which is exactly what this number refuses.
    expect(moved!.t - crossed).toBeLessThan(120);
    // R2: several distinct in-between positions. A tile that jumped its slot reports none.
    expect(intermediates(recorded, names[1], step)).toBeGreaterThanOrEqual(2);
  });

  test('R3 — the drop lands on the slot it was released over', async ({ page }) => {
    await openLibrary(page);
    const names = await tileOrder(page);

    await dragTile(page, 2, 0);

    // The carried tile takes the slot; everything it passed shifts one place along.
    expect(await tileOrder(page)).toEqual([names[2], names[0], names[1], ...names.slice(3)]);
    await expect(folders(page)).toHaveCount(0);
  });

  test('R4 — going out and coming back leaves the order alone', async ({ page }) => {
    await openLibrary(page);
    const names = await tileOrder(page);
    const from = await tileCenter(page, 0);
    const to = await tileCenter(page, 1);

    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 12, from.y + 12);
    await page.mouse.move(to.x, to.y, { steps: 10 });
    await page.waitForTimeout(400);
    await page.mouse.move(from.x, from.y, { steps: 10 });
    await page.waitForTimeout(400);
    await page.mouse.up();
    await page.waitForTimeout(250);

    expect(await tileOrder(page)).toEqual(names);
  });

  // The rule as written also claimed that releasing away from the board commits nothing. Run against the
  // old grid, that turned out to be false: `closestCenter` always returns its nearest droppable, however
  // far away the pointer is, so a release over the footer dropped the tile beside whichever tile was
  // closest. Parity is what the old code did, so that half is not asserted here.
  test('R5 — Escape mid-drag commits nothing', async ({ page }) => {
    await openLibrary(page);
    const names = await tileOrder(page);

    await dragTile(page, 0, 2, { cancel: true });

    expect(await tileOrder(page)).toEqual(names);
  });

  test('R6 — the first and the last slot are both reachable', async ({ page }) => {
    await openLibrary(page);
    const names = await tileOrder(page);

    await dragTile(page, 1, 0);
    expect((await tileOrder(page))[0]).toBe(names[1]);

    // The far end, scrolled to first: dragging across a scroll boundary is a different measurement, and
    // this one is about whether the end slot can be landed on at all.
    const last = names.length - 1;
    await tiles(page).nth(last).scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    const before = await tileOrder(page);
    await dragTile(page, last - 1, last);
    const after = await tileOrder(page);
    expect(after[last]).toBe(before[last - 1]);
  });

  test('R7 — a flick and a crawl end in the same place', async ({ page }) => {
    await openLibrary(page);
    const names = await tileOrder(page);

    await dragTile(page, 2, 0, { steps: 3, hold: 0 });
    const flicked = await tileOrder(page);

    // Put the board back by carrying the same tile home, rather than reloading: the order persists, so a
    // reload would start the second half from the result of the first.
    await dragTile(page, 0, 2);
    expect(await tileOrder(page)).toEqual(names);

    // The same gesture again, slowly enough to rest on every tile it crosses.
    await dragTile(page, 2, 0, { steps: 20, interval: 40, hold: 800 });

    expect(await tileOrder(page)).toEqual(flicked);
  });

  test('R8 — the order survives a reload', async ({ page }) => {
    await openLibrary(page);
    const names = await tileOrder(page);

    await dragTile(page, 2, 0);
    const reordered = await tileOrder(page);
    expect(reordered).not.toEqual(names);

    await page.reload();
    await page.getByRole('button', { name: 'Delete world' }).first().waitFor();

    expect(await tileOrder(page)).toEqual(reordered);
  });

  test('R9 — a press that barely moves is still a click, not a drag', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'the mouse threshold; touch has its own test');
    await openLibrary(page);
    const names = await tileOrder(page);
    const at = await tileCenter(page, 1);

    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await page.mouse.move(at.x + 4, at.y);
    await page.mouse.up();

    expect(await tileOrder(page)).toEqual(names);
    // Under the sensor's distance the press stays a plain click, so the tile opens the way a tap does.
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('R9 — touch taps open and touch swipes scroll', async ({ page }) => {
    test.skip(test.info().project.name !== 'mobile', 'needs a touch screen');
    await openLibrary(page);
    const names = await tileOrder(page);
    const at = await tileCenter(page, 1);

    await page.touchscreen.tap(at.x, at.y);
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // A swipe without the press-and-hold is a scroll, so the board must be exactly where it was.
    const scroller = page.locator('[data-radix-scroll-area-viewport]').first();
    const top = await scroller.evaluate((el) => el.scrollTop);
    await touchSwipe(page, at, { x: at.x, y: at.y - 240 });

    expect(await tileOrder(page)).toEqual(names);
    expect(await scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(top);
  });

  test('R10 — parking on a tile and waiting still only moves the tile', async ({ page }) => {
    await openLibrary(page);
    const names = await tileOrder(page);
    let ringsWhileParked = -1;

    // The exact gesture that used to fold two tiles into a folder: dead center, held well past any
    // dwell a timer could have wanted.
    await dragTile(page, 0, 1, { hold: 1400, onHeld: async () => { ringsWhileParked = await rings(page); } });

    expect(ringsWhileParked).toBe(0);
    await expect(folders(page)).toHaveCount(0);
    await expect(tiles(page)).toHaveCount(names.length);
    expect(await tileOrder(page)).toEqual([names[1], names[0], ...names.slice(2)]);
  });

  test('R11 — one translucent copy of the carried tile, and no ghost left behind', async ({ page }) => {
    await openLibrary(page);
    const names = await tileOrder(page);
    let copies: number[] = [];

    await dragTile(page, 0, 1, {
      hold: 500,
      onHeld: async () => { copies = await carriedCopies(page, names[0]); },
    });

    // The old grid floated the card itself at half opacity and left its slot empty, so a player saw one
    // tile in one place. Two copies, or a solid one, is a board drawing its own machinery.
    expect(copies.filter((opacity) => opacity > 0.01)).toHaveLength(1);
    expect(copies.filter((opacity) => opacity > 0.9)).toHaveLength(0);
  });

  test('R12 — the released tile settles in one frame, as one copy', async ({ page }) => {
    await openLibrary(page);
    const names = await tileOrder(page);
    const box = (await tiles(page).nth(0).boundingBox())!;
    const to = await tileCenter(page, 1);

    // Grabbed near a corner, not the center: the carried tile keeps its grab point under the pointer,
    // so at release it sits offset from the slot it will land in — the misalignment a real hand
    // produces, and the one that exposes any settle animation between the two positions.
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.2 + 12, box.y + box.height * 0.2);
    // Long enough for any mid-drag slide (200ms) to finish, short enough that the park cannot arm the
    // tile board's group drop — the offset grab leaves the claim on a neighbor that cannot dodge, and
    // holding that past the group dwell is the grouping gesture now.
    await page.mouse.move(to.x, to.y, { steps: 10 });
    await page.waitForTimeout(100);
    await startCopySampler(page, names[0]);
    const released = await now(page);
    await page.mouse.up();
    await page.waitForTimeout(500);
    const frames = await copySamples(page);

    // The old grid's settle was one element snapping to its slot and to full opacity on the release
    // frame — instant, and measured so: its transition-opacity class was dead, overridden by the
    // sortable's inline transform-only transition. Frame by frame that means: never two visible copies
    // (a release flash), never none (a blink), and nothing translucent left shortly after release
    // (a settle animation the old board did not have).
    expect(frames.length).toBeGreaterThan(10);
    for (const { copies } of frames) {
      expect(copies.filter((opacity) => opacity > 0.01)).toHaveLength(1);
    }
    const settled = frames.filter(({ t }) => t > released + 150);
    expect(settled.length).toBeGreaterThan(5);
    for (const { copies } of settled) {
      expect(Math.max(...copies)).toBeGreaterThan(0.99);
    }
  });

  test('R3 — the detailed layout reorders by the same rules', async ({ page }) => {
    await openLibrary(page, 'detailed');
    const names = await tileOrder(page);

    // Neighbors, not the ends: a detailed card is tall enough that the phone shows barely two of them,
    // and a drag that has to auto-scroll first is a different measurement than this one.
    await dragTile(page, 1, 0);

    expect(await tileOrder(page)).toEqual([names[1], names[0], ...names.slice(2)]);
    await expect(folders(page)).toHaveCount(0);
  });
});

/**
 * A finger dragging across the screen, dispatched through the browser's own input pipeline rather than
 * synthesized in the page — a scripted `TouchEvent` is untrusted, and the behavior under test is what the
 * real one does.
 */
async function touchSwipe(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  const cdp = await page.context().newCDPSession(page);
  const point = (x: number, y: number) => [{ x, y, radiusX: 1, radiusY: 1, force: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(from.x, from.y) });
  for (let i = 1; i <= 10; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: point(from.x + ((to.x - from.x) * i) / 10, from.y + ((to.y - from.y) * i) / 10),
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(400);
  await cdp.detach();
}
