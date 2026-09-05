import { test, expect, type Page } from '@playwright/test';
import { dragBetween, dragTile, openLibrary, tileOrder, tiles } from './tileDrag';

/**
 * Folders in the library, and what a drag may not do to them.
 *
 * Grouping is a menu feature: Create New Group, Add To Group, Remove From Group, Open Group and Delete
 * Group are the only ways a folder ever changes. A drag moves a tile, and that is all it does — the
 * guards below are the half of that promise a browser can see, since the rest (a drop never folds, a
 * park never arms) is measured in [library-drag-parity.spec.ts](e2e/library-drag-parity.spec.ts).
 *
 * The bundled worlds supply the tiles and their names are read off the board, so renaming a shipped
 * world cannot fail this spec for the wrong reason.
 */

/** Every tile on the board in grid order: a world by its name, a folder by its own. */
function boardOrder(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const grid = document.querySelector('[data-radix-scroll-area-viewport] div.grid');
    if (!grid) return [];
    return [...grid.children].map((cell) => {
      const img = cell.querySelector('img[alt]:not([alt=""])') as HTMLImageElement | null;
      return img ? img.alt : cell.querySelector('h3')?.textContent?.trim() ?? '?';
    });
  });
}

/** The center of one board cell, so a folder tile can be dragged like any other. */
function cellCenter(page: Page, index: number): Promise<{ x: number; y: number }> {
  return page.evaluate((i) => {
    const grid = document.querySelector('[data-radix-scroll-area-viewport] div.grid')!;
    const box = (grid.children[i] as HTMLElement).getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  }, index);
}

/** Open one tile's context menu and pick an entry from it. */
async function pickFromTileMenu(page: Page, tileIndex: number, item: string): Promise<void> {
  await tiles(page).nth(tileIndex).click({ button: 'right' });
  await page.getByRole('menuitem', { name: item, exact: true }).click();
  await expect(page.getByRole('menu')).toHaveCount(0);
}

/** Fold the named tile into a fresh folder through the menu — the only way one is ever made. */
async function newGroupFrom(page: Page, tileIndex: number): Promise<void> {
  await pickFromTileMenu(page, tileIndex, 'Create New Group');
  await expect(page.getByRole('heading', { name: 'New Group' })).toBeVisible();
}

test.describe('folders are made from the menu', () => {
  test('creates a folder, opens it, and comes back', async ({ page }) => {
    await openLibrary(page);
    const names = await tileOrder(page);

    await newGroupFrom(page, 0);

    // The folder stands where the tile stood, and the tile itself has left the main grid.
    expect((await boardOrder(page))[0]).toBe('New Group');
    expect(await tileOrder(page)).toEqual(names.slice(1));

    await page.getByRole('heading', { name: 'New Group' }).click();

    // The folder view is a room, not a popup: a way back, the name editable in place, and the members.
    await expect(page.getByRole('textbox', { name: 'Group name' })).toHaveValue('New Group');
    await expect(page.getByRole('img', { name: names[0] })).toBeVisible();

    await page.getByRole('button', { name: 'Library' }).click();

    await expect(page.getByRole('textbox', { name: 'Group name' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'New Group' })).toBeVisible();
  });

  test('adds a second tile to an existing folder, and takes it out again', async ({ page }) => {
    await openLibrary(page);
    const names = await tileOrder(page);

    await newGroupFrom(page, 0);
    // Exact, because "Create New Group" would also match a loose "New Group".
    await pickFromTileMenu(page, 0, 'New Group');

    expect(await tileOrder(page)).toEqual(names.slice(2));
    await page.getByRole('heading', { name: 'New Group' }).click();
    await expect(page.getByRole('img', { name: names[0] })).toBeVisible();
    await expect(page.getByRole('img', { name: names[1] })).toBeVisible();

    // Remove From Group is what replaced the folder header's drop zone, so it carries that weight now.
    await pickFromTileMenu(page, 1, 'Remove From Group');
    await expect(page.getByRole('img', { name: names[1] })).toHaveCount(0);

    await page.getByRole('button', { name: 'Library' }).click();
    expect(await tileOrder(page)).toEqual(names.slice(1));
  });

  test('arranges the members inside an open folder, and keeps that order', async ({ page }) => {
    await openLibrary(page);
    const names = await tileOrder(page);

    await newGroupFrom(page, 0);
    await pickFromTileMenu(page, 0, 'New Group');
    await pickFromTileMenu(page, 0, 'New Group');
    await page.getByRole('heading', { name: 'New Group' }).click();
    expect(await tileOrder(page)).toEqual(names.slice(0, 3));

    await dragTile(page, 2, 0);
    const arranged = [names[2], names[0], names[1]];
    expect(await tileOrder(page)).toEqual(arranged);

    // Leaving the room and coming back is the cheapest proof the order was committed, not just drawn.
    await page.getByRole('button', { name: 'Library' }).click();
    await page.getByRole('heading', { name: 'New Group' }).click();
    expect(await tileOrder(page)).toEqual(arranged);
  });
});

test.describe('a folder that can make way is moved, not filled', () => {
  test('parks a tile on a folder and still only reorders around it', async ({ page }) => {
    await openLibrary(page);
    const names = await tileOrder(page);
    await newGroupFrom(page, 0);
    const loose = await tileOrder(page);

    // Dead center on the folder, held far past the group dwell. On this uniform board the folder can
    // dodge, and moving always beats grouping — so nothing is left standing to arm a group drop.
    await dragBetween(page, await cellCenter(page, 1), await cellCenter(page, 0), { hold: 1400 });

    // The folder took the drop as a neighbor would: it moved along, and its one member stayed its own.
    expect(await boardOrder(page)).toEqual([loose[0], 'New Group', ...loose.slice(1)]);
    expect(await tileOrder(page)).toEqual(loose);
    await page.getByRole('heading', { name: 'New Group' }).click();
    expect(await tileOrder(page)).toEqual([names[0]]);
  });

  test('drags a folder tile itself, which reorders like any other tile', async ({ page }) => {
    await openLibrary(page);
    await newGroupFrom(page, 0);
    const before = await boardOrder(page);

    await dragBetween(page, await cellCenter(page, 0), await cellCenter(page, 2));

    expect(await boardOrder(page)).toEqual([before[1], before[2], 'New Group', ...before.slice(3)]);
  });
});

test.describe('tile sizes', () => {
  test('reorders mixed sizes by the same rules', async ({ page }) => {
    await openLibrary(page);
    const names = await tileOrder(page);

    // Small rather than Large: the phone grid is two base cells wide, so a large tile is clamped to the
    // full width and is indistinguishable from a medium one there. A small tile is half of one at both
    // sizes, which is what makes this a mixed board on every viewport.
    const medium = (await tiles(page).first().boundingBox())!.width;
    await tiles(page).first().click({ button: 'right' });
    await page.getByRole('menuitemradio', { name: 'Small' }).click();
    await expect(page.getByRole('menu')).toHaveCount(0);
    // The whole board repacks around the resized tile, so every position below is stale until it has.
    await expect
      .poll(async () => (await tiles(page).first().boundingBox())!.width)
      .toBeLessThan(medium);

    await dragTile(page, 2, 0, { aim: 'far' });

    // Sizing and ordering are independent features: a large tile takes the slot a medium one would.
    expect(await tileOrder(page)).toEqual([names[2], names[0], names[1], ...names.slice(3)]);
  });

  test('offers no sizes in the detailed layout, which draws uniform cards', async ({ page }) => {
    await openLibrary(page, 'detailed');

    await tiles(page).first().click({ button: 'right' });

    await expect(page.getByRole('menuitem', { name: 'Create New Group' })).toBeVisible();
    await expect(page.getByText('Tile Size')).toHaveCount(0);
  });
});
