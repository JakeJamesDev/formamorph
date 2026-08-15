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

/** The same shape with the Harbor's two children hand-stacked on one spot, which is what an arrangement undoes. */
const STACKED_WORLD = {
  ...WORLD,
  id: 'e2e-canvas-stacked',
  locations: [
    { id: 'loc-parent', name: 'Harbor', canvasPosition: { x: 40, y: 40 } },
    { id: 'loc-child-a', name: 'Dock', parentId: 'loc-parent', canvasPosition: { x: 30, y: 50 } },
    { id: 'loc-child-b', name: 'Warehouse', parentId: 'loc-parent', canvasPosition: { x: 34, y: 54 } },
    { id: 'loc-outside', name: 'Beach', canvasPosition: { x: 600, y: 40 } },
  ],
};

/** A Group with an authored Connection down to one of the locations it holds — the pair the border-anchor
 *  fix is about, and the one arrow whose shape the style picker is watched on. */
const PARENT_CHILD_CONNECTION_WORLD = {
  ...WORLD,
  id: 'e2e-canvas-parent-child',
  connections: [{ id: 'conn-parent-child', from: 'loc-parent', to: 'loc-child-a', twoWay: false }],
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

  /**
   * The marquee and the unit drag are one gesture's two halves, and neither exists outside a real pointer:
   * which button pans, what a left-drag over the pane draws, and whether a selection travels together are all
   * decided by hit-testing rather than by any state the DOM shows afterwards.
   */
  test('a marquee selects several locations and drags them as one', async ({ page }) => {
    await openApp(page);
    await page.evaluate(async (world) => {
      const dev = (window as unknown as { __fmDev: DevRouter }).__fmDev;
      const id = await dev.putWorld(world);
      await dev.editWorld(id);
    }, WORLD);
    await gotoDev(page, 'mainMenu', { modal: 'worldEditor', tab: 'locations', subtab: 'canvas' });

    const node = (id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);
    await node('loc-outside').waitFor();

    // From an empty corner of the pane across everything on it: left-drag over the pane is the marquee.
    const pane = (await page.locator('.react-flow__pane').boundingBox())!;
    await page.mouse.move(pane.x + 2, pane.y + 2);
    await page.mouse.down();
    await page.mouse.move(pane.x + pane.width - 2, pane.y + pane.height - 2, { steps: 12 });
    await page.mouse.up();
    await expect(page.locator('.react-flow__node.selected')).toHaveCount(4);

    // Dragging one member carries the rest: both boxes travel the same distance, not just the one grabbed.
    const beachWas = (await node('loc-outside').boundingBox())!;
    const harborWas = (await node('loc-parent').boundingBox())!;
    await page.mouse.move(beachWas.x + beachWas.width / 2, beachWas.y + beachWas.height / 2);
    await page.mouse.down();
    await page.mouse.move(beachWas.x + beachWas.width / 2, beachWas.y + beachWas.height / 2 + 120, { steps: 12 });
    await page.mouse.up();

    const beachNow = (await node('loc-outside').boundingBox())!;
    const harborNow = (await node('loc-parent').boundingBox())!;
    expect(beachNow.y - beachWas.y).toBeGreaterThan(40);
    expect(harborNow.y - harborWas.y).toBeCloseTo(beachNow.y - beachWas.y, 0);
    expect(harborNow.x - harborWas.x).toBeCloseTo(beachNow.x - beachWas.x, 0);
    // A move, not a reparent: the Beach still stands on its own, so the world's travel is what it was.
    await expect(page.locator('.react-flow__edge')).toHaveCount(2);

    await page.keyboard.press('Escape');
    await expect(page.locator('.react-flow__node.selected')).toHaveCount(0);
  });

  /**
   * A selection is dragged as one gesture but lands a location at a time, and the highlight has to say so
   * while the drag is still in the air — which is only visible with the button held down.
   */
  test('every member of a dragged selection names where it is going', async ({ page }, testInfo) => {
    // Composing this selection needs Shift with a click, and a tap on a small screen opens the location's
    // editor over the map instead — there is no two-location selection to drag there to begin with.
    test.skip(testInfo.project.name === 'mobile', 'Shift-click has no mobile equivalent');
    await openApp(page);
    await page.evaluate(async (world) => {
      const dev = (window as unknown as { __fmDev: DevRouter }).__fmDev;
      const id = await dev.putWorld(world);
      await dev.editWorld(id);
    }, WORLD);
    await gotoDev(page, 'mainMenu', { modal: 'worldEditor', tab: 'locations', subtab: 'canvas' });

    const node = (id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);
    await node('loc-outside').waitFor();

    // The Beach, standing on its own, and the Warehouse, held by the Harbor.
    await node('loc-outside').click();
    await node('loc-child-b').click({ modifiers: ['Shift'] });
    await expect(page.locator('.react-flow__node.selected')).toHaveCount(2);

    const beach = (await node('loc-outside').boundingBox())!;
    const harbor = (await node('loc-parent').boundingBox())!;
    await page.mouse.move(beach.x + beach.width / 2, beach.y + beach.height / 2);
    await page.mouse.down();
    // Onto the near end of the Harbor's title strip, so the same travel carries the Warehouse clear of the
    // frame's other side rather than only shuffling it about inside.
    await page.mouse.move(harbor.x + 30, harbor.y + 12, { steps: 12 });

    // One gesture saying two things: the Harbor is about to take the Beach, and the Warehouse it carried the
    // same distance is on its way out of the Harbor to the top level.
    await expect(node('loc-parent').locator('[data-drop-target]')).toHaveCount(1);
    await expect(page.getByTestId('canvas-top-level-drop')).toBeVisible();

    // And that is what lands: the two locations swap which side of the Harbor's frame they are on.
    await page.mouse.up();
    await gotoDev(page, 'mainMenu', { modal: 'worldEditor', tab: 'locations', subtab: 'list' });
    const rowLeft = async (name: string) => (await page.getByText(name, { exact: true }).first().boundingBox())!.x;
    expect(await rowLeft('Beach')).toBeGreaterThan(await rowLeft('Harbor'));
    expect(await rowLeft('Warehouse')).toBeCloseTo(await rowLeft('Harbor'), 0);
  });

  /**
   * The touch half of composing a selection. A hold and a tap are the same press told apart by time, and a
   * hold that fires has to leave no tap behind it — none of which any rendered state afterwards can show.
   */
  test('a finger held on a location adds it to the selection, and holding it again removes it', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'the gesture only exists on a touch screen');
    await openApp(page);
    await page.evaluate(async (world) => {
      const dev = (window as unknown as { __fmDev: DevRouter }).__fmDev;
      const id = await dev.putWorld(world);
      await dev.editWorld(id);
    }, WORLD);
    await gotoDev(page, 'mainMenu', { modal: 'worldEditor', tab: 'locations', subtab: 'canvas' });

    const node = (id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);
    await node('loc-outside').waitFor();
    const selected = page.locator('.react-flow__node.selected');

    // Playwright's touchscreen taps and lets go, so the press is driven directly — held, then released.
    const touch = async (id: string, hold: number) => {
      const box = (await node(id).boundingBox())!;
      const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      const send = (type: string) => page.locator(`.react-flow__node[data-id="${id}"]`).dispatchEvent(type, {
        pointerType: 'touch', pointerId: 1, isPrimary: true, bubbles: true, clientX: at.x, clientY: at.y,
      });
      await send('pointerdown');
      await page.waitForTimeout(hold);
      await send('pointerup');
      await send('click');
    };

    // A quick tap is the tap it always was: one location selected, its editor opened over the map.
    await touch('loc-outside', 50);
    await expect(selected).toHaveCount(1);

    // Held, the Warehouse joins the selection — and the tap that ended the hold did not take its place.
    await touch('loc-child-b', 700);
    await expect(selected).toHaveCount(2);
    await expect(node('loc-child-b')).toHaveClass(/selected/);
    await expect(node('loc-outside')).toHaveClass(/selected/);

    // Held again, it leaves: the same gesture toggles rather than only adding.
    await touch('loc-child-b', 700);
    await expect(selected).toHaveCount(1);
    await expect(node('loc-outside')).toHaveClass(/selected/);
  });

  /**
   * Right-click and right-drag are the same button, told apart only by whether the pointer traveled — which
   * is a distinction nothing but a real pointer can make.
   */
  test('right-click opens the canvas menu and a right-drag pans instead', async ({ page }) => {
    await openApp(page);
    await page.evaluate(async (world) => {
      const dev = (window as unknown as { __fmDev: DevRouter }).__fmDev;
      const id = await dev.putWorld(world);
      await dev.editWorld(id);
    }, WORLD);
    await gotoDev(page, 'mainMenu', { modal: 'worldEditor', tab: 'locations', subtab: 'canvas' });

    await page.locator('.react-flow__node[data-id="loc-outside"]').waitFor();
    const menu = page.getByRole('menu', { name: 'Canvas Options' });
    const pane = (await page.locator('.react-flow__pane').boundingBox())!;
    const from = { x: pane.x + pane.width / 2, y: pane.y + pane.height - 20 };
    const viewport = () => page.locator('.react-flow__viewport').getAttribute('style');

    // A right-drag is a pan: the map moves under the pointer and nothing opens. What a driven browser cannot
    // show is the menu the platform asks for on that release — Playwright's right-button release raises no
    // such request — so telling that release apart from a click is covered in `isStationaryClick`'s tests.
    const before = await viewport();
    await page.mouse.move(from.x, from.y);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(from.x - 140, from.y, { steps: 12 });
    await page.mouse.up({ button: 'right' });
    await expect(menu).toBeHidden();
    expect(await viewport()).not.toBe(before);

    // And the browser's own menu is refused wherever it is asked for, which is what ours stands in for.
    const prevented = await page.evaluate(() => {
      const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      document.querySelector('.react-flow__pane')!.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(prevented).toBe(true);

    // A right-click that stayed put opens ours, and its actions reach the selection.
    await page.mouse.click(from.x, from.y, { button: 'right' });
    await expect(menu).toBeVisible();
    await menu.getByRole('menuitem', { name: 'Select All Locations' }).click();
    await expect(page.locator('.react-flow__node.selected')).toHaveCount(4);
  });

  /**
   * The pane xyflow listens for a pan on sits behind the boxes, so a press that starts on one never reaches
   * it — a gap only a real press over a real node can find.
   */
  test('a right-drag pans the map even when it starts on a location', async ({ page }) => {
    await openApp(page);
    await page.evaluate(async (world) => {
      const dev = (window as unknown as { __fmDev: DevRouter }).__fmDev;
      const id = await dev.putWorld(world);
      await dev.editWorld(id);
    }, WORLD);
    await gotoDev(page, 'mainMenu', { modal: 'worldEditor', tab: 'locations', subtab: 'canvas' });

    const beach = page.locator('.react-flow__node[data-id="loc-outside"]');
    await beach.waitFor();
    const viewport = () => page.locator('.react-flow__viewport').getAttribute('style');
    const box = (await beach.boundingBox())!;
    const grab = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

    const before = await viewport();
    await page.mouse.move(grab.x, grab.y);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(grab.x - 120, grab.y - 60, { steps: 12 });
    await page.mouse.up({ button: 'right' });

    // The map moved under the pointer, and the location stayed where it was on it — a pan, not a drag.
    expect(await viewport()).not.toBe(before);
    const after = (await beach.boundingBox())!;
    expect(after.x - box.x).toBeCloseTo(-120, 0);
    expect(after.y - box.y).toBeCloseTo(-60, 0);
    await gotoDev(page, 'mainMenu', { modal: 'worldEditor', tab: 'locations', subtab: 'list' });
    const rowLeft = async (name: string) => (await page.getByText(name, { exact: true }).first().boundingBox())!.x;
    expect(await rowLeft('Beach')).toBeCloseTo(await rowLeft('Harbor'), 0); // still top-level, still unmoved
  });

  /**
   * Full screen is the same canvas in a different frame, and what proves it is the world arriving with it:
   * the boxes are the same boxes, drawn by the same mapper, and the selection the author left the pane with
   * is still theirs. The embedded view's minimal chrome is asserted from the same run — a toolbar or a minimap
   * appearing there is exactly the drift this guards.
   */
  test('the canvas opens full screen and the embedded view stays minimal', async ({ page }) => {
    await openApp(page);
    await page.evaluate(async (world) => {
      const dev = (window as unknown as { __fmDev: DevRouter }).__fmDev;
      const id = await dev.putWorld(world);
      await dev.editWorld(id);
    }, WORLD);
    await gotoDev(page, 'mainMenu', { modal: 'worldEditor', tab: 'locations', subtab: 'canvas' });

    await page.locator('.react-flow__node[data-id="loc-outside"]').waitFor();
    // The embedded chrome is the zoom controls plus the way to full screen, and nothing else yet.
    await expect(page.locator('.react-flow__minimap')).toHaveCount(0);
    await expect(page.getByRole('toolbar')).toHaveCount(0);
    const fullscreenButton = page.locator('.react-flow__controls').getByRole('button', { name: 'Edit full screen' });
    await expect(fullscreenButton).toBeVisible();

    // Something to lose on the way through: every location picked in the pane. Composed with Ctrl+A rather
    // than by clicking a node, which on the narrow layout pushes the editor to the detail panel and takes the
    // canvas off screen — the selection is the subject here, not how it was made.
    const pane = (await page.locator('.react-flow__pane').boundingBox())!;
    await page.mouse.click(pane.x + 8, pane.y + 8);
    await page.keyboard.press('Control+a');
    await expect(page.locator('.react-flow__node.selected')).toHaveCount(4);

    await fullscreenButton.click();
    const window_ = page.getByRole('dialog', { name: 'Locations Canvas' });
    await expect(window_).toBeVisible();
    // The same four boxes, in the window rather than the pane — and the pick came with them.
    await expect(window_.locator('.react-flow__node')).toHaveCount(4);
    await expect(window_.locator('.react-flow__node.selected')).toHaveCount(4);
    // One canvas, not two: the pane's copy is gone rather than sitting live behind the window.
    await expect(page.locator('.react-flow__node')).toHaveCount(4);

    await page.keyboard.press('Escape');
    await expect(window_).toBeHidden();
    await expect(fullscreenButton).toBeVisible();
    await expect(page.locator('.react-flow__node.selected')).toHaveCount(4);
  });

  /**
   * Auto Arrange is asserted as geometry in the unit tests; what a real canvas proves is that the menu entry
   * appears on a box that holds something, that pressing it redraws the map, and that the arrangement is what
   * the world kept — the boxes on screen are the stored positions read back.
   */
  test('auto arrange lays out a group from its own menu', async ({ page }) => {
    await openApp(page);
    await page.evaluate(async (world) => {
      const dev = (window as unknown as { __fmDev: DevRouter }).__fmDev;
      const id = await dev.putWorld(world);
      await dev.editWorld(id);
    }, STACKED_WORLD);
    await gotoDev(page, 'mainMenu', { modal: 'worldEditor', tab: 'locations', subtab: 'canvas' });

    const node = (id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);
    await node('loc-parent').waitFor();
    const overlapping = async () => {
      const dock = (await node('loc-child-a').boundingBox())!;
      const store = (await node('loc-child-b').boundingBox())!;
      return dock.x < store.x + store.width && store.x < dock.x + dock.width
        && dock.y < store.y + store.height && store.y < dock.y + dock.height;
    };
    expect(await overlapping()).toBe(true); // stacked by hand, as the world was seeded

    // A leaf holds nothing to lay out, so it is not offered the command.
    await node('loc-outside').click({ button: 'right' });
    const menu = page.getByRole('menu', { name: 'Canvas Options' });
    await expect(menu.getByRole('menuitem', { name: 'Auto Arrange', exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');

    // The Harbor's own title strip, which is the group rather than either child's box.
    const harbor = (await node('loc-parent').boundingBox())!;
    await page.mouse.click(harbor.x + harbor.width / 2, harbor.y + 12, { button: 'right' });
    await menu.getByRole('menuitem', { name: 'Auto Arrange', exact: true }).click();

    // The two boxes are off each other, and the arrangement is what the world now holds: leaving the canvas
    // and coming back redraws it from the stored positions.
    await expect.poll(overlapping).toBe(false);
    const laidOut = (await node('loc-child-a').boundingBox())!;
    await gotoDev(page, 'mainMenu', { modal: 'worldEditor', tab: 'locations', subtab: 'list' });
    await gotoDev(page, 'mainMenu', { modal: 'worldEditor', tab: 'locations', subtab: 'canvas' });
    await node('loc-child-a').waitFor();
    expect((await node('loc-child-a').boundingBox())!.x).toBeCloseTo(laidOut.x, 0);
    expect(await overlapping()).toBe(false);
  });

  /**
   * The three shapes, and the anchoring underneath them. The geometry is asserted as numbers in the unit
   * tests; what only the real canvas shows is that the arrow xyflow draws is built from those numbers — that
   * the picked shape reaches the path, that it outlives leaving the canvas, and that an authored Group↔child
   * Connection touches the two boxes' borders on screen rather than diving to either center.
   */
  test('the connection style picker redraws the arrows and is remembered', async ({ page }) => {
    await openApp(page);
    await page.evaluate(async (world) => {
      const dev = (window as unknown as { __fmDev: DevRouter }).__fmDev;
      const id = await dev.putWorld(world);
      await dev.editWorld(id);
    }, PARENT_CHILD_CONNECTION_WORLD);
    await gotoDev(page, 'mainMenu', { modal: 'worldEditor', tab: 'locations', subtab: 'canvas' });

    const authored = page.locator('.react-flow__edge[data-id="connection:conn-parent-child:forward"] path.react-flow__edge-path');
    await authored.waitFor();
    const shape = async () => (await authored.getAttribute('d'))!;
    const pick = async (label: string) => {
      await page.locator('.react-flow__pane').click({ button: 'right', position: { x: 30, y: 30 } });
      await page.getByRole('menuitemradio', { name: label }).click();
    };

    // Straight is the default: one segment, end to end.
    expect(await shape()).toMatch(/^M [-\d.]+,[-\d.]+ L [-\d.]+,[-\d.]+$/);

    /** The path's ends in screen coordinates, which is where the boxes are measured. */
    const ends = async () => {
      const d = await shape();
      const points = [...d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m) => ({ x: +m[1], y: +m[2] }));
      const view = (await page.locator('.react-flow__viewport').getAttribute('style'))!;
      const [tx, ty, scale] = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)\s*scale\(([\d.]+)\)/.exec(view)!
        .slice(1).map(Number);
      const frame = (await page.locator('.react-flow').boundingBox())!;
      const toScreen = (p: { x: number; y: number }) =>
        ({ x: frame.x + tx + p.x * scale, y: frame.y + ty + p.y * scale });
      return [toScreen(points[0]), toScreen(points[points.length - 1])];
    };
    /** How far a point sits from the nearest side of a box, negative when it is outside one. */
    const insetFrom = (box: { x: number; y: number; width: number; height: number }, p: { x: number; y: number }) =>
      Math.min(p.x - box.x, box.x + box.width - p.x, p.y - box.y, box.y + box.height - p.y);

    const parent = (await page.locator('.react-flow__node[data-id="loc-parent"]').boundingBox())!;
    const child = (await page.locator('.react-flow__node[data-id="loc-child-a"]').boundingBox())!;
    const [from, to] = await ends();
    // Each end is on its own box's frame — a couple of pixels of the side-by-side arrow offset, not the
    // tens of pixels a dive to a center would be.
    expect(Math.abs(insetFrom(parent, from))).toBeLessThan(8);
    expect(Math.abs(insetFrom(child, to))).toBeLessThan(8);
    // And it spans the gap between the two frames rather than the Group: aimed at a center instead, the arrow
    // would set off from the far side of the Group and cross the whole box to get here.
    expect(Math.hypot(to.x - from.x, to.y - from.y)).toBeLessThan(Math.min(parent.width, parent.height) / 2);

    // Curved and elbow move the shape between those ends, and nothing else about the arrow.
    await pick('Curved Connections');
    await expect.poll(shape).toContain(' C ');
    await pick('Elbow Connections');
    const elbow = await shape();
    expect(elbow.match(/ L /g)!.length).toBe(3);

    // What every arrow says is unchanged by the shape it is drawn in: an authored Connection stays solid and
    // an implicit one dashed, and both keep the arrowhead that gives the direction.
    const implicit = page.locator('.react-flow__edge[data-id^="implicit:"] path.react-flow__edge-path').first();
    for (const edge of [authored, implicit]) {
      await expect(edge).toHaveAttribute('marker-end', /url\(/);
    }
    expect(await authored.evaluate((p) => getComputedStyle(p).strokeDasharray)).toBe('none');
    expect(await implicit.evaluate((p) => getComputedStyle(p).strokeDasharray)).not.toBe('none');

    // Leaving the canvas and coming back draws the shape the author picked, not the default.
    await gotoDev(page, 'mainMenu', { modal: 'worldEditor', tab: 'locations', subtab: 'list' });
    await gotoDev(page, 'mainMenu', { modal: 'worldEditor', tab: 'locations', subtab: 'canvas' });
    await authored.waitFor();
    expect((await shape()).match(/ L /g)!.length).toBe(3);
  });

  /**
   * Undo is asserted as a stack in the unit tests; what only a real canvas proves is that the gesture and the
   * keypress meet — that a drag actually reached the stack, that one press takes back the whole of it, and that
   * an arrangement of several boxes is one step rather than one per box.
   */
  test('Ctrl+Z takes back a drag and an Auto Arrange, and Ctrl+Y puts them back', async ({ page }) => {
    await openApp(page);
    await page.evaluate(async (world) => {
      const dev = (window as unknown as { __fmDev: DevRouter }).__fmDev;
      const id = await dev.putWorld(world);
      await dev.editWorld(id);
    }, STACKED_WORLD);
    await gotoDev(page, 'mainMenu', { modal: 'worldEditor', tab: 'locations', subtab: 'canvas' });

    const node = (id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);
    const edges = page.locator('.react-flow__edge');
    await node('loc-outside').waitFor();
    await expect(edges).toHaveCount(2); // Dock↔Warehouse only, while the Beach stands on its own

    // A real drag, onto the Harbor's title strip: the Beach is nested, so every sibling pair travels freely.
    const beach = (await node('loc-outside').boundingBox())!;
    const harbor = (await node('loc-parent').boundingBox())!;
    await page.mouse.move(beach.x + beach.width / 2, beach.y + beach.height / 2);
    await page.mouse.down();
    await page.mouse.move(harbor.x + harbor.width / 2, harbor.y + 12, { steps: 12 });
    await page.mouse.up();
    await expect(edges).toHaveCount(6);

    // One press takes the reparent back — and the list view is reading the same undone world.
    await page.keyboard.press('Control+z');
    await expect(edges).toHaveCount(2);
    await gotoDev(page, 'mainMenu', { modal: 'worldEditor', tab: 'locations', subtab: 'list' });
    const rowLeft = async (name: string) => (await page.getByText(name, { exact: true }).first().boundingBox())!.x;
    expect(await rowLeft('Beach')).toBeCloseTo(await rowLeft('Harbor'), 0);

    // And redo puts it back where the drag had left it.
    await gotoDev(page, 'mainMenu', { modal: 'worldEditor', tab: 'locations', subtab: 'canvas' });
    await node('loc-outside').waitFor();
    // The canvas takes no focus of its own — the last press is what says whose keyboard this is.
    await page.locator('.react-flow__pane').click({ position: { x: 20, y: 20 } });
    await page.keyboard.press('Control+y');
    await expect(edges).toHaveCount(6);
    await page.keyboard.press('Control+z');
    await expect(edges).toHaveCount(2);

    // An arrangement moves both of the Harbor's children off each other; one press puts both back stacked.
    const overlapping = async () => {
      const dock = (await node('loc-child-a').boundingBox())!;
      const store = (await node('loc-child-b').boundingBox())!;
      return dock.x < store.x + store.width && store.x < dock.x + dock.width
        && dock.y < store.y + store.height && store.y < dock.y + dock.height;
    };
    expect(await overlapping()).toBe(true);
    const grown = (await node('loc-parent').boundingBox())!;
    await page.mouse.click(grown.x + grown.width / 2, grown.y + 12, { button: 'right' });
    await page.getByRole('menu', { name: 'Canvas Options' })
      .getByRole('menuitem', { name: 'Auto Arrange', exact: true }).click();
    await expect.poll(overlapping).toBe(false);

    await page.keyboard.press('Control+Shift+z'); // the other redo chord is a no-op with nothing ahead
    await page.keyboard.press('Control+z');
    await expect.poll(overlapping).toBe(true);
  });

  /** The dev-route lands on the full-screen canvas in one call, which is what the later tickets verify from. */
  test('the dev-router opens the canvas full screen directly', async ({ page }) => {
    await openApp(page);
    await page.evaluate(async (world) => {
      const dev = (window as unknown as { __fmDev: DevRouter }).__fmDev;
      const id = await dev.putWorld(world);
      await dev.editWorld(id);
    }, WORLD);
    await gotoDev(page, 'mainMenu', {
      modal: 'worldEditor', tab: 'locations', subtab: 'canvas', fullscreen: true,
    });

    const window_ = page.getByRole('dialog', { name: 'Locations Canvas' });
    await expect(window_).toBeVisible();
    await expect(window_.locator('.react-flow__node')).toHaveCount(4);
  });
});
