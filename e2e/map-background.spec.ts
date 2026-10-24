import { mkdirSync } from 'node:fs';
import { test, expect, type Locator, type Page } from '@playwright/test';
import { openApp, gotoDev } from './app';

interface DevRouter {
  putWorld(world: unknown): Promise<string>;
  editWorld(id: string): Promise<void>;
}

/** Two top-level locations far apart, so their bounding box is wider than it is tall. */
const LOCATIONS = [
  { id: 'loc-harbor', name: 'Harbor', isStarting: true, canvasPosition: { x: 0, y: 0 } },
  { id: 'loc-marsh', name: 'Marsh', canvasPosition: { x: 640, y: 260 } },
];

const world = (id: string, overview: Record<string, unknown> = {}) => ({
  id,
  worldOverview: { name: 'E2E Map', description: '', author: '', ...overview },
  locations: LOCATIONS,
  stats: [],
  entities: [],
  traits: [],
  statUpdates: [],
});

/** A wide PNG drawn in the page, as bytes for a file input. */
async function pngBytes(page: Page, width: number, height: number): Promise<Buffer> {
  const url = await page.evaluate(([w, h]) => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const g = canvas.getContext('2d')!;
    g.fillStyle = '#4a8';
    g.fillRect(0, 0, w, h);
    return canvas.toDataURL('image/png');
  }, [width, height] as const);
  return Buffer.from(url.split(',')[1], 'base64');
}

async function openCanvas(page: Page, data: unknown): Promise<void> {
  await page.evaluate(async (w) => {
    const dev = (window as unknown as { __fmDev: DevRouter }).__fmDev;
    await dev.editWorld(await dev.putWorld(w));
  }, data);
  await gotoDev(page, 'mainMenu', { modal: 'worldEditor', tab: 'locations', subtab: 'canvas' });
  await page.locator('.react-flow__node[data-id="loc-marsh"]').waitFor();
}

/** The frame the layer draws, in canvas units, read off its own style. */
async function frameOf(layer: Locator) {
  return layer.evaluate((el) => {
    const s = (el as HTMLElement).style;
    const [, x, y] = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(s.transform)!;
    return { x: Number(x), y: Number(y), width: parseFloat(s.width), height: parseFloat(s.height) };
  });
}

async function paneMenu(page: Page): Promise<void> {
  const pane = (await page.locator('.react-flow__pane').boundingBox())!;
  await page.mouse.click(pane.x + pane.width / 2, pane.y + 20, { button: 'right' });
}

/** Pulls the view back so the whole image, corners included, sits inside the pane. */
async function zoomOut(page: Page, times: number): Promise<void> {
  for (let i = 0; i < times; i++) await page.getByRole('button', { name: 'Zoom Out' }).click();
  // The zoom animates; let it land before reading boxes.
  await page.waitForTimeout(400);
}

const center = async (el: Locator) => {
  const box = (await el.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

test.use({ viewport: { width: 1600, height: 900 } });

test.describe('Map Background', () => {
  test.beforeEach(({ page: _page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'the canvas gestures are mouse gestures');
  });

  test('Set Background Image covers the locations, and Adjust drags and resizes it one step at a time', async ({ page }) => {
    await openApp(page, { 'vite-ui-theme': 'dark' });
    await openCanvas(page, world('e2e-map-set'));

    await paneMenu(page);
    await page.getByRole('menuitem', { name: 'Set Background Image…' }).click();
    await page.locator('[data-map-background-panel="set"] #image-upload-canvas-map-background').setInputFiles({
      name: 'map.png', mimeType: 'image/png', buffer: await pngBytes(page, 400, 100),
    });
    // The upload offers its lossless re-encode; an author keeping the file as is takes the same path.
    await page.getByRole('button', { name: 'Keep original' }).click();
    const layer = page.locator('[data-map-background]');
    await expect(layer).toHaveAttribute('data-map-background', 'adjust');

    // The locations span 820 × 312 (two 180 × 52 boxes); a 4:1 image covers that at 1248 × 312.
    const placed = await frameOf(layer);
    expect(placed.width / placed.height).toBeCloseTo(4, 3);
    expect(placed.height).toBeCloseTo(312, 0);
    expect(placed.x).toBeLessThanOrEqual(0);
    expect(placed.x + placed.width).toBeGreaterThanOrEqual(820);

    // A drag moves it; a corner resize keeps its aspect ratio with the far corner fixed.
    await zoomOut(page, 2);
    const from = await center(layer);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 60, from.y + 40, { steps: 5 });
    await page.mouse.up();
    const moved = await frameOf(layer);
    expect(moved.x).toBeGreaterThan(placed.x);
    expect(moved.width).toBeCloseTo(placed.width, 3);

    const corner = await center(page.locator('[data-map-corner="nw"]'));
    await page.mouse.move(corner.x, corner.y);
    await page.mouse.down();
    await page.mouse.move(corner.x + 80, corner.y + 10, { steps: 5 });
    await page.mouse.up();
    const resized = await frameOf(layer);
    expect(resized.width).toBeLessThan(moved.width);
    expect(resized.width / resized.height).toBeCloseTo(4, 3);
    expect(resized.x + resized.width).toBeCloseTo(moved.x + moved.width, 1);

    mkdirSync('.scratch/frames', { recursive: true });
    await page.screenshot({ path: '.scratch/frames/map-background-adjust-dark.png' });

    // One undo walks back the resize alone, and a second the move.
    await page.getByRole('button', { name: 'Undo' }).first().click();
    expect(await frameOf(layer)).toEqual(moved);
    await page.getByRole('button', { name: 'Undo' }).first().click();
    expect(await frameOf(layer)).toEqual(placed);

    // One slider drag is one step, however many values it passed through.
    const opacity = () => layer.locator('img').evaluate((img) => Number((img as HTMLElement).style.opacity));
    const thumb = await center(page.getByRole('slider', { name: 'Opacity' }));
    await page.mouse.move(thumb.x, thumb.y);
    await page.mouse.down();
    await page.mouse.move(thumb.x - 60, thumb.y, { steps: 8 });
    await page.mouse.up();
    expect(await opacity()).toBeLessThan(0.9);
    await page.getByRole('button', { name: 'Undo' }).first().click();
    expect(await opacity()).toBe(1);
  });

  test('a locked background shows slot 0 and lets location drags and selection through', async ({ page }) => {
    await openApp(page);
    const slot0 = `data:image/png;base64,${(await pngBytes(page, 300, 200)).toString('base64')}`;
    const slot1 = `data:image/png;base64,${(await pngBytes(page, 200, 300)).toString('base64')}`;
    // Slot 0's rule names a stat the world lacks, so it never holds; authoring shows slot 0 all the same.
    const never = [{ all: [{ kind: 'stat', id: 'missing', operator: '>', value: 0, unit: 'raw' }] }];
    await openCanvas(page, world('e2e-map-locked', {
      mapBackground: {
        images: [{ data: slot0, requires: never }, { data: slot1 }],
        frame: { x: -200, y: -200, width: 1200, height: 800 },
        opacity: 1,
      },
    }));
    const layer = page.locator('[data-map-background]');
    await expect(layer).toHaveAttribute('data-map-background', 'locked');
    await expect(layer.locator('img')).toHaveAttribute('src', slot0);
    const before = await frameOf(layer);

    // The box is what the pointer hits over the image, and a drag moves the box, not the image.
    const marsh = page.locator('.react-flow__node[data-id="loc-marsh"]');
    const at = await center(marsh);
    expect(await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('.react-flow__node'), at)).toBe(true);
    const nodeBefore = (await marsh.boundingBox())!;
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    // Inward, so the canvas's edge auto-pan stays out of it.
    await page.mouse.move(at.x - 120, at.y - 60, { steps: 6 });
    await page.mouse.up();
    expect((await marsh.boundingBox())!.x).toBeLessThan(nodeBefore.x - 60);
    expect(await frameOf(layer)).toEqual(before);

    // A marquee that starts over the image selects the box it encloses.
    await zoomOut(page, 2);
    const harbor = (await page.locator('.react-flow__node[data-id="loc-harbor"]').boundingBox())!;
    await page.mouse.move(harbor.x + harbor.width + 20, harbor.y + harbor.height + 20);
    await page.mouse.down();
    await page.mouse.move(harbor.x - 10, harbor.y - 10, { steps: 6 });
    await page.mouse.up();
    await expect(page.locator('.react-flow__node[data-id="loc-harbor"]')).toHaveClass(/selected/);
    expect(await frameOf(layer)).toEqual(before);
  });

  test('the Replace card is the gallery: reorder, remove one step at a time, and a fresh first image', async ({ page }) => {
    await openApp(page);
    const slot0 = `data:image/png;base64,${(await pngBytes(page, 300, 200)).toString('base64')}`;
    const slot1 = `data:image/png;base64,${(await pngBytes(page, 200, 300)).toString('base64')}`;
    await openCanvas(page, world('e2e-map-gallery', {
      mapBackground: { images: [{ data: slot0 }, { data: slot1 }], frame: { x: -200, y: -200, width: 1200, height: 800 }, opacity: 0.5 },
    }));
    const layer = page.locator('[data-map-background]');
    const card = page.locator('[data-map-background-panel="set"]');
    await paneMenu(page);
    await page.getByRole('menuitem', { name: 'Replace Background Image…' }).click();
    // The menu animates out over the card; a press before it goes lands on the menu.
    await expect(page.locator('[role="menu"]')).toHaveCount(0);
    await expect(card.getByRole('button', { name: 'Primary image' })).toBeVisible();
    await expect(card.getByRole('button', { name: 'Image 2' })).toBeVisible();

    // Image 2 dragged to the front becomes slot 0, which the canvas draws.
    const tile2 = await center(card.getByRole('button', { name: 'Image 2' }));
    const tile1 = await center(card.getByRole('button', { name: 'Primary image' }));
    await page.mouse.move(tile2.x, tile2.y);
    await page.mouse.down();
    // Past the activation distance first, then onto the primary, so dnd-kit has seen the drag start.
    await page.mouse.move(tile2.x - 12, tile2.y, { steps: 3 });
    await page.mouse.move(tile1.x - 10, tile1.y, { steps: 10 });
    await page.mouse.move(tile1.x - 12, tile1.y);
    await page.mouse.up();
    await expect(layer.locator('img')).toHaveAttribute('src', slot1);

    // The x removes the framed image as one step; undo brings it back.
    await card.getByRole('button', { name: 'Primary image' }).click();
    await card.getByRole('button', { name: 'Remove image' }).click();
    await expect(layer.locator('img')).toHaveAttribute('src', slot0);
    await expect(card.getByRole('button', { name: 'Image 2' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Undo' }).first().click();
    await expect(layer.locator('img')).toHaveAttribute('src', slot1);

    // Removing both takes the frame and opacity with the last image (Q77).
    for (let i = 0; i < 2; i++) {
      await card.getByRole('button', { name: 'Primary image' }).click();
      await card.getByRole('button', { name: 'Remove image' }).click();
    }
    await expect(layer).toHaveCount(0);
    await expect(card).toHaveText(/Set Background Image/);

    // The next upload lands at the canvas default: covering the locations, at full opacity, in Adjust.
    await card.locator('#image-upload-canvas-map-background').setInputFiles({
      name: 'map.png', mimeType: 'image/png', buffer: await pngBytes(page, 400, 100),
    });
    await page.getByRole('button', { name: 'Keep original' }).click();
    await expect(layer).toHaveAttribute('data-map-background', 'adjust');
    const placed = await frameOf(layer);
    expect(placed.height).toBeCloseTo(312, 0);
    expect(placed.x).toBeLessThanOrEqual(0);
    expect(await layer.locator('img').evaluate((img) => Number((img as HTMLElement).style.opacity))).toBe(1);
  });

  test('Adjust draws the boxes above the map, sends every press to the map, and gives the boxes back after', async ({ page }) => {
    await openApp(page, { 'vite-ui-theme': 'dark' });
    const art = `data:image/png;base64,${(await pngBytes(page, 400, 200)).toString('base64')}`;
    // The nw corner sits under Harbor's box (180 × 52 at the origin), and Marsh sits on the image with an
    // arrow down to Reef.
    await openCanvas(page, {
      ...world('e2e-map-adjust-boxes', {
        mapBackground: { images: [{ data: art }], frame: { x: 90, y: 26, width: 800, height: 400 }, opacity: 0.8 },
      }),
      locations: [...LOCATIONS, { id: 'loc-reef', name: 'Reef', canvasPosition: { x: 640, y: 380 } }],
      connections: [{ id: 'conn-marsh-reef', a: 'loc-marsh', b: 'loc-reef', aToB: {} }],
    });
    const layer = page.locator('[data-map-background]');
    const marsh = page.locator('.react-flow__node[data-id="loc-marsh"]');
    const harbor = page.locator('.react-flow__node[data-id="loc-harbor"]');
    // A selection made before Adjust stays put through it.
    await harbor.click();
    await expect(harbor).toHaveClass(/selected/);
    const harborFrom = (await harbor.boundingBox())!;
    await paneMenu(page);
    await page.getByRole('menuitemcheckbox', { name: 'Adjust Background' }).click();
    await expect(layer).toHaveAttribute('data-map-background', 'adjust');
    // A checkbox row leaves the menu open.
    await page.keyboard.press('Escape');
    await expect(page.locator('[role="menu"]')).toHaveCount(0);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Control+a');
    expect((await harbor.boundingBox())!.x).toBeCloseTo(harborFrom.x, 0);
    await expect(marsh).not.toHaveClass(/selected/);
    expect(await page.evaluate(() => String(window.getSelection()))).toBe('');

    // The image paints under the boxes, arrows and handles, all in the viewport's one stacking context.
    const z = (el: Locator) => el.first().evaluate((e) => getComputedStyle(e).zIndex);
    expect(await z(layer)).toBe('-1');
    expect(await z(page.locator('[data-map-background-handles]'))).toBe('2000');
    expect(Number(await z(marsh))).toBeGreaterThanOrEqual(0);
    const arrow = page.locator('.react-flow__edges svg', { has: page.locator('.react-flow__edge') });
    expect(['auto', '0']).toContain(await z(arrow));
    expect(await marsh.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');

    mkdirSync('.scratch/frames', { recursive: true });
    await page.screenshot({ path: '.scratch/frames/map-background-adjust-boxes-dark.png' });

    // The nw handle, under Harbor, is what the pointer finds there, and it resizes.
    const before = await frameOf(layer);
    const corner = await center(page.locator('[data-map-corner="nw"]'));
    expect(await harbor.boundingBox().then((b) => b!.x <= corner.x && corner.x <= b!.x + b!.width && b!.y <= corner.y && corner.y <= b!.y + b!.height)).toBe(true);
    expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.getAttribute('data-map-corner'), corner)).toBe('nw');
    await page.mouse.move(corner.x, corner.y);
    await page.mouse.down();
    await page.mouse.move(corner.x + 40, corner.y + 20, { steps: 5 });
    await page.mouse.up();
    const resized = await frameOf(layer);
    expect(resized.width).toBeLessThan(before.width);
    expect(resized.x + resized.width).toBeCloseTo(before.x + before.width, 1);

    // A press on Marsh moves the image, not the box, and selects nothing.
    const marshBox = (await marsh.boundingBox())!;
    const at = await center(marsh);
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await page.mouse.move(at.x - 60, at.y + 30, { steps: 5 });
    await page.mouse.up();
    const moved = await frameOf(layer);
    expect(moved.x).toBeLessThan(resized.x);
    expect(moved.width).toBeCloseTo(resized.width, 3);
    expect((await marsh.boundingBox())!.x).toBeCloseTo(marshBox.x, 0);
    await expect(marsh).not.toHaveClass(/selected/);

    // Stop Adjusting: the box drags, the marquee selects, and a Connection draws, all over the image.
    await page.getByRole('button', { name: 'Stop Adjusting' }).click();
    await expect(layer).toHaveAttribute('data-map-background', 'locked');
    const locked = await frameOf(layer);
    const from = await center(marsh);
    const marshFrom = (await marsh.boundingBox())!;
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x - 80, from.y - 40, { steps: 6 });
    await page.mouse.up();
    expect((await marsh.boundingBox())!.x).toBeLessThan(marshFrom.x - 40);
    expect(await frameOf(layer)).toEqual(locked);

    // The drag made Marsh the selection, so the marquee is what selects Harbor.
    await expect(harbor).not.toHaveClass(/selected/);
    const h = (await harbor.boundingBox())!;
    await page.mouse.move(h.x + h.width + 20, h.y + h.height + 20);
    await page.mouse.down();
    await page.mouse.move(h.x - 10, h.y - 10, { steps: 6 });
    await page.mouse.up();
    await expect(harbor).toHaveClass(/selected/);
    await page.keyboard.press('Escape');

    const edges = page.locator('.react-flow__edge');
    const edgesBefore = await edges.count();
    await harbor.hover();
    const grip = await center(harbor.locator('.react-flow__handle.source'));
    const target = await center(marsh);
    await page.mouse.move(grip.x, grip.y);
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 8 });
    await page.mouse.up();
    await expect.poll(() => edges.count()).toBeGreaterThan(edgesBefore);
    expect(await frameOf(layer)).toEqual(locked);
  });

  test("the player's Map draws the background behind its boxes", async ({ page }) => {
    await openApp(page, { 'vite-ui-theme': 'light', FORMAMORPH_travelView: 'map' });
    await gotoDev(page, 'gameViewer', { fixture: 'mapBackground', modal: 'location' });
    // The spec's endpoint is never contacted, so the game asks about it over the Map.
    await page.getByRole('button', { name: 'Continue anyway' }).click({ timeout: 20_000 });
    const mapTab = page.getByRole('tab', { name: 'Map' });
    if (await mapTab.isVisible()) await mapTab.click();
    const layer = page.locator('[data-map-background]');
    await expect(layer).toHaveAttribute('data-map-background', 'locked');
    expect(await frameOf(layer)).toEqual({ x: -120, y: -80, width: 780, height: 455 });
    expect(await layer.locator('img').evaluate((img) => (img as HTMLElement).style.opacity)).toBe('0.85');

    // Read once the dialog's open animation has settled, so the box is where the pointer would find it.
    const corridor = page.locator('.react-flow__node', { hasText: 'Corridor' });
    await expect.poll(async () => {
      const at = await center(corridor);
      return page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('.react-flow__node')?.textContent, at);
    }).toContain('Corridor');

    mkdirSync('.scratch/frames', { recursive: true });
    await page.screenshot({ path: '.scratch/frames/map-background-map-light.png' });
  });
});
