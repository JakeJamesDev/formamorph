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

/** The same shape, with one child holding a location of its own: a box nested inside a box. */
const NESTED_WORLD = {
  ...WORLD,
  id: 'e2e-canvas-nested',
  locations: [...WORLD.locations, { id: 'loc-grandchild', name: 'Locker', parentId: 'loc-child-a' }],
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
   * The highlight only exists while a drag is in the air, so no rendered state after the drop can prove it
   * was ever there. Held mid-drag, with the button still down, it is a static frame like any other.
   */
  test('the box that will take the drop lights up before the drop lands', async ({ page }) => {
    await openApp(page);
    await page.evaluate(async (world) => {
      const dev = (window as unknown as { __fmDev: DevRouter }).__fmDev;
      const id = await dev.putWorld(world);
      await dev.editWorld(id);
    }, WORLD);
    await gotoDev(page, 'mainMenu', { modal: 'worldEditor', tab: 'locations', subtab: 'canvas' });

    const node = (id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);
    const harborBox = node('loc-parent').locator('[data-drop-target]');
    const topLevel = page.getByTestId('canvas-top-level-drop');
    await node('loc-outside').waitFor();
    await expect(harborBox).toHaveCount(0); // nothing is lit while nothing is being dragged
    await expect(topLevel).toHaveCount(0);

    const beach = (await node('loc-outside').boundingBox())!;
    const harbor = (await node('loc-parent').boundingBox())!;
    await page.mouse.move(beach.x + beach.width / 2, beach.y + beach.height / 2);
    await page.mouse.down();

    // Out on open canvas first. The Beach already stands on its own, so this changes nothing about what holds
    // it — nothing is named, because there is nothing to say.
    await page.mouse.move(beach.x + beach.width / 2, beach.y + beach.height + 80, { steps: 6 });
    await expect(topLevel).toHaveCount(0);
    await expect(harborBox).toHaveCount(0);

    // Over the middle of the Harbor, still mid-drag: the box it would join is named. Well inside the box
    // rather than on its rim, where snapping can carry the node's center back out.
    await page.mouse.move(harbor.x + harbor.width / 2, harbor.y + harbor.height / 2, { steps: 12 });
    await expect(harborBox).toHaveCount(1);
    await expect(topLevel).toHaveCount(0);

    // And what lit up is what took it — the Beach lands inside the box that was highlighted.
    await page.mouse.up();
    await expect(page.locator('.react-flow__edge')).toHaveCount(6);
    await expect(harborBox).toHaveCount(0);
    const nested = (await node('loc-outside').boundingBox())!;
    const grown = (await node('loc-parent').boundingBox())!;
    expect(nested.x).toBeGreaterThanOrEqual(grown.x);

    // Now the same drag in reverse, from inside the box: leaving it *is* a change, so the pane is framed.
    await page.mouse.move(nested.x + nested.width / 2, nested.y + nested.height / 2);
    await page.mouse.down();
    await page.mouse.move(grown.x + grown.width + 140, grown.y + grown.height / 2, { steps: 12 });
    await expect(topLevel).toBeVisible();
    await expect(harborBox).toHaveCount(0);

    // And it lands where the frame said: back out on its own, with the free travel it had inside now gone.
    await page.mouse.up();
    await expect(topLevel).toHaveCount(0);
    await expect(page.locator('.react-flow__edge')).toHaveCount(2);
  });

  /**
   * A box cannot be given to something it already holds. The rule is asserted against geometry in the unit
   * tests; what a drag proves is that the box under the cursor is judged by that rule and not by whichever
   * node the pointer happens to be over.
   */
  test('a box dragged over what it already holds lights up nothing', async ({ page }) => {
    await openApp(page);
    await page.evaluate(async (world) => {
      const dev = (window as unknown as { __fmDev: DevRouter }).__fmDev;
      const id = await dev.putWorld(world);
      await dev.editWorld(id);
    }, NESTED_WORLD);
    await gotoDev(page, 'mainMenu', { modal: 'worldEditor', tab: 'locations', subtab: 'canvas' });

    const node = (id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);
    await node('loc-parent').waitFor();
    const harbor = (await node('loc-parent').boundingBox())!;
    const dock = (await node('loc-child-a').boundingBox())!;

    // The Harbor, dragged onto the Dock — a box it holds, and one that holds a location of its own, so it is
    // a real group rather than a leaf the rule would refuse anyway.
    await page.mouse.move(harbor.x + harbor.width / 2, harbor.y + 12);
    await page.mouse.down();
    await page.mouse.move(dock.x + dock.width / 2, dock.y + dock.height / 2, { steps: 12 });

    // Nothing is named: not the Dock it is over, and not the pane either — the Harbor already stands on its
    // own, so there is no change for either to announce.
    await expect(page.locator('[data-drop-target]')).toHaveCount(0);
    await expect(page.getByTestId('canvas-top-level-drop')).toHaveCount(0);
    await page.mouse.up();

    // And nothing nested: the Harbor still holds the Dock, rather than the other way about.
    await gotoDev(page, 'mainMenu', { modal: 'worldEditor', tab: 'locations', subtab: 'list' });
    const rowLeft = async (name: string) => (await page.getByText(name, { exact: true }).first().boundingBox())!.x;
    expect(await rowLeft('Dock')).toBeGreaterThan(await rowLeft('Harbor'));
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
