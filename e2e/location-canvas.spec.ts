import { test, expect } from '@playwright/test';
import { openApp, gotoDev } from './app';

interface DevRouter {
  putWorld(world: unknown): Promise<string>;
  editWorld(id: string): Promise<void>;
}

/** A parent with two children, and one location standing outside it to be dragged in. */
const WORLD = {
  id: 'e2e-canvas-world',
  worldOverview: { name: 'E2E Canvas', description: '', author: '' },
  locations: [
    { id: 'loc-parent', name: 'Harbor' },
    { id: 'loc-child-a', name: 'Dock', parentId: 'loc-parent' },
    { id: 'loc-child-b', name: 'Warehouse', parentId: 'loc-parent' },
    { id: 'loc-outside', name: 'Beach' },
  ],
  stats: [],
  entities: [],
  traits: [],
  statUpdates: [],
};

/**
 * The canvas draws its Connection inspector as a floating panel over the map. Anything the layout wraps the
 * canvas in can swallow the panel's clicks without changing a single rendered attribute — only real
 * hit-testing sees it, so this lives here rather than in the Vitest suite.
 */
test.describe('Locations canvas', () => {
  test('the connection inspector answers clicks', async ({ page }) => {
    await openApp(page);
    await page.evaluate(async (world) => {
      const dev = (window as unknown as { __fmDev: DevRouter }).__fmDev;
      const id = await dev.putWorld(world);
      await dev.editWorld(id);
    }, WORLD);
    await gotoDev(page, 'mainMenu', { modal: 'worldEditor', tab: 'locations', subtab: 'canvas' });

    // A dashed arrow is implicit travel; clicking one authors the Connection and selects it.
    // Aimed with the mouse at the edge's own box: an SVG hairline takes no element click, and react-flow
    // reads the pointer, not a dispatched event.
    const edge = page.locator('.react-flow__edge').first();
    await edge.waitFor({ state: 'attached' });
    const box = await edge.boundingBox();
    if (!box) throw new Error('no edge box');
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

    // A plain click, so Playwright's own actionability check is the assertion: anything covering the panel
    // fails here rather than silently eating the edit.
    const oneWay = page.locator('[aria-label^="Travel one way,"]').first();
    await expect(oneWay).toBeVisible();
    await oneWay.click();
    await expect(oneWay).toHaveAttribute('data-state', 'on');
  });

  /**
   * The reparent rule is unit-tested against drop geometry; what only a real drag proves is the geometry the
   * canvas hands it — a child's resting place is reported against its parent's frame, and a location has to
   * be draggable clear of a box that never clamps it.
   */
  test('dragging a location into a group box nests it there', async ({ page }) => {
    await openApp(page);
    await page.evaluate(async (world) => {
      const dev = (window as unknown as { __fmDev: DevRouter }).__fmDev;
      const id = await dev.putWorld(world);
      await dev.editWorld(id);
    }, WORLD);
    await gotoDev(page, 'mainMenu', { modal: 'worldEditor', tab: 'locations', subtab: 'canvas' });

    const node = (id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);
    await node('loc-outside').waitFor();
    // Dock↔Warehouse is the world's only free travel while the Beach stands on its own.
    await expect(page.locator('.react-flow__edge')).toHaveCount(2);

    const beach = await node('loc-outside').boundingBox();
    const harbor = await node('loc-parent').boundingBox();
    if (!beach || !harbor) throw new Error('no node box');
    // Onto the Harbor's title strip, which is the group's own body rather than any child's box.
    await page.mouse.move(beach.x + beach.width / 2, beach.y + beach.height / 2);
    await page.mouse.down();
    await page.mouse.move(harbor.x + harbor.width / 2, harbor.y + 12, { steps: 12 });
    await page.mouse.up();

    // Three siblings under the Harbor now, so every pair of them travels freely: three pairs, six arrows.
    await expect(page.locator('.react-flow__edge')).toHaveCount(6);
    const nested = await node('loc-outside').boundingBox();
    const grown = await node('loc-parent').boundingBox();
    if (!nested || !grown) throw new Error('no node box');
    expect(nested.x).toBeGreaterThanOrEqual(grown.x);
    expect(nested.x + nested.width).toBeLessThanOrEqual(grown.x + grown.width);

    // And the list view is reading the same nesting: the Beach is now indented like the Dock beside it.
    await gotoDev(page, 'mainMenu', { modal: 'worldEditor', tab: 'locations', subtab: 'list' });
    const rowLeft = async (name: string) => (await page.getByText(name, { exact: true }).first().boundingBox())!.x;
    expect(await rowLeft('Beach')).toBeCloseTo(await rowLeft('Dock'), 0);
    expect(await rowLeft('Beach')).toBeGreaterThan(await rowLeft('Harbor'));
  });

  /**
   * Snapping is a property of the drag itself, so only a real drag shows whether a node came to rest on the
   * grid — and only the stored world proves the snapped place is the place that was kept.
   */
  test('a drag lands on the grid, and off it once snapping is turned off', async ({ page }) => {
    await openApp(page);
    await page.evaluate(async (world) => {
      const dev = (window as unknown as { __fmDev: DevRouter }).__fmDev;
      const id = await dev.putWorld(world);
      await dev.editWorld(id);
    }, WORLD);
    await gotoDev(page, 'mainMenu', { modal: 'worldEditor', tab: 'locations', subtab: 'canvas' });

    const beach = page.locator('.react-flow__node[data-id="loc-outside"]');
    await beach.waitFor();

    // Odd offsets, so a resting place on the grid can only be the snap's doing, and leftward so the node
    // stays well inside the pane — a grab point outside it is no drag at all.
    const dragBy = async (dx: number, dy: number) => {
      const box = (await beach.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 8 });
      await page.mouse.up();
    };
    const restingPlace = async () => {
      const style = await beach.getAttribute('style');
      const [x, y] = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(style ?? '')!.slice(1).map(Number);
      return { x, y };
    };

    await dragBy(-103, 67);
    const snapped = await restingPlace();
    expect(snapped.x % 20).toBe(0);
    expect(snapped.y % 20).toBe(0);

    // The canvas's own menu — the browser's never appears — carries the toggle.
    await page.locator('.react-flow__pane').click({ button: 'right', position: { x: 30, y: 30 } });
    await page.getByRole('menuitemcheckbox', { name: 'Snap To Grid' }).click();

    await dragBy(-103, 67);
    const free = await restingPlace();
    expect(free.x % 20 !== 0 || free.y % 20 !== 0).toBe(true);
  });
});
