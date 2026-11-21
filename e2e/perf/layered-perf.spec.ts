import { test, type CDPSession, type Page } from '@playwright/test';
import { gotoDev, openApp } from '../app';

/**
 * Mobile frame times for a stacked Layered Image: an eight-Layer 1024x1536 rig (`layeredPerf`) against a plain-image
 * control, in play (settled, and while narration reveals) and in the editor preview (a Dissolve and a Jelly change).
 * Headless Chromium on a phone viewport at a CPU throttle. It is a proxy: software compositing is not a phone GPU.
 *
 *   $env:E2E_PERF = '1'; npx playwright test e2e/perf --project=desktop
 *
 * It prints one table per run and asserts nothing: the numbers go in the ticket. Off unless `E2E_PERF` is set, so
 * the normal e2e run skips it.
 */

const THROTTLE = Number(process.env.E2E_PERF_THROTTLE ?? 4);
const RUNS = Number(process.env.E2E_PERF_RUNS ?? 3);

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });

interface Stats { frames: number; p50: number; p95: number; max: number; over20: number; over33: number }

const SAMPLER = `
  window.__frames = [];
  window.__sampling = true;
  // A token per run, so a loop from the last run can never keep counting into this one.
  const run = (window.__run = (window.__run ?? 0) + 1);
  let last = performance.now();
  const tick = (now) => {
    if (window.__run !== run) return;
    window.__frames.push(now - last);
    last = now;
    if (window.__sampling) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
`;

const startSampling = (page: Page) => page.evaluate(SAMPLER);

async function stopSampling(page: Page): Promise<Stats> {
  const deltas = await page.evaluate(() => {
    const w = window as unknown as { __sampling: boolean; __frames: number[] };
    w.__sampling = false;
    return w.__frames.slice(1);
  });
  const sorted = [...deltas].sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 0;
  return {
    frames: deltas.length, p50: at(0.5), p95: at(0.95), max: sorted.at(-1) ?? 0,
    over20: deltas.filter((d) => d > 20).length, over33: deltas.filter((d) => d > 33).length,
  };
}

async function throttle(page: Page): Promise<CDPSession> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  await cdp.send('Performance.enable');
  return cdp;
}

async function heapMb(cdp: CDPSession): Promise<number> {
  const { metrics } = await cdp.send('Performance.getMetrics');
  return (metrics.find((m) => m.name === 'JSHeapUsedSize')?.value ?? 0) / 1048576;
}

const row = (label: string, s: Stats) =>
  `${label.padEnd(34)} frames ${String(s.frames).padStart(4)}  p50 ${s.p50.toFixed(1).padStart(5)}  p95 ${s.p95.toFixed(1).padStart(5)}  max ${s.max.toFixed(1).padStart(6)}  >20ms ${String(s.over20).padStart(3)}  >33ms ${String(s.over33).padStart(3)}`;

const NARRATION = Array.from({ length: 6 }, (_, i) => `The corridor bends and the lamplight wavers as you walk, sentence ${i + 1} of a long reply that the page reveals a piece at a time while it scrolls.`).join(' ');

async function mockModel(page: Page) {
  await page.route('**/api/v0/models', (route) => route.fulfill({ status: 404 }));
  await page.route('**/v1/models', (route) => route.fulfill({ json: { data: [{ id: 'e2e-model' }] } }));
  await page.route('**/chat/completions', (route) => route.fulfill({
    contentType: 'text/event-stream',
    body: `data: ${JSON.stringify({ choices: [{ delta: { content: NARRATION }, finish_reason: null }] })}\n\ndata: [DONE]\n\n`,
  }));
}

const SETTINGS = {
  FORMAMORPH_endpointUrl: 'http://127.0.0.1:5190/v1/chat/completions',
  FORMAMORPH_thinkingMode: 'off', FORMAMORPH_choicesEnabled: false,
  FORMAMORPH_locationChangeEnabled: false, FORMAMORPH_memoryDigests: false, FORMAMORPH_aiClock: false,
};

/** Frame times for one scenario in play, on `fixture`: settled for `settleMs`, then while one narration reveals. */
async function playRun(page: Page, fixture: string, settleMs: number): Promise<{ settled: Stats; streaming: Stats; heap: number; drawn: number }> {
  await mockModel(page);
  await openApp(page, SETTINGS, { url: `/#dev?view=gameViewer&fixture=${fixture}` });
  await page.waitForFunction(() => '__baseline' in window);
  await page.waitForTimeout(3000);
  const cdp = await throttle(page);
  const drawn = await page.evaluate(() => document.querySelectorAll('[data-layer]').length);
  await startSampling(page);
  await page.waitForTimeout(settleMs);
  const settled = await stopSampling(page);
  await startSampling(page);
  await page.evaluate(() => (window as unknown as { __baseline: { runScript(a: string[]): Promise<void> } }).__baseline.runScript(['I walk on.']));
  const streaming = await stopSampling(page);
  return { settled, streaming, heap: await heapMb(cdp), drawn };
}

test.describe('Layered Image mobile performance', () => {
  // eslint-disable-next-line no-empty-pattern -- Playwright requires a destructuring first argument.
  test.beforeEach(({}, testInfo) => {
    test.skip(!process.env.E2E_PERF, 'A measurement, not a check: set E2E_PERF=1');
    test.skip(testInfo.project.name !== 'desktop', 'The probe sets its own phone profile');
  });

  for (const [fixture, label] of [['whiteRoom', 'control (plain images)'], ['layeredPerf', 'eight-Layer rig']] as const) {
    test(`play: ${label}`, async ({ page }) => {
      test.setTimeout(240_000);
      const lines: string[] = [];
      for (let i = 0; i < RUNS; i++) {
        const fresh = i === 0 ? page : await page.context().newPage();
        const r = await playRun(fresh, fixture, 3000);
        lines.push(row(`${label} settled #${i + 1}`, r.settled), row(`${label} narration #${i + 1}`, r.streaming), `  Layer elements drawn: ${r.drawn}; JS heap ${r.heap.toFixed(0)} MB`);
        if (i > 0) await fresh.close();
      }
      console.log(`\n[${THROTTLE}x CPU, 390x844 @3x]\n${lines.join('\n')}`);
    });
  }

  test('editor preview: a Dissolve change and a Jelly change on the rig', async ({ page }) => {
    test.setTimeout(240_000);
    await openApp(page);
    await gotoDev(page, 'mainMenu', { modal: 'layeredEditor', tab: 'media', fixture: 'layeredPerf' });
    await page.waitForSelector('[data-layered-preview] [data-layer-stack], [data-layer-stack]', { timeout: 60_000 });
    await page.waitForTimeout(3000);
    const cdp = await throttle(page);
    const lines: string[] = [];
    const play = page.getByRole('button', { name: 'Play' });
    // The Face Layer is the one with two Variants; select it by its name where a list shows it.
    await page.getByRole('button', { name: /^Face/ }).first().click();
    await page.getByRole('tab', { name: 'Motion' }).click();
    // Both Face Variants decode once before sampling, so the runs measure the change, not the first decode.
    for (let i = 0; i < 2; i++) {
      await play.click();
      await page.waitForTimeout(1400);
    }
    // On a phone the mode is a select; a new Layer is Dissolve.
    for (const mode of ['Dissolve', 'Jelly']) {
      if (mode === 'Jelly') {
        await page.getByRole('combobox', { name: 'Transition' }).click();
        await page.getByRole('option', { name: 'Jelly' }).click();
      }
      for (let i = 0; i < RUNS; i++) {
        await startSampling(page);
        await play.click();
        await page.waitForTimeout(1400);
        lines.push(row(`${mode} change #${i + 1}`, await stopSampling(page)));
      }
    }
    console.log(`\n[${THROTTLE}x CPU, 390x844 @3x] editor preview\n${lines.join('\n')}\nJS heap ${(await heapMb(cdp)).toFixed(0)} MB\nDecoded images by arithmetic: ${(8 * 1024 * 1536 * 4 / 1048576 + 1024 * 1536 * 4 / 1048576).toFixed(0)} MB (8 Layers + the second Face Variant)`);
  });
});
