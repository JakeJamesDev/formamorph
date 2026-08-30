import { test, expect, type Page } from '@playwright/test';
import {
  boardCells,
  cellsOverlap,
  dragTileToCell,
  maxTransformSeen,
  openLibrary,
  setTileSize,
  startTileSampler,
  startTransformSampler,
  tileOrder,
  tileSamples,
  type TileCell,
} from './tileDrag';

/**
 * The mixed-size tile drag, measured on the real board.
 *
 * Everything here is stated as where tiles end up: the cells the browser resolved for them, before and
 * after a gesture. Nothing reads the simulation's own bookkeeping — that is covered by its unit tests,
 * and a spec that read it could pass while the board on screen did something else entirely.
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

/** Base-cell columns the board is wide at this viewport: three medium tiles on desktop, one on a phone. */
const columnsFor = (page: Page) => (page.viewportSize()!.width >= 1024 ? 6 : 2);

test.describe('mixed-size tile drag', () => {
  test.skip(({ page }) => columnsFor(page) < 6, 'a phone board is two cells wide; see the width test');

  test('a large tile holds its ground when a drag only clips its corner', async ({ page }) => {
    await openLibrary(page);
    const names = await tileOrder(page);
    await setTileSize(page, names[0], 'Large');
    await setTileSize(page, names[1], 'Small');
    const before = await boardCells(page);

    // One cell into the big tile: far too little of it swept for the whole group to shift.
    await dragTileToCell(page, names[1], before[names[0]], { hold: 500 });

    expect(await boardCells(page)).toMatchObject({ [names[0]]: before[names[0]] });
    expectSoundBoard(await boardCells(page), columnsFor(page));
  });

  test('a group moves once the gesture has swept half of it, and keeps its shape', async ({ page }) => {
    await openLibrary(page);
    const names = await tileOrder(page);
    await setTileSize(page, names[0], 'Small');
    const before = await boardCells(page);
    const target = before[names[1]];

    // Two of the medium tile's four cells, swept a column at a time along its top row.
    await dragTileToCell(page, names[0], { row: target.row, col: target.col + 1 });

    const after = await boardCells(page);
    // It moved the way its cells were pushed — one column back, behind the drag — and it is still a
    // 2x2 tile rather than something scattered across the cells its parts were shoved into.
    expect(after[names[1]]).toEqual({ row: target.row, col: target.col - 1, span: 2 });
    expect(after[names[0]]).toEqual({ row: target.row, col: target.col + 1, span: 1 });
    expectSoundBoard(after, columnsFor(page));
  });

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
    await page.getByRole('button', { name: 'Delete world' }).first().waitFor();

    // And the board is stored as cells, not as an order that would repack itself on the way back in.
    expect(await boardCells(page)).toEqual(after);
  });

  test('a row nothing touches folds away, and stays folded after a reload', async ({ page }) => {
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
    await page.getByRole('button', { name: 'Delete world' }).first().waitFor();
    expect(await boardCells(page)).toEqual(folded);
  });

  test('Escape mid-gesture puts every tile back', async ({ page }) => {
    await openLibrary(page);
    const names = await tileOrder(page);
    await setTileSize(page, names[0], 'Small');
    const before = await boardCells(page);

    // A gesture long enough to have really displaced things before it is abandoned.
    await dragTileToCell(page, names[0], { row: 0, col: 4 }, { cancel: true });

    expect(await boardCells(page)).toEqual(before);
  });

  test('a blocked release keeps the moves that really happened', async ({ page }) => {
    await openLibrary(page);
    const names = await tileOrder(page);
    await setTileSize(page, names[0], 'Small');
    await setTileSize(page, names[3], 'Large');
    const before = await boardCells(page);
    const wall = before[names[3]];

    // One gesture, two halves: across a medium tile, which earns its dodge, and then down into the
    // large one, which refuses. The descent aims at the wall's interior so it cannot re-sweep the
    // dodged tile at its new home and walk the dodge back.
    await dragTileToCell(page, names[0], { row: wall.row, col: wall.col + 2 }, {
      through: [{ row: before[names[1]].row, col: before[names[1]].col + 1 }],
      hold: 400,
    });

    const after = await boardCells(page);
    expect(after[names[3]], 'the tile in the way was disturbed').toEqual(wall);
    expect(after[names[1]], 'an earned dodge was thrown away').not.toEqual(before[names[1]]);
    expectSoundBoard(after, columnsFor(page));
  });

  test('a displaced tile slides from where it stood, never from beyond it', async ({ page }) => {
    await openLibrary(page);
    const names = await tileOrder(page);
    const before = await boardCells(page);
    // A swap two rows down: the sim's answer differs from a flat reorder's, which is exactly the move
    // dnd-kit's own layout animation would double up — the tile would first paint past its start, on
    // the far side from where it is going, and rush in from there.
    const watched = names[3];
    await startTileSampler(page, [watched]);

    await dragTileToCell(page, names[0], before[watched], { steps: 20, interval: 20 });

    const path = (await tileSamples(page))
      .map((sample) => sample.at[watched])
      .filter((at): at is { x: number; y: number } => at !== null);
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

  test('a large tile carried through a field of smalls stacks them behind it', async ({ page }) => {
    await openLibrary(page);
    const names = await tileOrder(page);
    for (const name of names.slice(1)) await setTileSize(page, name, 'Small');
    await setTileSize(page, names[0], 'Large');
    const before = await boardCells(page);

    // The tiles standing in the two columns the drag is about to sweep through; the growth pushed
    // the rest below the large tile's rows, out of this gesture's reach.
    const swept = names.slice(1).filter(
      (name) => before[name].col >= 2 && before[name].row < before[names[0]].span,
    );
    expect(swept.length, 'the field the drag needs is not standing in its path').toBeGreaterThan(2);

    // Two columns to the right, straight through that field.
    await dragTileToCell(page, names[0], { row: 0, col: 2 }, { steps: 20, interval: 20 });

    const after = await boardCells(page);
    expect(Object.keys(after).sort(), 'a tile fell off the board').toEqual(Object.keys(before).sort());
    expect(after[names[0]].span, 'the carried tile lost its shape').toBe(4);
    expectSoundBoard(after, columnsFor(page));
    // Each small it swept ended up behind the drag — to its left — rather than standing its ground.
    for (const name of swept) {
      expect(after[name].col, `${name} did not give way`).toBeLessThan(before[name].col);
      expect(after[name].col, `${name} is not behind the drag`).toBeLessThan(after[names[0]].col);
    }
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

    await dragTileToCell(page, names[0], { row: 8, col: 0 });
    const phone = await boardCells(page);
    expect(phone[names[0]].row, 'the phone drag did nothing').toBeGreaterThan(0);

    await page.setViewportSize({ width: 1280, height: 860 });
    await page.waitForTimeout(300);

    expect(await boardCells(page)).toEqual(desktop);
  });
});
