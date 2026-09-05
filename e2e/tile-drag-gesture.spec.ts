import { test, expect, type Page } from '@playwright/test';
import {
  boardCells,
  dragBetween,
  dragTileToCell,
  gridPitch,
  intermediates,
  openLibrary,
  setTileSize,
  startTileSampler,
  tileOrder,
  tileSamples,
  tiles,
  touchDrag,
  type DragOptions,
  type TileCell,
} from './tileDrag';

/**
 * The Android-style tile drag, measured on the real board.
 *
 * Every case is a gesture a player makes and an assertion about where tiles end up. The cells come from
 * the browser's own resolved grid placement, so a case passes only when a player would see it — nothing
 * here reads the gesture reader's bookkeeping, which its unit tests cover, and nothing here claims a
 * duration the Browser pane could throttle.
 *
 * Two of the promises the drag makes are measured elsewhere and are not repeated here: a near-side rest
 * ringing the target and grouping on release is R10 in
 * [library-drag-parity.spec.ts](e2e/library-drag-parity.spec.ts), and adding to a standing folder the
 * same way is in [mixed-size-drag.spec.ts](e2e/mixed-size-drag.spec.ts). The touch half of both is here,
 * because a finger reaches the board through a different sensor than a mouse.
 *
 * @see e2e/tileDrag.ts for the gesture, cell and sampling helpers.
 */

/** Base-cell columns at this viewport, mirroring the app's fit rule. */
const columnsFor = (page: Page) =>
  Math.max(1, Math.floor((page.viewportSize()!.width - 32 + 16) / (296 + 16))) * 2;

/** A board of six smalls, and the names in the order the library seeds them. */
async function smallBoard(page: Page): Promise<string[]> {
  await openLibrary(page);
  const names = await tileOrder(page);
  for (const name of names) await setTileSize(page, name, 'Small');
  return names;
}

/** A tile's center and its box, for aiming a carry at one half of it. */
async function centerOf(page: Page, name: string) {
  const box = await page.getByRole('img', { name, exact: true }).first().boundingBox();
  if (!box) throw new Error(`no tile named ${name}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, reach: Math.min(box.width, box.height) / 4 };
}

/** Carry one named tile onto another, resting on the named half of it. */
async function carry(
  page: Page,
  from: string,
  to: string,
  options: DragOptions = {},
): Promise<void> {
  const start = await centerOf(page, from);
  const end = await centerOf(page, to);
  await dragBetween(page, start, end, { reach: end.reach, ...options });
}

/** The cells the setup has to have produced, so a drifted board fails as a setup, not as a rule. */
function expectBoard(cells: Record<string, TileCell>, expected: Record<string, [number, number, number]>) {
  const actual: Record<string, [number, number, number]> = {};
  for (const [name, cell] of Object.entries(cells)) actual[name] = [cell.row, cell.col, cell.span];
  expect(actual).toEqual(expected);
}

test.describe('the drag waits for the hand to rest', () => {
  test.skip(({ page }) => columnsFor(page) < 6, 'a phone board is two cells wide; the touch cases cover it');

  test('travel across a row moves nothing, and the release still lands the tile', async ({ page }) => {
    const [a, b, c, d, e, f] = await smallBoard(page);
    expectBoard(await boardCells(page), {
      [a]: [0, 0, 1], [b]: [0, 1, 1], [c]: [0, 2, 1], [d]: [0, 3, 1], [e]: [1, 0, 1], [f]: [1, 1, 1],
    });
    await startTileSampler(page, [b, c, d, e, f]);

    // Across three tiles and on into the open cell past them, stepped slowly enough to paint frames but
    // never dwelling anywhere long enough for a rest to arm. Released the moment it arrives.
    await dragTileToCell(page, a, { row: 0, col: 4 }, { steps: 16, interval: 20, hold: 0 });

    // Not one of the tiles it swept moved a pixel at any painted frame of the gesture.
    for (const name of [b, c, d, e, f]) {
      const path = (await tileSamples(page)).map((sample) => sample.at[name]).filter((at) => at !== null);
      expect(path.length, `${name} was never painted`).toBeGreaterThan(5);
      for (const at of path) {
        expect(Math.hypot(at.x - path[0].x, at.y - path[0].y), `${name} moved under the sweep`)
          .toBeLessThan(2);
      }
    }

    // And the quick release still landed the carried tile on the cell under the hand.
    const after = await boardCells(page);
    expectBoard(after, {
      [a]: [0, 4, 1], [b]: [0, 1, 1], [c]: [0, 2, 1], [d]: [0, 3, 1], [e]: [1, 0, 1], [f]: [1, 1, 1],
    });

    // The hole it left is still open after a round trip through storage: the arrangement is the
    // player's, and nothing repacks it on the way back in.
    await page.reload();
    await tiles(page).nth(2).waitFor();
    expect(await boardCells(page)).toEqual(after);
  });

  test('a rest on the far side of a tile in the row pushes the row toward the hole', async ({ page }) => {
    const [a, b, c, d, e, f] = await smallBoard(page);
    const pitch = await gridPitch(page);
    await startTileSampler(page, [b, c, d]);

    await carry(page, a, d, { aim: 'far', hold: 700 });

    // One cell each, toward the hole the carried tile left, and the carried tile takes the far end.
    expectBoard(await boardCells(page), {
      [a]: [0, 3, 1], [b]: [0, 0, 1], [c]: [0, 1, 1], [d]: [0, 2, 1], [e]: [1, 0, 1], [f]: [1, 1, 1],
    });

    // In one motion: each of the three was painted at in-between positions rather than jumping a cell.
    const samples = await tileSamples(page);
    for (const name of [b, c, d]) {
      expect(intermediates(samples, name, pitch.x), `${name} snapped instead of sliding`)
        .toBeGreaterThanOrEqual(2);
    }
  });

  test('a rest on a tile in neither the row nor the column swaps it into the hole', async ({ page }) => {
    const [a, b, c, d, e, f] = await smallBoard(page);

    await carry(page, a, f, { aim: 'far', hold: 700 });

    // The two traded spots. Nothing the carry passed over — the tile beside it, the tile below it —
    // was touched, which is the whole difference between a swap and a push.
    expectBoard(await boardCells(page), {
      [a]: [1, 1, 1], [b]: [0, 1, 1], [c]: [0, 2, 1], [d]: [0, 3, 1], [e]: [1, 0, 1], [f]: [0, 0, 1],
    });
  });

  test('a bigger tile rested on a block of smalls swaps them into its hole, offsets intact', async ({ page }) => {
    const [a, b, c, d, e, f] = await smallBoard(page);
    await setTileSize(page, a, 'Medium');
    // A two-by-two block off both of the medium's axes, so the rest reads as a swap rather than a push.
    // Each leg is a carry into open board, which moves nothing else.
    await dragTileToCell(page, b, { row: 2, col: 3 });
    await dragTileToCell(page, c, { row: 3, col: 2 });
    await dragTileToCell(page, d, { row: 3, col: 3 });
    expectBoard(await boardCells(page), {
      [a]: [0, 0, 2], [e]: [2, 0, 1], [f]: [2, 2, 1], [b]: [2, 3, 1], [c]: [3, 2, 1], [d]: [3, 3, 1],
    });

    // Aimed at the block's far corner: the footprint that contains it and sits nearest home is the one
    // covering all four, so the whole block is what the rest reads.
    await carry(page, a, d, { aim: 'far', hold: 700 });

    // All four traded into the medium's hole keeping their own arrangement, and the tile beside the
    // block stayed where it was.
    expectBoard(await boardCells(page), {
      [f]: [0, 0, 1], [b]: [0, 1, 1], [c]: [1, 0, 1], [d]: [1, 1, 1], [e]: [2, 0, 1], [a]: [2, 2, 2],
    });
  });

  test('a spot that cannot take the tile says so, and a release there changes nothing', async ({ page }) => {
    const [a, b, c, d, e, f] = await smallBoard(page);
    await setTileSize(page, e, 'Medium');
    // The bystander that makes every candidate spot on the medium refuse: pushed up, the medium would
    // land on it; swapped, it would leave the board.
    await dragTileToCell(page, b, { row: 0, col: 1 });
    const before = await boardCells(page);
    expectBoard(before, {
      [a]: [0, 0, 1], [b]: [0, 1, 1], [c]: [0, 3, 1], [d]: [0, 4, 1], [e]: [1, 0, 2], [f]: [1, 2, 1],
    });

    let refused = 0;
    await carry(page, a, e, {
      aim: 'far',
      hold: 700,
      onHeld: async () => { refused = await page.locator('[data-drag-blocked]').count(); },
    });

    // It said so under the hand rather than waiting for the release to quietly do nothing.
    expect(refused, 'the blocked spot drew no refusal').toBe(1);
    expect(await boardCells(page)).toEqual(before);
  });

  test('Escape mid-gesture puts back every tile an armed push had moved', async ({ page }) => {
    const [a, , , d] = await smallBoard(page);
    const before = await boardCells(page);

    // Held well past the rest, so the push is armed and drawn — there is a whole row to put back, which
    // a cancel over open board would not have.
    await carry(page, a, d, { aim: 'far', hold: 700, cancel: true });

    expect(await boardCells(page)).toEqual(before);
  });
});

test.describe('the same rules under a finger', () => {
  test.skip(({ hasTouch }) => !hasTouch, 'needs a touch screen');

  test('a rest on the far side pushes the row, under touch', async ({ page }) => {
    const [a, b, c, d, e, f] = await smallBoard(page);
    // The phone board is one small wide per row until a tile is put beside one, which is what makes a
    // row to push at this width.
    await dragTileToCell(page, b, { row: 0, col: 1 });
    expectBoard(await boardCells(page), {
      [a]: [0, 0, 1], [b]: [0, 1, 1], [c]: [1, 0, 1], [d]: [2, 0, 1], [e]: [3, 0, 1], [f]: [4, 0, 1],
    });

    const start = await centerOf(page, a);
    const end = await centerOf(page, b);
    await touchDrag(page, start, end, { aim: 'far', reach: end.reach });

    expectBoard(await boardCells(page), {
      [a]: [0, 1, 1], [b]: [0, 0, 1], [c]: [1, 0, 1], [d]: [2, 0, 1], [e]: [3, 0, 1], [f]: [4, 0, 1],
    });
  });

  test('a rest on the near side rings the target and groups on release, under touch', async ({ page }) => {
    // The phone's own board, left at the size it seeds with: a small folder tile keeps only its mosaic,
    // so the folder this makes has to be big enough to carry its name.
    await openLibrary(page);
    const [a, b] = await tileOrder(page);
    const start = await centerOf(page, a);
    const end = await centerOf(page, b);
    let ringed = 0;

    await touchDrag(page, start, end, {
      aim: 'near',
      reach: end.reach,
      onHeld: async () => { ringed = await page.locator('[data-group-target]').count(); },
    });

    // The near half rings the tile it would fold into, then folds the two together on release rather
    // than trading their spots.
    expect(ringed, 'the near side drew no ring').toBe(1);
    await expect(page.getByRole('heading', { name: 'New Group' })).toHaveCount(1);
    await page.getByRole('heading', { name: 'New Group' }).click();
    expect(await tileOrder(page)).toEqual([b, a]);
  });
});
