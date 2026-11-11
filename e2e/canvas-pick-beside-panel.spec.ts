import { test, expect, type Page } from '@playwright/test';
import { openApp } from './app';

interface DevRouter {
  putWorld(world: unknown): Promise<string>;
  editWorld(id: string): Promise<void>;
  goto(view: string, opts: Record<string, string | boolean>): void;
}

/** The Farrier, named through a placeholder, wanders the Market; the Rats begin at the Smithy. */
const WORLD = {
  id: 'e2e-canvas-pick-beside',
  worldOverview: { name: 'E2E Pick Beside', description: '', author: '' },
  placeholders: [{ id: 'ph-title', name: 'Title', values: [{ id: 'title-0', text: 'Old' }] }],
  locations: [
    { id: 'smithy', name: 'Smithy', canvasPosition: { x: 0, y: 0 } },
    { id: 'market', name: 'Market', canvasPosition: { x: 260, y: 0 } },
    { id: 'square', name: 'Square', canvasPosition: { x: 520, y: 0 } },
    { id: 'island', name: 'Island', canvasPosition: { x: 520, y: 220 } },
  ],
  connections: [
    { id: 'c1', a: 'smithy', b: 'market', aToB: {}, bToA: {} },
    { id: 'c2', a: 'market', b: 'square', aToB: {}, bToA: {} },
  ],
  stats: [],
  entities: [
    {
      id: 'farrier', name: '{{ph:ph-title:world:title-0}} Farrier', playerDescription: '', aiDescription: '',
      kind: 'unique', traversable: 'anywhere', knownIn: ['square'],
      starts: [{
        id: 's1', place: 'smithy', weight: 1, schedule: [
          { id: 'wander', time: { start: 360, end: 720 }, action: { kind: 'wander', places: [{ place: 'market', weight: 1 }], idle: 60 } },
        ],
      }],
    },
    {
      id: 'rats', name: 'Rats', playerDescription: '', aiDescription: '', kind: 'generic',
      starts: [{ id: 'r1', place: 'smithy', weight: 1, schedule: [] }],
    },
  ],
  traits: [],
  statUpdates: [],
};

const node = (page: Page, id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);
const undo = (page: Page) => page.getByRole('button', { name: 'Undo', exact: true }).first();
const exitFullScreen = (page: Page) => page.getByRole('button', { name: 'Exit full screen' }).click();
const enterFullScreen = (page: Page) => page.locator('.react-flow__controls').getByRole('button', { name: 'Edit full screen' }).click();

async function openCanvas(page: Page, route: Record<string, string>) {
  await openApp(page);
  await page.evaluate(async ([world, extra]) => {
    const dev = (window as unknown as { __fmDev: DevRouter }).__fmDev;
    const id = await dev.putWorld(world);
    await dev.editWorld(id);
    dev.goto('mainMenu', { modal: 'worldEditor', tab: 'locations', subtab: 'canvas', ...extra });
  }, [WORLD, route] as const);
  await node(page, 'island').waitFor();
}

test.describe('Entity pick beside the panel', () => {
  test.skip(({ hasTouch }) => hasTouch, 'The canvas sits beside the panel on a wide layout');

  test('a shown routine draws its marks, the key and a status that names the entity', async ({ page }) => {
    await openCanvas(page, { pick: 'farrier' });
    await expect(page.getByTestId('canvas-key')).toBeVisible();
    await expect(node(page, 'market').locator('[data-routine-mark]')).toHaveCount(1);
    const status = page.getByTestId('routine-status');
    await expect(status).toContainText('Routine of');
    await expect(status).toContainText('Farrier');
    await expect(status).not.toContainText('{{');
    // View-only: no grip to drag a routine edit from, and the full-screen tools stay away.
    await expect(page.locator('[data-routine-source]')).toHaveCount(0);
    await expect(page.getByTestId('entity-pick-card')).toHaveCount(0);
    // As in full screen, no Connection is drawn from a box while a pick is shown.
    await expect(node(page, 'smithy').locator('.react-flow__handle.source')).toHaveCSS('pointer-events', 'none');
  });

  test('Known In mode draws the marks and the key, with no status line', async ({ page }) => {
    await openCanvas(page, { pick: 'farrier:knownIn' });
    await expect(page.getByTestId('canvas-key')).toBeVisible();
    await expect(node(page, 'square').locator('[data-pick-mark]')).toHaveCount(1);
    await expect(page.getByTestId('routine-status')).toHaveCount(0);
    await expect(node(page, 'smithy').locator('.react-flow__handle.source')).toHaveCSS('pointer-events', 'none');
  });

  test('a click on a location selects it and writes nothing to the entity', async ({ page }) => {
    // A Generic entity with no row selected is where a full-screen click adds or removes a Start.
    await openCanvas(page, { pick: 'rats' });
    await expect(page.getByTestId('routine-status')).toContainText('Routine of Rats');
    const islandMark = await node(page, 'island').locator('[data-routine-mark]').getAttribute('data-routine-mark');
    await node(page, 'island').click();
    await expect(node(page, 'island')).toHaveClass(/selected/);
    await expect(page.locator('[data-tour-anchor="location-name"]')).toContainText('Island');
    await expect(undo(page)).toBeDisabled();
    await expect(node(page, 'island').locator('[data-routine-mark]')).toHaveAttribute('data-routine-mark', islandMark ?? '');
    // The pick stays on show.
    await expect(page.getByTestId('routine-status')).toContainText('Routine of Rats');
  });

  test('a shown pick is the card entity in full screen, and its selected row narrows the shown routine after', async ({ page }) => {
    await openCanvas(page, { pick: 'farrier' });
    await enterFullScreen(page);
    const card = page.getByTestId('entity-pick-card');
    await expect(card.getByRole('combobox', { name: 'Entity' })).toContainText('Farrier');
    await page.locator('[data-routine-row="wander"]').click();
    await expect(node(page, 'market').locator('[data-routine-source]')).toBeVisible();
    // By keyboard: a press outside the Routine editor clears its selected row.
    await page.getByRole('button', { name: 'Exit full screen' }).focus();
    await page.keyboard.press('Enter');
    await expect(card).toHaveCount(0);
    const status = page.getByTestId('routine-status');
    await expect(status).toContainText('Wander');
    await expect(status).toContainText('Locations of this row');
    // The selected row draws its grips in full screen only.
    await expect(node(page, 'market').locator('[data-routine-tone="wander"]')).toBeVisible();
    await expect(page.locator('[data-routine-source]')).toHaveCount(0);
  });

  test('a pick made in full screen stays set, and draws nothing beside the panel until shown', async ({ page }) => {
    await openCanvas(page, { fullscreen: '1', pick: 'farrier' });
    await expect(page.getByTestId('entity-pick-card').getByRole('combobox', { name: 'Entity' })).toContainText('Farrier');
    await exitFullScreen(page);
    await expect(page.getByTestId('routine-status')).toHaveCount(0);
    await expect(page.getByTestId('canvas-key')).toHaveCount(0);
    await expect(page.locator('[data-routine-mark]')).toHaveCount(0);
    await expect(node(page, 'smithy').locator('.react-flow__handle.source')).not.toHaveCSS('pointer-events', 'none');
    await enterFullScreen(page);
    await expect(page.getByTestId('entity-pick-card').getByRole('combobox', { name: 'Entity' })).toContainText('Farrier');
  });
});
