import { test, expect, type Page } from '@playwright/test';
import { openApp } from './app';

interface DevRouter {
  putWorld(world: unknown): Promise<string>;
  editWorld(id: string): Promise<void>;
  goto(view: string, opts: Record<string, string | boolean>): void;
}

/** A row of linked places with an island nothing reaches. The Farrier wanders the Market and patrols Wall → Gate. */
const WORLD = {
  id: 'e2e-canvas-routine',
  worldOverview: { name: 'E2E Routine', description: '', author: '' },
  locations: [
    { id: 'smithy', name: 'Smithy', canvasPosition: { x: 0, y: 0 } },
    { id: 'market', name: 'Market', canvasPosition: { x: 260, y: 0 } },
    { id: 'square', name: 'Square', canvasPosition: { x: 520, y: 0 } },
    { id: 'wall', name: 'Wall', canvasPosition: { x: 0, y: 220 } },
    { id: 'gate', name: 'Gate', canvasPosition: { x: 260, y: 220 } },
    { id: 'island', name: 'Island', canvasPosition: { x: 520, y: 220 } },
  ],
  connections: [
    { id: 'c1', a: 'smithy', b: 'market', aToB: {}, bToA: {} },
    { id: 'c2', a: 'market', b: 'square', aToB: {}, bToA: {} },
    { id: 'c3', a: 'smithy', b: 'wall', aToB: {}, bToA: {} },
    { id: 'c4', a: 'wall', b: 'gate', aToB: {}, bToA: {} },
  ],
  stats: [],
  entities: [{
    id: 'farrier', name: 'Farrier', playerDescription: '', aiDescription: '', kind: 'individual', traversable: 'anywhere',
    starts: [{
      id: 's1', place: 'smithy', weight: 1, schedule: [
        { id: 'wander', time: { start: 360, end: 720 }, action: { kind: 'wander', places: [{ place: 'market', weight: 1 }], idle: 60 } },
        { id: 'patrol', time: { start: 720, end: 1080 }, action: { kind: 'patrol', stops: [{ place: 'wall', idle: 30 }, { place: 'gate', idle: 30 }] } },
      ],
    }],
  }],
  traits: [],
  statUpdates: [],
};

const node = (page: Page, id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);
const center = async (page: Page, selector: string) => {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`no box for ${selector}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

async function openRoutine(page: Page) {
  await openApp(page);
  await page.evaluate(async (world) => {
    const dev = (window as unknown as { __fmDev: DevRouter }).__fmDev;
    const id = await dev.putWorld(world);
    await dev.editWorld(id);
    dev.goto('mainMenu', { modal: 'worldEditor', tab: 'locations', subtab: 'canvas', fullscreen: '1', pick: 'farrier' });
  }, WORLD);
  await node(page, 'island').waitFor();
}

/** Presses the grip of `from`, holds over `over` long enough to read the drop state, then releases there. */
async function dragGrip(page: Page, from: string, over: string) {
  const start = await center(page, `.react-flow__node[data-id="${from}"] .react-flow__handle.source`);
  const end = await center(page, `.react-flow__node[data-id="${over}"]`);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 20, start.y + 10, { steps: 4 });
  await page.mouse.move(end.x, end.y, { steps: 12 });
}

// xyflow's own class token; the handle's Tailwind classes hold the text `valid` too.
const VALID = /(^|\s)valid(\s|$)/;
const dropTarget =(page: Page, id: string) => page.locator(`.react-flow__node[data-id="${id}"] .react-flow__handle.target`);

test.describe('Canvas routine editing', () => {
  test.skip(({ hasTouch }) => hasTouch, 'A grip drag is a mouse gesture');

  test('a Wander drag adds the place it lands on, and refuses an unconnected one in the air', async ({ page }) => {
    await openRoutine(page);
    await page.locator('[data-routine-row="wander"]').click();
    await expect(page.getByTestId('routine-status')).toContainText('Wander');
    // The selected row's grip shows without a hover; one outside the row stays hidden.
    await expect(node(page, 'market').locator('[data-routine-source]')).toBeVisible();
    await expect(node(page, 'square').locator('[data-routine-source]')).toHaveCount(0);

    await dragGrip(page, 'market', 'island');
    await expect(dropTarget(page, 'island')).toHaveClass(/connectingto/);
    await expect(dropTarget(page, 'island')).not.toHaveClass(VALID);
    const square = await center(page, '.react-flow__node[data-id="square"]');
    await page.mouse.move(square.x, square.y, { steps: 8 });
    await expect(dropTarget(page, 'square')).toHaveClass(VALID);
    await page.mouse.up();

    await expect(node(page, 'square').locator('[data-routine-tone="wander"]')).toBeVisible();
    await expect(node(page, 'island').locator('[data-routine-mark="faded"]')).toBeVisible();

    // The Square is in the set now, so a second drag onto it is refused in the air.
    await dragGrip(page, 'market', 'square');
    await expect(dropTarget(page, 'square')).toHaveClass(/connectingto/);
    await expect(dropTarget(page, 'square')).not.toHaveClass(VALID);
    await page.mouse.up();
  });

  test('a Patrol drag adds a stop right after the one it left', async ({ page }) => {
    await openRoutine(page);
    await page.locator('[data-routine-row="patrol"]').click();
    await dragGrip(page, 'wall', 'smithy');
    await expect(dropTarget(page, 'smithy')).toHaveClass(VALID);
    await page.mouse.up();

    // Wall, Smithy, Gate: the new stop is 2 and the Gate moves to 3.
    await expect(node(page, 'smithy').locator('[data-routine-badge]')).toHaveText('2');
    await expect(node(page, 'gate').locator('[data-routine-badge]')).toHaveText('3');

    // The drag is the world's only Step: one undo empties the history and leaves it to redo.
    await page.keyboard.press('Control+z');
    await expect(page.getByRole('button', { name: 'Undo', exact: true }).first()).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Redo', exact: true }).first()).toBeEnabled();
  });

  test('a drag from the last stop back to stop 1 is refused in the air', async ({ page }) => {
    await openRoutine(page);
    await page.locator('[data-routine-row="patrol"]').click();
    await dragGrip(page, 'gate', 'wall');
    await expect(dropTarget(page, 'wall')).toHaveClass(/connectingto/);
    await expect(dropTarget(page, 'wall')).not.toHaveClass(VALID);
    await page.mouse.up();
    await expect(node(page, 'wall').locator('[data-routine-badge]')).toHaveText('1');
  });
});
