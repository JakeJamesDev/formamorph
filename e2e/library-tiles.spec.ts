import { test, expect, type Locator, type Page } from '@playwright/test';
import { openApp } from './app';

/**
 * Grouping library tiles by dragging one onto another.
 *
 * This is the one flow in the tile system that jsdom structurally cannot reach. The organization module
 * behind it is pure and unit-tested to the letter; what a browser adds is the gesture — dnd-kit's
 * activation distance, the real tile boxes the drop position is read against, and the middle-of-the-tile
 * region that separates "group these two" from "put this one beside that one". A mouse is the only way
 * to produce any of it.
 *
 * The bundled worlds supply the tiles, and their names are read off the grid rather than written here,
 * so renaming a shipped world cannot fail this spec for the wrong reason.
 */

/** Every tile's thumbnail carries the item's name as its alt text, in grid order. */
function thumbnails(page: Page): Locator {
  return page.locator('img[alt]:not([alt=""])');
}

/** Drag one tile onto the middle of another, which is the region that groups them. */
async function dragOntoCenter(page: Page, from: Locator, to: Locator): Promise<void> {
  const start = await from.boundingBox();
  const end = await to.boundingBox();
  if (!start || !end) throw new Error('a tile has no box to drag between');

  const startX = start.x + start.width / 2;
  const startY = start.y + start.height / 2;
  const endX = end.x + end.width / 2;
  const endY = end.y + end.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // Past dnd-kit's activation distance first, then across in steps: a single jump gives the drag no
  // intermediate move to resolve which tile it is over.
  await page.mouse.move(startX + 12, startY, { steps: 2 });
  await page.mouse.move(endX, endY, { steps: 12 });
  await page.mouse.move(endX, endY);
  await page.mouse.up();
}

/** The Main Menu in grid layout, with the bundled worlds read back and drawn. */
async function openLibrary(page: Page): Promise<void> {
  await openApp(page, { FORMAMORPH_layoutMode: 'grid' });
  // The bundled worlds are seeded into IndexedDB after the menu mounts; a drag before that re-render
  // would be measured against tiles that are about to move.
  await expect(page.getByRole('button', { name: 'Delete world' }).first()).toBeVisible();
  await expect(thumbnails(page).nth(1)).toBeVisible();
}

/** Drag one tile to another tile's left edge, the region that reorders instead of grouping. */
async function dragToLeftEdge(page: Page, from: Locator, to: Locator): Promise<void> {
  const start = await from.boundingBox();
  const end = await to.boundingBox();
  if (!start || !end) throw new Error('a tile has no box to drag between');

  const startX = start.x + start.width / 2;
  const startY = start.y + start.height / 2;
  const endX = end.x + 8;
  const endY = end.y + end.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 12, startY, { steps: 2 });
  await page.mouse.move(endX, endY, { steps: 12 });
  await page.mouse.move(endX, endY);
  await page.mouse.up();
}

test.describe('reordering library tiles', () => {
  test('drops a tile on another\'s edge to reorder, on a library never arranged before', async ({ page }) => {
    // The regression this guards: a fresh library stores no order at all, so a reorder that only
    // edited the stored list was a silent no-op — and an edge drop that read as "group" instead
    // made a folder the player never asked for.
    await openLibrary(page);

    // Adjacent tiles, not the grid's far corners: on the phone profile the grid is one column and
    // the far tiles sit below the fold, where the mouse cannot reach without scrolling.
    const names = await thumbnails(page).evaluateAll((imgs) =>
      imgs.map((img) => (img as HTMLImageElement).alt));
    const second = thumbnails(page).nth(1);
    const first = thumbnails(page).nth(0);

    await dragToLeftEdge(page, second, first);

    await expect(thumbnails(page).first()).toHaveAttribute('alt', names[1]);
    await expect(page.getByRole('heading', { name: 'New Group' })).toHaveCount(0);

    // The new order is what the library reopens with.
    await page.reload();
    await expect(page.getByRole('button', { name: 'Delete world' }).first()).toBeVisible();
    await expect(thumbnails(page).first()).toHaveAttribute('alt', names[1]);
  });
});

test.describe('grouping library tiles', () => {
  test('drops one tile on another to make a folder, opens it, and comes back', async ({ page }) => {
    await openLibrary(page);

    const first = thumbnails(page).nth(0);
    const second = thumbnails(page).nth(1);
    const firstName = (await first.getAttribute('alt'))!;
    const secondName = (await second.getAttribute('alt'))!;

    await dragOntoCenter(page, first, second);

    // The folder stands where the tile dropped on stood, and both members leave the main grid.
    const folder = page.getByRole('heading', { name: 'New Group' });
    await expect(folder).toBeVisible();
    await expect(page.getByRole('heading', { name: firstName })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: secondName })).toHaveCount(0);

    await folder.click();

    // The folder view is a room, not a popup: a back button, the name to edit in place, and the members.
    await expect(page.getByRole('textbox', { name: 'Group name' })).toHaveValue('New Group');
    await expect(page.getByRole('img', { name: firstName })).toBeVisible();
    await expect(page.getByRole('img', { name: secondName })).toBeVisible();

    await page.getByRole('button', { name: 'Library' }).click();

    await expect(page.getByRole('textbox', { name: 'Group name' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'New Group' })).toBeVisible();
  });
});
