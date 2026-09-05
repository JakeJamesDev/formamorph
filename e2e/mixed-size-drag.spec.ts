import { test, expect, type Page } from '@playwright/test';
import {
  boardCells,
  cellCenter,
  cellsOverlap,
  dragBetween,
  dragTile,
  dragTileToCell,
  gridPitch,
  maxTransformSeen,
  openLibrary,
  setTileSize,
  startTileSampler,
  startTransformSampler,
  tileOrder,
  tileSamples,
  tiles,
  type TileCell,
} from './tileDrag';

/**
 * The mixed-size tile drag, measured on the real board.
 *
 * Everything here is stated as where tiles end up: the cells the browser resolved for them, before and
 * after a gesture. Nothing reads the gesture reader's own bookkeeping — that is covered by its unit
 * tests, and a spec that read it could pass while the board on screen did something else entirely.
 *
 * The uniform-size half of the promise lives in
 * [library-drag-parity.spec.ts](e2e/library-drag-parity.spec.ts), which stays green as the floor.
 *
 * @see e2e/tileDrag.ts for the gesture, cell and sizing helpers.
 */

/** No two tiles share a cell, and none has slipped off the side of the board. */
function expectSoundBoard(cells: Record<string, TileCell>, columns: number) {
  const all = Object.entries(cells);
  for (const [name, cell] of all) {
    expect(cell.row, `${name} sits above the board`).toBeGreaterThanOrEqual(0);
    expect(cell.col + cell.span, `${name} runs off the board`).toBeLessThanOrEqual(columns);
  }
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      expect(cellsOverlap(all[i][1], all[j][1]), `${all[i][0]} and ${all[j][0]} share a cell`)
        .toBe(false);
    }
  }
}

/** Base-cell columns at this viewport, mirroring the app's fit rule: as many 296px medium tiles as
 *  the window minus its padding holds, two base cells each, never fewer than two. */
const columnsFor = (page: Page) =>
  Math.max(1, Math.floor((page.viewportSize()!.width - 32 + 16) / (296 + 16))) * 2;

test.describe('mixed-size tile drag', () => {
  test.skip(({ page }) => columnsFor(page) < 6, 'a phone board is two cells wide; see the width test');

  test('a drag into open space moves nothing else', async ({ page }) => {
    await openLibrary(page);
    const names = await tileOrder(page);
    const before = await boardCells(page);
    const carried = names[names.length - 1];

    // Straight down from the bottom-right tile into empty rows: there is nothing on the way to push.
    await dragTileToCell(page, carried, { row: before[carried].row + 2, col: before[carried].col });

    const after = await boardCells(page);
    expect(after[carried], 'the tile never went anywhere').not.toEqual(before[carried]);
    for (const name of names.slice(0, -1)) expect(after[name], `${name} moved`).toEqual(before[name]);
    expectSoundBoard(after, columnsFor(page));
  });

  test('the hole a tile leaves behind stays open, and survives a reload', async ({ page }) => {
    await openLibrary(page);
    const names = await tileOrder(page);
    const before = await boardCells(page);
    const carried = names[names.length - 1];
    const vacated = before[carried];

    await dragTileToCell(page, carried, { row: vacated.row + 2, col: vacated.col });

    // Nothing rushed in to close the gap: the arrangement is the player's, not the packer's.
    const after = await boardCells(page);
    for (const [name, cell] of Object.entries(after)) {
      if (name !== carried) expect(cellsOverlap(cell, vacated), `${name} filled the hole`).toBe(false);
    }

    await page.reload();
    // No seed toast after a reload — the worlds already exist — so the tiles are the settled signal.
    await tiles(page).nth(2).waitFor();

    // And the board is stored as cells, not as an order that would repack itself on the way back in.
    expect(await boardCells(page)).toEqual(after);
  });

  test('a row nothing touches folds away, and stays folded after a reload', async ({ page }) => {
    // Pinned to a three-medium board: the expected cells below assume that row-major seeding.
    await page.setViewportSize({ width: 1100, height: 860 });
    await openLibrary(page);
    const names = await tileOrder(page);
    const before = await boardCells(page);
    const carried = names[names.length - 1];

    // Park the bottom-right tile two rows lower; the commit stores this width's arrangement.
    await dragTileToCell(page, carried, { row: before[carried].row + 2, col: before[carried].col });

    // Shrinking the two tiles beside its old home leaves their second row crossed by nothing. A dead
    // row folds, so the parked tile pulls up one; the shrunken tiles hold their anchors.
    await setTileSize(page, names[3], 'Small');
    await setTileSize(page, names[4], 'Small');

    const folded = await boardCells(page);
    expect(folded[names[3]]).toEqual({ row: 2, col: 0, span: 1 });
    expect(folded[names[4]]).toEqual({ row: 2, col: 2, span: 1 });
    expect(folded[carried]).toEqual({ row: 3, col: before[carried].col, span: 2 });

    await page.reload();
    await tiles(page).nth(2).waitFor();
    expect(await boardCells(page)).toEqual(folded);
  });

  test('a resized tile grows through in-between sizes while its neighbor slides clear', async ({ page }) => {
    await openLibrary(page);
    const names = await tileOrder(page);
    await startTileSampler(page, [names[0], names[1]]);

    await setTileSize(page, names[0], 'Large');
    await page.waitForTimeout(400);

    const samples = await tileSamples(page);
    const of = (name: string) => samples.map((s) => s.at[name]).filter((at) => at !== null);

    // The grown tile passes through sizes between the two, rather than snapping to the new one.
    const widths = of(names[0]).map((at) => Math.round(at.w));
    const [wMin, wMax] = [Math.min(...widths), Math.max(...widths)];
    expect(wMax, 'the tile never grew').toBeGreaterThan(wMin + 100);
    const grew = new Set(widths.filter((w) => w > wMin + 4 && w < wMax - 4));
    expect(grew.size, 'the growth snapped instead of animating').toBeGreaterThanOrEqual(3);

    // And the neighbor it landed on slid through in-between positions on its way clear.
    const ys = of(names[1]).map((at) => Math.round(at.y));
    const [yMin, yMax] = [Math.min(...ys), Math.max(...ys)];
    expect(yMax, 'the neighbor never made way').toBeGreaterThan(yMin + 100);
    const slid = new Set(ys.filter((y) => y > yMin + 4 && y < yMax - 4));
    expect(slid.size, 'the neighbor snapped instead of sliding').toBeGreaterThanOrEqual(3);
  });

  test('Escape mid-gesture puts every tile back', async ({ page }) => {
    await openLibrary(page);
    const names = await tileOrder(page);
    await setTileSize(page, names[0], 'Small');
    const before = await boardCells(page);

    // Held long enough for the rest to have armed a move, so there is something to put back.
    await dragTileToCell(page, names[0], { row: 0, col: 4 }, { cancel: true, hold: 600 });

    expect(await boardCells(page)).toEqual(before);
  });

  test('a displaced tile slides from where it stood, never from beyond it', async ({ page }) => {
    await openLibrary(page);
    const names = await tileOrder(page);
    // A push down the row: the reader's answer differs from a flat reorder's, which is exactly the move
    // dnd-kit's own layout animation would double up — the tile would first paint past its start, on
    // the far side from where it is going, and rush in from there.
    const watched = names[3];
    await startTileSampler(page, [watched]);

    // Held past the rest, so the whole slide is sampled during the drag rather than across the release.
    await dragTile(page, 0, 3, { steps: 20, interval: 20, hold: 700, aim: 'far' });

    const path = (await tileSamples(page))
      .map((sample) => sample.at[watched])
      .filter((at) => at !== null);
    const rest = path[0];
    const landed = path[path.length - 1];
    expect(rest.x !== landed.x || rest.y !== landed.y, 'the tile never moved').toBe(true);
    // Every painted frame stays between the two rest points. A slide that starts anywhere else — past
    // the start, past the landing spot, off the travel axis — is a second animation stacked on ours.
    for (const at of path) {
      expect(at.x, 'painted beyond the travel in x').toBeGreaterThanOrEqual(Math.min(rest.x, landed.x) - 4);
      expect(at.x, 'painted beyond the travel in x').toBeLessThanOrEqual(Math.max(rest.x, landed.x) + 4);
      expect(at.y, 'painted beyond the travel in y').toBeGreaterThanOrEqual(Math.min(rest.y, landed.y) - 4);
      expect(at.y, 'painted beyond the travel in y').toBeLessThanOrEqual(Math.max(rest.y, landed.y) + 4);
    }
  });

  test('a rest on a folder tile\'s near side adds the carried tile to it', async ({ page }) => {
    await openLibrary(page);
    const names = await tileOrder(page);

    // A folder from the menu, grown large so its near half is a wide, unambiguous target.
    await page.getByRole('img', { name: names[0], exact: true }).first().click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Create New Group' }).click();
    await page.getByRole('heading', { name: 'New Group' }).click({ button: 'right' });
    await page.getByRole('menuitemradio', { name: 'Large' }).click();
    await page.waitForTimeout(150);
    await setTileSize(page, names[1], 'Small');

    const folder = (await boardCells(page))['New Group'];
    const pitch = await gridPitch(page);
    const box = (await page.getByRole('img', { name: names[1], exact: true }).first().boundingBox())!;
    const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

    await dragBetween(page, from, cellCenter(pitch, folder), { aim: 'near', hold: 600 });

    // No second folder: the carried tile joined the one it rested short of.
    await expect(page.getByRole('heading', { name: 'New Group' })).toHaveCount(1);
    expect((await boardCells(page))[names[1]]).toBeUndefined();
    await page.getByRole('heading', { name: 'New Group' }).click();
    expect(await tileOrder(page)).toEqual([names[0], names[1]]);
  });

  test('a drag below the board stops one band under it, and the board stops growing', async ({ page }) => {
    // Tall enough that three rows below the last tile are still on screen, so nothing auto-scrolls.
    await page.setViewportSize({ width: 1100, height: 1200 });
    await openLibrary(page);
    const names = await tileOrder(page);
    const before = await boardCells(page);
    const carried = names[names.length - 1];
    const boardRows = Math.max(...Object.values(before).map((cell) => cell.row + cell.span));
    const span = before[carried].span;

    let rowsWhileHeld = 0;
    await dragTileToCell(page, carried, { row: boardRows + 3, col: before[carried].col }, {
      onHeld: async () => {
        rowsWhileHeld = await page.evaluate(() => {
          const grid = document.querySelector('[data-radix-scroll-area-viewport] div.grid') as HTMLElement;
          return getComputedStyle(grid).gridTemplateRows.split(' ').length;
        });
      },
    });

    // The claim reaches the band right below the board and no further, however low the hand goes.
    expect(rowsWhileHeld).toBe(boardRows + span);
    expect((await boardCells(page))[carried].row).toBe(boardRows);
  });

  test('an open-space drop lands where the ghost corner is, not where the pointer is', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 1200 });
    await openLibrary(page);
    const names = await tileOrder(page);
    const before = await boardCells(page);
    const carried = names[names.length - 1];
    const home = before[carried];

    // Grabbed just inside its corner and carried 1.6 rows down: the ghost's corner is nearest the
    // second row, while the pointer itself has only crossed into the first.
    const pitch = await gridPitch(page);
    const start = {
      x: pitch.left + home.col * pitch.x + pitch.x * 0.15,
      y: pitch.top + home.row * pitch.y + pitch.y * 0.15,
    };
    await dragBetween(page, start, { x: start.x, y: start.y + pitch.y * 1.6 });

    expect((await boardCells(page))[carried]).toEqual({ ...home, row: home.row + 2 });
  });

  test('a tile let go over open space stands in its cell at once, with no slide', async ({ page }) => {
    await openLibrary(page);
    const names = await tileOrder(page);
    const before = await boardCells(page);
    const carried = names[names.length - 1];

    // Sampled from before the press through the release: over open space nothing is displaced, so any
    // push by a transform is the released tile itself sliding home-to-cell across the commit.
    await startTransformSampler(page);
    await dragTileToCell(page, carried, { row: before[carried].row + 2, col: before[carried].col }, { hold: 0 });
    await page.waitForTimeout(300);

    expect((await boardCells(page))[carried].row).toBe(before[carried].row + 2);
    expect(await maxTransformSeen(page)).toBe(0);
  });
});

test.describe('the board fills the width it has', () => {
  test.skip(({ page }) => columnsFor(page) < 6, 'the phone board is covered by the width test');

  test('the board fits as many columns as the window allows', async ({ page }) => {
    await openLibrary(page);
    const columns = () => page.evaluate(() => {
      const grid = document.querySelector('[data-radix-scroll-area-viewport] div.grid') as HTMLElement;
      return getComputedStyle(grid).gridTemplateColumns.split(' ').length;
    });

    // 1280 window: four mediums fit, so eight base cells — a column the old ladder never granted.
    expect(await columns()).toBe(8);

    await page.setViewportSize({ width: 1720, height: 860 });
    await page.waitForTimeout(300);
    expect(await columns(), 'a wider window earned no columns').toBe(10);

    await page.setViewportSize({ width: 1100, height: 860 });
    await page.waitForTimeout(300);
    expect(await columns()).toBe(6);
  });
});

test.describe('each width keeps its own arrangement', () => {
  test.skip(({ page }) => columnsFor(page) < 6, 'the test drives both widths from the wide one');

  test('arranging on a phone leaves the desktop board alone', async ({ page }) => {
    await openLibrary(page);
    const names = await tileOrder(page);
    await dragTileToCell(page, names[2], { row: 4, col: 0 });
    const desktop = await boardCells(page);

    // A cell is a different distance on a board of a different width, so the board must simply redraw
    // at the new one. Any tile pushed by a transform here is a slide measured against the old grid.
    await startTransformSampler(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(300);
    expect(await maxTransformSeen(page), 'tiles slid when the board changed width').toBe(0);

    // The narrow board is seeded from the wide one's reading, so it opens in the order just arranged.
    expect(await tileOrder(page)).toEqual(
      Object.entries(desktop)
        .sort(([, a], [, b]) => a.row - b.row || a.col - b.col)
        .map(([name]) => name),
    );

    // A push down the phone's single column, rather than a cell aim: the narrow board has no open row
    // within reach of the viewport, so the gesture has to land on a tile.
    await dragTile(page, 0, 2, { aim: 'far' });
    const phone = await boardCells(page);
    expect(phone[names[0]].row, 'the phone drag did nothing').toBeGreaterThan(0);

    await page.setViewportSize({ width: 1280, height: 860 });
    await page.waitForTimeout(300);

    expect(await boardCells(page)).toEqual(desktop);
  });
});
