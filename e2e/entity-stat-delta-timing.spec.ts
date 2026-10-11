import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openApp } from './app';

/** One painted frame of a stat row: its chip's class and opacity, and its band's class and horizontal scale. */
interface RowFrame { t: number; chip: string | null; chipOpacity: number; band: string | null; bandScale: number }
interface Frames { player: RowFrame[]; entity: RowFrame[] }

/** The whiteRoom world with Bram, whose Trust regenerates 5 a turn, and Coin moved only by the AI. */
async function serveBram(page: Page) {
  for (const kind of ['World', 'Save'] as const) {
    const fixture = JSON.parse(readFileSync(`src/lib/devFixtures/whiteRoom${kind}.json`, 'utf8'));
    if (kind === 'World') {
      fixture.entities.push({
        id: 'bram', name: 'Bram', inGameDescription: '', detailedDescription: 'A dock hand.', type: '', image: null, sound: null,
        model: null, stats: [{
          id: 'stat-trust', name: 'Trust', type: 'number', description: 'How far Bram trusts you.', min: 0, max: 100,
          starting: 40, value: 40, regen: 5, code: '', descriptors: [],
        }],
      });
    } else {
      fixture.currentState.visibleEntities = [{ name: 'Bram', revealed: true }];
    }
    await page.route(`**/whiteRoom${kind}.json*`, (route) => route.fulfill({
      contentType: 'application/javascript', body: `export default ${JSON.stringify(fixture)}`,
    }));
  }
  await page.route('**/api/v0/models', (route) => route.fulfill({ status: 404 }));
  await page.route('**/v1/models', (route) => route.fulfill({ json: { data: [{ id: 'e2e-model' }] } }));
  await page.route('**/chat/completions', async (route) => {
    const system = route.request().postDataJSON().messages
      .find((message: { role: string }) => message.role === 'system')?.content ?? '';
    const text = system.includes('stat tracker') ? 'Coin: +20' : 'You count the coins while Bram watches.';
    await route.fulfill({ contentType: 'text/event-stream', body:
      `data: ${JSON.stringify({ choices: [{ delta: { content: text }, finish_reason: null }] })}\n\ndata: [DONE]\n\n` });
  });
}

/** Start sampling the Coin row and Bram's Trust row every painted frame, for `ms`. */
async function sample(page: Page, ms: number) {
  await page.evaluate((duration) => {
    const read = (row: Element | undefined) => {
      const chip = row?.querySelector('[class*="stat-delta-text"]') ?? null;
      const band = row?.querySelector('[class*="stat-delta-grow"], [class*="stat-delta-drain"]') ?? null;
      const transform = band ? getComputedStyle(band).transform : 'none';
      return {
        t: performance.now(),
        chip: chip?.className ?? null,
        chipOpacity: chip ? Number(getComputedStyle(chip).opacity) : 0,
        band: band?.className ?? null,
        bandScale: transform === 'none' ? 1 : new DOMMatrix(transform).a,
      };
    };
    const rowNamed = (root: ParentNode, name: string) => [...root.querySelectorAll('div.mb-2')]
      .find((row) => row.querySelector(':scope > div > span')?.textContent === name);
    const frames = { player: [] as unknown[], entity: [] as unknown[] };
    (window as unknown as { __rowFrames: Promise<unknown> }).__rowFrames = new Promise((resolve) => {
      const start = performance.now();
      const tick = () => {
        const section = document.querySelector('[data-testid="entity-stats"]');
        frames.player.push(read(rowNamed(document, 'Coin')));
        frames.entity.push(read(section ? rowNamed(section, 'Trust') : undefined));
        if (performance.now() - start < duration) requestAnimationFrame(tick); else resolve(frames);
      };
      requestAnimationFrame(tick);
    });
  }, ms);
}
const frames = (page: Page) => page.evaluate(() => (window as unknown as { __rowFrames: Promise<Frames> }).__rowFrames);
const runTurn = (page: Page) => page.evaluate(() => (window as unknown as { __baseline: { runScript(actions: string[]): Promise<void> } })
  .__baseline.runScript(['Count the coins.']));
/** When a chip was last painted, or -1. */
const lastChip = (rows: RowFrame[]) => rows.reduce((at, frame) => (frame.chip ? frame.t : at), -1);

test("entity rows take the player's chip fade, held band and drain", async ({ page }) => {
  test.setTimeout(90_000);
  page.on('pageerror', (error) => console.error(error.message));
  await serveBram(page);
  await openApp(page, {
    FORMAMORPH_endpointUrl: 'http://127.0.0.1:5190/v1/chat/completions',
    FORMAMORPH_thinkingMode: 'off', FORMAMORPH_choicesEnabled: false,
    FORMAMORPH_locationChangeEnabled: false, FORMAMORPH_memoryDigests: false, FORMAMORPH_aiClock: false,
  }, { url: '/#dev?view=gameViewer&fixture=whiteRoom' });
  if ((page.viewportSize()?.width ?? 1280) < 768) await page.getByRole('button', { name: 'Status', exact: true }).click();
  await page.getByRole('combobox', { name: 'Entity stats' }).click();
  await page.getByRole('option', { name: 'Bram' }).click();
  await expect(page.getByTestId('entity-stats').getByText(/40\s*\/\s*100/)).toBeVisible();
  await page.waitForFunction(() => '__baseline' in window);

  // Turn one: Coin +20 from the AI, Trust +5 from regen.
  await runTurn(page);
  await expect(page.getByTestId('entity-stats').getByText('+5')).toBeVisible();

  // Turn two, while turn one's chips are up: at the submit, both chips fade and both bands collapse.
  await sample(page, 1_200);
  await runTurn(page);
  const drained = await frames(page);
  for (const rows of [drained.player, drained.entity]) {
    const fading = rows.filter((f) => f.chip?.includes('stat-delta-text-out'));
    expect(fading.length).toBeGreaterThan(3);
    expect(fading[0].chipOpacity).toBeGreaterThan(fading[fading.length - 1].chipOpacity);
    const draining = rows.filter((f) => f.band?.includes('stat-delta-drain'));
    expect(draining.length).toBeGreaterThan(3);
    expect(Math.min(...draining.map((f) => f.bandScale))).toBeLessThan(0.5);
    // The collapse never restarts: each painted frame is at most as wide as the one before.
    expect(draining.every((f, i) => i === 0 || f.bandScale <= draining[i - 1].bandScale + 0.001)).toBe(true);
  }

  // Turn two's chips time out together after 10 s.
  await sample(page, 11_000);
  const held = await frames(page);
  expect(held.entity.some((f) => f.chip?.includes('stat-delta-text') && f.chipOpacity > 0.9)).toBe(true);
  expect(held.player.some((f) => f.chip?.includes('stat-delta-text') && f.chipOpacity > 0.9)).toBe(true);
  const playerGone = lastChip(held.player);
  const entityGone = lastChip(held.entity);
  expect(playerGone).toBeGreaterThan(0);
  expect(entityGone).toBeLessThan(held.entity[held.entity.length - 1].t);
  expect(Math.abs(entityGone - playerGone)).toBeLessThan(100);
  // The band stays after the chip, at full width, until the next turn.
  const settled = held.entity[held.entity.length - 1];
  expect(settled.band).toContain('stat-delta-grow');
  expect(settled.bandScale).toBeCloseTo(1, 2);
});
