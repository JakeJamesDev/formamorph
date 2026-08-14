import { test, expect } from '@playwright/test';
import { openApp, gotoDev } from './app';

interface DevRouter {
  putWorld(world: unknown): Promise<string>;
  editWorld(id: string): Promise<void>;
}

/** A parent and one child: the smallest world the canvas draws an implicit travel arrow in. */
const WORLD = {
  id: 'e2e-canvas-world',
  worldOverview: { name: 'E2E Canvas', description: '', author: '' },
  locations: [
    { id: 'loc-parent', name: 'Harbor' },
    { id: 'loc-child-a', name: 'Dock', parentId: 'loc-parent' },
    { id: 'loc-child-b', name: 'Warehouse', parentId: 'loc-parent' },
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
    // The mode-toggle tutorial pops over the editor's top-right corner, where the inspector lands.
    await openApp(page, { 'formamorph.tutorialsSeen': ['world-editor-mode-toggle'] });
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
});
