import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { openApp } from './app';
import { FOREGROUND_DURATION } from '../src/components/game/weatherForegroundEffects';

/**
 * The Weather Foreground in a real browser, sampled every animation frame: each effect starts, ends within
 * its length, a second change replaces the first, Storm flashes under three times a second, and input still
 * reaches the game. `WEATHER_FRAMES=1` also stores a mid-play frame of each kind in `.scratch/frames/`.
 */

type Kind = keyof typeof FOREGROUND_DURATION;
const KINDS = Object.keys(FOREGROUND_DURATION) as Kind[];
/** One frame at 60 frames per second, plus a little for timer jitter. */
const FRAME = 1 / 60 + 0.002;

interface Sample { t: number; kind: string | null; count: number; light: number }

async function openWhiteRoom(page: Page, theme: 'light' | 'dark' = 'light') {
  page.on('pageerror', (error) => console.error(error.message));
  // At noon: the fixture's clock reads midnight, when Bright Sun never shows.
  const save = JSON.parse(readFileSync('src/lib/devFixtures/whiteRoomSave.json', 'utf8'));
  save.currentState.gameTime = 4;
  await page.route('**/whiteRoomSave.json*', (route) => route.fulfill({
    contentType: 'application/javascript', body: `export default ${JSON.stringify(save)}`,
  }));
  // The fixture opens on page one, so the AI answers with one short line and no weather.
  await page.route('**/api/v0/models', (route) => route.fulfill({ status: 404 }));
  await page.route('**/v1/models', (route) => route.fulfill({ json: { data: [{ id: 'e2e-model' }] } }));
  await page.route('**/chat/completions', (route) => route.fulfill({ contentType: 'text/event-stream', body:
    `data: ${JSON.stringify({ choices: [{ delta: { content: 'The room is quiet.' }, finish_reason: null }] })}\n\ndata: [DONE]\n\n` }));
  await openApp(page, {
    'vite-ui-theme': theme,
    FORMAMORPH_endpointUrl: 'http://127.0.0.1:5190/v1/chat/completions',
    FORMAMORPH_thinkingMode: 'off', FORMAMORPH_choicesEnabled: false,
    FORMAMORPH_locationChangeEnabled: false, FORMAMORPH_memoryDigests: false, FORMAMORPH_aiClock: false,
  }, { url: '/#dev?view=gameViewer&fixture=whiteRoom' });
  await page.waitForFunction(() => typeof (window as unknown as { __fmDev: Record<string, unknown> }).__fmDev.fireWeather === 'function');
  // Clear has no effect, so every kind fired after it is a change.
  await fire(page, 'clear');
}

const fire = (page: Page, kind: Kind | 'clear') =>
  page.evaluate((k) => (window as unknown as { __fmDev: { fireWeather(k: string): void } }).__fmDev.fireWeather(k), kind);

/** Starts sampling every frame: which effect shows, how many canvases, and the alpha at a corner pixel. */
const startSampling = (page: Page) => page.evaluate(() => {
  const samples: Sample[] = [];
  const t0 = performance.now();
  (window as unknown as { __fgSamples: Sample[] }).__fgSamples = samples;
  const tick = (now: number) => {
    const canvases = document.querySelectorAll<HTMLCanvasElement>('[data-testid="weather-foreground"]');
    const canvas = canvases[0];
    let light = 0;
    if (canvas && canvas.width) {
      const px = canvas.getContext('2d')?.getImageData(4, 4, 1, 1).data;
      light = px ? px[3] / 255 : 0;
    }
    samples.push({ t: (now - t0) / 1000, kind: canvas?.dataset.weatherKind ?? null, count: canvases.length, light });
    if (now - t0 < 7000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

const readSamples = (page: Page) => page.evaluate(() => (window as unknown as { __fgSamples: Sample[] }).__fgSamples);

/** Seconds from the first frame showing `kind` to the last one. */
function span(samples: Sample[], kind: string) {
  const shown = samples.filter((s) => s.kind === kind);
  return { from: shown[0]?.t ?? NaN, to: shown.at(-1)?.t ?? NaN };
}

test.describe('the Weather Foreground', () => {
  for (const kind of KINDS) {
    test(`${kind} starts at once and ends within its length`, async ({ page }) => {
      await openWhiteRoom(page);
      await startSampling(page);
      await fire(page, kind);
      await page.waitForTimeout((FOREGROUND_DURATION[kind] + 0.8) * 1000);
      const samples = await readSamples(page);
      const { from, to } = span(samples, kind);
      expect(from).toBeLessThan(0.3);
      // It plays close to its full length, and is gone by the end of it. The canvas mounts a frame before
      // its clock starts, and React removes the cleared canvas up to three frames after its last draw.
      expect(to - from).toBeGreaterThan(FOREGROUND_DURATION[kind] - 0.3);
      expect(to - from).toBeLessThanOrEqual(FOREGROUND_DURATION[kind] + FRAME * 4);
      expect(samples.at(-1)?.count).toBe(0);
    });
  }

  test('a second change replaces the first', async ({ page }) => {
    await openWhiteRoom(page);
    await startSampling(page);
    await fire(page, 'rain');
    await page.waitForTimeout(1000);
    await fire(page, 'snow');
    await page.waitForTimeout((FOREGROUND_DURATION.snow + 0.8) * 1000);
    const samples = await readSamples(page);
    expect(Math.max(...samples.map((s) => s.count))).toBe(1);
    const rain = span(samples, 'rain');
    const snow = span(samples, 'snow');
    expect(rain.to).toBeLessThan(snow.from);
    expect(rain.to - rain.from).toBeLessThan(1.3);
    expect(snow.to - snow.from).toBeGreaterThan(FOREGROUND_DURATION.snow - 0.3);
    expect(samples.at(-1)?.count).toBe(0);
  });

  test('Storm flashes under three times in any one second', async ({ page }) => {
    await openWhiteRoom(page);
    await startSampling(page);
    await fire(page, 'storm');
    await page.waitForTimeout((FOREGROUND_DURATION.storm + 0.5) * 1000);
    const samples = (await readSamples(page)).filter((s) => s.kind === 'storm');
    const starts: number[] = [];
    samples.forEach((s, i) => { if (s.light > 0.05 && (samples[i - 1]?.light ?? 0) <= 0.05) starts.push(s.t); });
    expect(starts.length).toBeGreaterThan(0);
    for (const start of starts) expect(starts.filter((t) => t >= start && t < start + 1).length).toBeLessThan(3);
  });

  test('clicks and typing reach the game while an effect plays', async ({ page }) => {
    await openWhiteRoom(page);
    await fire(page, 'rain');
    await expect(page.getByTestId('weather-foreground')).toBeVisible();
    const box = page.getByPlaceholder(/Type your action/);
    // A real click: Playwright refuses one that another element would catch.
    await box.click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('look around');
    await expect(box).toHaveValue('look around');
    await expect(page.getByTestId('weather-foreground')).toBeVisible();
  });

  test('plays nothing with OS reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openWhiteRoom(page);
    await startSampling(page);
    await fire(page, 'storm');
    await page.waitForTimeout(800);
    expect((await readSamples(page)).every((s) => s.count === 0)).toBe(true);
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`stores a mid-play frame of each kind, ${theme}`, async ({ page }, info) => {
      test.skip(!process.env.WEATHER_FRAMES, 'Set WEATHER_FRAMES=1 to store frames.');
      mkdirSync('.scratch/frames', { recursive: true });
      const suffix = info.project.name === 'mobile' ? '-mobile' : '';
      // A held clock, so each frame lands at a set moment of its effect.
      await page.clock.install();
      await openWhiteRoom(page, theme);
      for (const kind of KINDS) {
        await page.clock.pauseAt(Date.now() + 60_000 * (KINDS.indexOf(kind) + 1));
        await fire(page, kind);
        await page.clock.runFor(16);
        // Storm's one flash peaks just after it starts; the others are fullest near the middle.
        await page.clock.runFor(kind === 'storm' ? 200 : FOREGROUND_DURATION[kind] * 400);
        await page.screenshot({ path: `.scratch/frames/weather-fg-${kind}-${theme}${suffix}.png` });
        await fire(page, 'clear');
        await page.clock.resume();
      }
    });
  }
});
