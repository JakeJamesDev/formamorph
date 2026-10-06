// World Editor speed harness. `npm run profile:editor-speed` builds an unminified production bundle into
// testing/editor-speed/.build, serves it with a generated large world, and measures the editor on that world
// under CPU throttle: open, typing, Locations canvas, tree drag and save. Not part of the four gates.
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const BUILD = path.join(HERE, '.build');
const OUT = path.join(HERE, '.out', 'results.json');
const WORLD = process.env.EDITOR_SPEED_WORLD ?? path.join(HERE, '.out', 'large-world-400e-300l.json');
const THROTTLES = (process.env.EDITOR_SPEED_THROTTLE ?? '6').split(',').map(Number);
const ONLY = process.env.EDITOR_SPEED_ONLY?.split(',');
const HEADED = !!process.env.EDITOR_SPEED_HEADED;
const BLOCK_US = 50_000;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp' };
const WORLD_ID = 'editor-speed-world';

function build() {
  if (process.env.EDITOR_SPEED_SKIP_BUILD) return;
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const r = spawnSync(npx, ['vite', 'build', '--outDir', BUILD, '--emptyOutDir', '--minify', 'false'], { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) throw new Error(`build failed (${r.status})`);
}

function generateWorld() {
  if (existsSync(WORLD)) return;
  const r = spawnSync(process.execPath, [path.join(HERE, 'genLargeWorld.mjs')], { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`world generation failed (${r.status})`);
}

function serve() {
  const server = createServer(async (req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (rel === '/__bench/world.json') {
      res.writeHead(200, { 'content-type': 'application/json' });
      createReadStream(WORLD).pipe(res);
      return;
    }
    let file = path.join(BUILD, rel);
    if (!file.startsWith(BUILD)) { res.writeHead(403).end(); return; }
    try { if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html'); } catch { file = path.join(BUILD, 'index.html'); }
    try {
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
      res.end(await readFile(file));
    } catch { res.writeHead(404).end(); }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const SEED = {
  FORMAMORPH_introSeen: 'true',
  FORMAMORPH_useCustomEndpoint: 'true',
  FORMAMORPH_endpointUrl: 'http://127.0.0.1:9/v1/chat/completions',
  FORMAMORPH_apiToken: 'harness',
  FORMAMORPH_modelName: 'harness-model',
  'formamorph.worldEditorMode': 'advanced',
  FORMAMORPH_ageGate: JSON.stringify({ accepted: true, acceptanceVersion: 1, acceptedAt: '2026-01-01T00:00:00.000Z' }),
};

/** Main-thread blocks over 50 ms between two user-timing marks. */
function blocksBetween(events, start, end) {
  const main = new Map();
  for (const e of events) if (e.ph === 'M' && e.name === 'thread_name' && e.args?.name === 'CrRendererMain') main.set(e.pid, e.tid);
  const mark = (name) => events.find((e) => e.cat?.includes('blink.user_timing') && e.name === name)?.ts;
  const t0 = mark(start), t1 = mark(end);
  if (t0 === undefined || t1 === undefined) throw new Error(`trace is missing ${start}/${end}`);
  const blocks = events
    .filter((e) => e.ph === 'X' && e.name === 'RunTask' && main.get(e.pid) === e.tid && e.dur > BLOCK_US && e.ts + e.dur > t0 && e.ts < t1)
    .map((e) => e.dur / 1000);
  return {
    blocks: blocks.length,
    blockMs: Math.round(blocks.reduce((a, b) => a + b, 0)),
    maxBlockMs: Math.round(Math.max(0, ...blocks)),
  };
}

/** Run `body` inside a trace and return its block numbers beside whatever `body` returns. */
async function traced(page, cdp, body) {
  const events = [];
  const onData = (m) => events.push(...m.value);
  cdp.on('Tracing.dataCollected', onData);
  const done = new Promise((r) => cdp.once('Tracing.tracingComplete', r));
  await cdp.send('Tracing.start', {
    traceConfig: { includedCategories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'blink.user_timing'] },
    transferMode: 'ReportEvents',
  });
  await page.evaluate(() => performance.mark('step-start'));
  const extra = await body();
  await page.evaluate(() => performance.mark('step-end'));
  await cdp.send('Tracing.end');
  await done;
  cdp.off('Tracing.dataCollected', onData);
  return { ...extra, ...blocksBetween(events, 'step-start', 'step-end') };
}

/** Resolve once the main thread has had no long task for `quietMs`. */
const settle = (page, quietMs = 1000) => page.waitForFunction((q) => performance.now() - window.__bench.lastLong > q, quietMs, { timeout: 180_000, polling: 100 });

const heapMb = async (cdp) => {
  await cdp.send('HeapProfiler.collectGarbage');
  const { usedSize } = await cdp.send('Runtime.getHeapUsage');
  return Math.round(usedSize / 1e6);
};

/** Write the bench world straight into the library store, the way an import leaves it. */
async function seedWorld(page) {
  await page.evaluate(async (id) => {
    const world = await (await fetch('/__bench/world.json')).json();
    world.id = id;
    const db = await new Promise((resolve, reject) => {
      const q = indexedDB.open('worldsDB', 1);
      q.onupgradeneeded = () => q.result.createObjectStore('worlds', { keyPath: 'id' });
      q.onsuccess = () => resolve(q.result);
      q.onerror = () => reject(q.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction('worlds', 'readwrite');
      const now = new Date().toISOString();
      const o = world.worldOverview;
      tx.objectStore('worlds').put({ id, name: o.name, description: o.description, author: o.author, thumbnail: o.thumbnail, dirty: false, createdAt: now, lastAccessed: now, data: world });
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
    db.close();
  }, WORLD_ID);
}

async function installObservers(page) {
  await page.addInitScript(() => {
    window.__bench = { lastLong: 0, events: [] };
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__bench.lastLong = e.startTime + e.duration; }).observe({ type: 'longtask', buffered: true });
    // Event Timing: input to the next paint, for every keystroke and pointer event over 16 ms.
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__bench.events.push({ name: e.name, duration: e.duration }); }).observe({ type: 'event', durationThreshold: 16, buffered: true });
  });
}

const pct = (xs, p) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]);
};

/** Frame intervals painted while `body` runs, from a rAF loop. */
async function framed(page, body) {
  await page.evaluate(() => {
    window.__frames = [];
    let last = performance.now();
    const tick = (t) => { window.__frames.push(t - last); last = t; if (window.__frames) window.__frameLoop = requestAnimationFrame(tick); };
    window.__frameLoop = requestAnimationFrame(tick);
  });
  await body();
  const frames = await page.evaluate(() => { cancelAnimationFrame(window.__frameLoop); const f = window.__frames; window.__frames = null; return f; });
  return { frames: frames.length, frameP50: pct(frames, 50), frameP95: pct(frames, 95), frameMax: pct(frames, 100), over100ms: frames.filter((f) => f > 100).length };
}

const STEPS = {
  async open({ page, cdp }) {
    await page.getByText('Large Bench World', { exact: false }).first().click();
    const edit = page.getByRole('button', { name: 'Edit World' });
    await edit.waitFor({ timeout: 60_000 });
    await settle(page);
    return traced(page, cdp, async () => {
      const t0 = Date.now();
      await edit.click();
      await page.getByRole('tab', { name: 'Entities' }).first().waitFor({ timeout: 180_000 });
      const visibleMs = Date.now() - t0;
      await settle(page, 1500);
      return { visibleMs, settledMs: Date.now() - t0 };
    });
  },

  async typing({ page, cdp }) {
    await page.getByRole('tab', { name: 'Entities' }).first().click();
    await settle(page);
    const panel = page.locator('[role="tabpanel"]');
    await panel.locator('div.cursor-pointer:has(span.cursor-grab)').nth(5).click();
    const field = panel.getByRole('textbox').nth(1);
    await field.waitFor({ timeout: 60_000 });
    await field.click();
    await page.keyboard.press('End');
    await settle(page);
    await page.evaluate(() => { window.__bench.events = []; });
    return traced(page, cdp, async () => {
      const t0 = Date.now();
      await page.keyboard.type(' the quick brown fox jumps', { delay: 120 });
      const typedMs = Date.now() - t0;
      await settle(page, 1500);
      if (!(await field.evaluate((el) => (el.value ?? el.textContent ?? '').includes('quick brown fox')))) throw new Error('typed text did not land in the field');
      const lat = await page.evaluate(() => window.__bench.events.filter((e) => /key|input|beforeinput/.test(e.name)).map((e) => e.duration));
      return { keys: 26, typedMs, settledMs: Date.now() - t0, slowEvents: lat.length, latP50: pct(lat, 50), latP95: pct(lat, 95), latMax: pct(lat, 100) };
    });
  },

  async treeDrag({ page, cdp }) {
    await page.getByRole('tab', { name: 'Entities' }).first().click();
    await settle(page);
    const grip = page.locator('[role="tabpanel"] div.cursor-pointer:has(span.cursor-grab) span.cursor-grab').nth(2);
    const box = await grip.boundingBox();
    if (!box) throw new Error('no tree grip');
    return traced(page, cdp, async () => framed(page, async () => {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      for (let i = 1; i <= 30; i++) await page.mouse.move(box.x + box.width / 2 + i, box.y + box.height / 2 + i * 8);
      await page.keyboard.press('Escape');
      await page.mouse.up();
      await settle(page);
    }));
  },

  async canvas({ page, cdp }) {
    await page.getByRole('tab', { name: 'Locations' }).first().click();
    await settle(page);
    const canvasTab = page.getByRole('tab', { name: 'Canvas' }).or(page.getByRole('radio', { name: 'Canvas' })).first();
    return traced(page, cdp, async () => {
      const t0 = Date.now();
      await canvasTab.click();
      await page.locator('.react-flow__node').first().waitFor({ timeout: 180_000 });
      const visibleMs = Date.now() - t0;
      await settle(page, 1500);
      const dom = await page.evaluate(() => ({
        nodes: document.querySelectorAll('.react-flow__node').length,
        edges: document.querySelectorAll('.react-flow__edge').length,
        domNodes: document.getElementsByTagName('*').length,
      }));
      return { visibleMs, settledMs: Date.now() - t0, ...dom };
    });
  },

  async canvasDrag({ page, cdp }) {
    const node = page.locator('.react-flow__node').nth(3);
    const box = await node.boundingBox();
    if (!box) throw new Error('no canvas node');
    return traced(page, cdp, async () => framed(page, async () => {
      await page.mouse.move(box.x + 10, box.y + 10);
      await page.mouse.down();
      for (let i = 1; i <= 30; i++) await page.mouse.move(box.x + 10 + i * 6, box.y + 10 + i * 4);
      await page.mouse.up();
      await page.keyboard.press('Control+z');
      await settle(page);
    }));
  },

  async save({ page, cdp }) {
    const save = page.getByRole('button', { name: /^Save( World)?$/ }).first();
    return traced(page, cdp, async () => {
      const t0 = Date.now();
      await save.click();
      await page.getByText(/saved/i).first().waitFor({ timeout: 180_000 });
      const savedMs = Date.now() - t0;
      await settle(page);
      return { savedMs };
    });
  },
};

async function runThrottle(browser, base, rate) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript((seed) => { for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); }, SEED);
  await context.route(/\/events(\/active)?(\?|$)/, (r) => r.fulfill({ json: { data: [] } }));
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error('pageerror:', e.message));
  page.on('crash', () => console.error('page crashed'));
  await installObservers(page);
  const cdp = await context.newCDPSession(page);
  await page.goto(base);
  await page.getByText('Loaded default worlds').waitFor({ timeout: 60_000 }).catch(() => {});
  await seedWorld(page);
  await page.goto(base);
  await page.getByText('Large Bench World', { exact: false }).first().waitFor({ timeout: 60_000 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  await settle(page, 2000);
  const results = { heapMenuMb: await heapMb(cdp) };
  for (const [name, step] of Object.entries(STEPS)) {
    if (ONLY && !ONLY.includes(name)) continue;
    try {
      results[name] = await step({ page, cdp });
    } catch (e) {
      results[name] = { error: String(e.message ?? e).split('\n')[0] };
      if (process.env.EDITOR_SPEED_SHOT) await page.screenshot({ path: path.join(HERE, '.out', `fail-${name}.png`) });
    }
    results[name].heapMb = await heapMb(cdp).catch(() => null);
    console.log(rate + 'x', name, JSON.stringify(results[name]));
  }
  await context.close();
  return results;
}

generateWorld();
build();
const server = await serve();
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ headless: !HEADED });
const report = { world: path.relative(ROOT, WORLD), when: new Date().toISOString(), runs: {} };
try {
  for (const rate of THROTTLES) report.runs[`${rate}x`] = await runThrottle(browser, base, rate);
} finally {
  await browser.close();
  server.close();
}
await writeFile(OUT, JSON.stringify(report, null, 2));
console.log(`Wrote ${path.relative(ROOT, OUT)}`);
