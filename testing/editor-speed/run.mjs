// World Editor speed harness. `npm run profile:editor-speed` builds an unminified production bundle into
// testing/editor-speed/.build, serves it with a generated large world, and measures the editor on that world
// under CPU throttle: open, typing, Locations canvas, tree drag, save, and a bare IndexedDB round trip of the
// world. Not part of the four gates.
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { analyze, loadSnapshot, summarize } from './heapRetainers.mjs';
import { pinSteps } from './pinSteps.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const BUILD = path.join(HERE, '.build');
// `bench`: default worlds plus the bench world. `defaults`: default worlds only. `empty`: no worlds at all.
const LIBRARY = process.env.EDITOR_SPEED_LIBRARY ?? 'bench';
if (!['bench', 'defaults', 'empty'].includes(LIBRARY)) throw new Error(`EDITOR_SPEED_LIBRARY must be bench, defaults or empty, not ${LIBRARY}`);
const HAS_BENCH = LIBRARY === 'bench';
const HEAP_SNAPSHOT = !!process.env.EDITOR_SPEED_HEAP_SNAPSHOT;
const OUT = path.join(HERE, '.out', LIBRARY === 'bench' ? 'results.json' : `results-${LIBRARY}.json`);
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
    if (rel === '/__bench/blank') {
      res.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html><title>blank</title>');
      return;
    }
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

const DEFAULT_WORLD_IDS = (await readdir(path.join(ROOT, 'src/defaultworlds'))).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));

const SEED = {
  FORMAMORPH_introSeen: 'true',
  FORMAMORPH_useCustomEndpoint: 'true',
  FORMAMORPH_endpointUrl: 'http://127.0.0.1:9/v1/chat/completions',
  FORMAMORPH_apiToken: 'harness',
  FORMAMORPH_modelName: 'harness-model',
  'formamorph.worldEditorMode': 'advanced',
  FORMAMORPH_ageGate: JSON.stringify({ accepted: true, acceptanceVersion: 1, acceptedAt: '2026-01-01T00:00:00.000Z' }),
  // The tombstones the app writes when a player deletes a default world, so the seeder skips them all.
  ...(LIBRARY === 'empty' ? { FORMAMORPH_deletedDefaultWorlds: JSON.stringify(DEFAULT_WORLD_IDS) } : {}),
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
  if (process.env.EDITOR_SPEED_PROFILE) {
    // Time per trace event type on the main thread. Types nest (script inside a task), so read each on its own.
    const sums = new Map();
    for (const e of events) {
      if (e.ph !== 'X' || main.get(e.pid) !== e.tid || e.ts < t0 || e.ts > t1) continue;
      sums.set(e.name, (sums.get(e.name) ?? 0) + e.dur / 1000);
    }
    const top = [...sums].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, ms]) => `${Math.round(ms)} ms  ${k}`);
    console.log(`[trace ${start}] main-thread time by event\n${top.join('\n')}`);
  }
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
  let extra;
  try {
    await page.evaluate(() => performance.mark('step-start'));
    extra = await body();
    await page.evaluate(() => performance.mark('step-end'));
  } finally {
    // A failed step must still end the trace, or every later step fails to start one.
    await cdp.send('Tracing.end');
    await done;
    cdp.off('Tracing.dataCollected', onData);
  }
  return { ...extra, ...blocksBetween(events, 'step-start', 'step-end') };
}

/** Run `body` under the V8 CPU profiler and print the functions with the most self time. */
async function profiled(cdp, label, body) {
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
  await cdp.send('Profiler.start');
  let result;
  try { result = await body(); } finally {
    const { profile } = await cdp.send('Profiler.stop');
    const self = new Map();
    const byId = new Map(profile.nodes.map((n) => [n.id, n]));
    profile.samples.forEach((id, i) => {
      const f = byId.get(id).callFrame;
      const key = `${f.functionName || '(anonymous)'} ${f.url.split('/').pop()}:${f.lineNumber + 1}`;
      self.set(key, (self.get(key) ?? 0) + (profile.timeDeltas[i] ?? 0));
    });
    const top = [...self].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, us]) => `${Math.round(us / 1000)} ms  ${k}`);
    console.log(`[profile ${label}] top self time\n${top.join('\n')}`);
    await cdp.send('Profiler.disable');
  }
  return result;
}

/** Resolve once the main thread has had no long task for `quietMs`. */
const settle = (page, quietMs = 1000) => page.waitForFunction((q) => performance.now() - window.__bench.lastLong > q, quietMs, { timeout: 180_000, polling: 100 });

const heapMb = async (cdp) => {
  await cdp.send('HeapProfiler.collectGarbage');
  const { usedSize } = await cdp.send('Runtime.getHeapUsage');
  return Math.round(usedSize / 1e6);
};

/** Start sampling the heap without GC, so garbage shows as a rise. The returned stop resolves the peak in MB. */
const heapPeak = (cdp) => {
  let peak = 0;
  let sampling = true;
  const loop = (async () => {
    while (sampling) {
      peak = Math.max(peak, (await cdp.send('Runtime.getHeapUsage')).usedSize);
      await new Promise((r) => setTimeout(r, 50));
    }
  })();
  return async () => { sampling = false; await loop; return Math.round(peak / 1e6); };
};

/** Write a heap snapshot of the page to `file` and return its retainer summary. */
async function heapSnapshot(cdp, file) {
  const out = createWriteStream(file);
  const onChunk = ({ chunk }) => out.write(chunk);
  cdp.on('HeapProfiler.addHeapSnapshotChunk', onChunk);
  await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false, captureNumericValue: false });
  cdp.off('HeapProfiler.addHeapSnapshotChunk', onChunk);
  await new Promise((resolve, reject) => out.end((e) => (e ? reject(e) : resolve())));
  return summarize(analyze(await loadSnapshot(file)));
}

/** Write the bench world straight into the library store, the way an import leaves it. */
async function seedWorld(page) {
  await page.evaluate(async (id) => {
    const world = await (await fetch('/__bench/world.json')).json();
    world.id = id;
    const db = await new Promise((resolve, reject) => {
      const q = indexedDB.open('worldsDB', 2);
      q.onupgradeneeded = () => {
        q.result.createObjectStore('worlds', { keyPath: 'id' });
        q.result.createObjectStore('worldMeta', { keyPath: 'id' });
      };
      q.onsuccess = () => resolve(q.result);
      q.onerror = () => reject(q.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction(['worlds', 'worldMeta'], 'readwrite');
      const now = new Date().toISOString();
      const o = world.worldOverview;
      const meta = { id, name: o.name, description: o.description, author: o.author, thumbnail: o.thumbnail, dirty: false, createdAt: now, lastAccessed: now };
      tx.objectStore('worlds').put({ ...meta, data: world });
      // The bench world has no placeholder chips in its blurb and no linked copies, so its list fields are its overview's.
      tx.objectStore('worldMeta').put({ ...meta, tags: o.tags || [], linkedCopies: [] });
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
    const field = panel.getByRole('textbox', { name: 'Name', exact: true }).first();
    await field.waitFor({ timeout: 60_000 });
    await field.click();
    await page.keyboard.press('End');
    await settle(page);
    await page.evaluate(() => { window.__bench.events = []; });
    const heapStartMb = await heapMb(cdp);
    const peak = heapPeak(cdp);
    try {
      return await traced(page, cdp, async () => {
        const t0 = Date.now();
        await page.keyboard.type(' the quick brown fox jumps', { delay: 120 });
        const typedMs = Date.now() - t0;
        const heapPeakMb = await peak();
        await settle(page, 1500);
        if (!(await field.evaluate((el) => (el.value ?? el.textContent ?? '').includes('quick brown fox')))) throw new Error('typed text did not land in the field');
        const lat = await page.evaluate(() => window.__bench.events.filter((e) => /key|input|beforeinput/.test(e.name)).map((e) => e.duration));
        return {
          keys: 26, typedMs, settledMs: Date.now() - t0, slowEvents: lat.length, latP50: pct(lat, 50), latP95: pct(lat, 95), latMax: pct(lat, 100),
          heapStartMb, heapPeakMb,
        };
      });
    } finally {
      await peak();
    }
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
      // The canvas render holds the main thread about 30 s at 6x, past the default click timeout.
      await canvasTab.click({ timeout: 180_000 });
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
    const pinned = process.env.EDITOR_SPEED_DRAG_NODE;
    const node = pinned ? page.locator(`.react-flow__node[data-id="${pinned}"]`) : page.locator('.react-flow__node').nth(3);
    const box = await node.boundingBox();
    if (!box) throw new Error('no canvas node');
    // The canvas draws only the boxes in view, so which box `nth(3)` is depends on the view: report it.
    const dragged = await node.getAttribute('data-id');
    // Pointer events are acknowledged after the page handles them, so each call's wall time is that move's cost.
    const moveMs = [];
    let releaseMs = 0, undoMs = 0;
    const drag = async () => {
      await page.mouse.move(box.x + 10, box.y + 10);
      await page.mouse.down();
      const moves = async () => {
        for (let i = 1; i <= 30; i++) {
          const t = Date.now();
          await page.mouse.move(box.x + 10 + i * 6, box.y + 10 + i * 4);
          moveMs.push(Date.now() - t);
        }
      };
      await (process.env.EDITOR_SPEED_PROFILE ? profiled(cdp, 'canvasDrag moves', moves) : moves());
      let t = Date.now();
      await page.mouse.up();
      releaseMs = Date.now() - t;
      await settle(page);
      t = Date.now();
      await page.keyboard.press('Control+z');
      undoMs = Date.now() - t;
      await settle(page);
    };
    const result = await traced(page, cdp, async () => framed(page, drag));
    return { dragged, moveP50: pct(moveMs, 50), moveP95: pct(moveMs, 95), moveMax: pct(moveMs, 100), releaseMs, undoMs, ...result };
  },

  async save({ page, cdp }) {
    const save = page.getByRole('button', { name: /^Save( World)?$/ }).first();
    const heapStartMb = await heapMb(cdp);
    const peak = heapPeak(cdp);
    try {
      return await traced(page, cdp, async () => {
        const t0 = Date.now();
        await save.click();
        await page.getByText(/saved/i).first().waitFor({ timeout: 180_000 });
        const savedMs = Date.now() - t0;
        await settle(page);
        return { savedMs, heapStartMb, heapPeakMb: await peak() };
      });
    } finally {
      await peak();
    }
  },

  /** Type in a field of a location's Presence tab, then open its Connect To picker: the 300-item location list. */
  async picker({ page, cdp }) {
    await page.getByRole('tab', { name: 'Locations' }).first().click();
    await page.getByRole('radio', { name: 'List' }).or(page.getByRole('tab', { name: 'List' })).first().click();
    await settle(page);
    await page.locator('div.cursor-pointer:has(span.cursor-grab)').first().click();
    await page.getByRole('tab', { name: 'Presence' }).click();
    const connectTo = page.getByRole('combobox', { name: 'Connect To' });
    await connectTo.waitFor({ timeout: 60_000 });
    const hint = page.getByRole('textbox', { name: /^Travel Hint/ }).first();
    if (!(await hint.count())) {
      // The location has no Connection yet: add one so the panel has a field to type in.
      await connectTo.click();
      await page.getByRole('option').first().click();
      await page.getByRole('button', { name: 'Add Connection' }).click();
      await hint.waitFor({ timeout: 60_000 });
    }
    await hint.click();
    await page.keyboard.press('End');
    await settle(page);
    await page.evaluate(() => { window.__bench.events = []; });
    const text = ' the quick brown fox jumps';
    return traced(page, cdp, async () => {
      const t0 = Date.now();
      await page.keyboard.type(text, { delay: 120 });
      const typedMs = Date.now() - t0;
      await settle(page, 1500);
      if (!(await hint.inputValue()).includes('quick brown fox')) throw new Error('typed text did not land in the field');
      const lat = await page.evaluate(() => window.__bench.events.filter((e) => /key|input|beforeinput/.test(e.name)).map((e) => e.duration));
      const t1 = Date.now();
      await connectTo.click();
      await page.getByRole('option').first().waitFor({ timeout: 180_000 });
      const openMs = Date.now() - t1;
      const options = await page.getByRole('option').count();
      await page.keyboard.press('Escape');
      await settle(page);
      return { keys: text.length, typedMs, slowEvents: lat.length, latP50: pct(lat, 50), latP95: pct(lat, 95), latMax: pct(lat, 100), openMs, options };
    });
  },

  /** Import the bench world file through the Main Menu's file input. Declines the image optimizer, so the step times the import itself. */
  async import({ page, cdp }) {
    await page.goto(page.url());
    await page.getByText('Large Bench World', { exact: false }).first().waitFor({ timeout: 60_000 });
    await settle(page, 2000);
    const input = page.locator('input[type="file"][accept=".json"]');
    return traced(page, cdp, async () => {
      const t0 = Date.now();
      await input.setInputFiles(WORLD);
      const keep = page.getByRole('button', { name: 'Keep as-is' });
      await keep.waitFor({ timeout: 180_000 });
      const promptMs = Date.now() - t0;
      await keep.click();
      // A lone import opens the world's details once it is stored.
      await page.getByRole('button', { name: 'Edit World' }).waitFor({ timeout: 180_000 });
      const visibleMs = Date.now() - t0;
      await settle(page, 1500);
      return { promptMs, visibleMs, settledMs: Date.now() - t0 };
    });
  },

  /** Bare put and get of the bench record on a blank page of the same origin: the structured-clone floor. */
  async idb({ page, rate }) {
    const blank = await page.context().newPage();
    const cdp = await page.context().newCDPSession(blank);
    try {
      await blank.goto(new URL('/__bench/blank', page.url()).href);
      await blank.evaluate(async (id) => {
        const world = await (await fetch('/__bench/world.json')).json();
        const o = world.worldOverview;
        window.__record = { id, name: o.name, description: o.description, author: o.author, thumbnail: o.thumbnail, dirty: false, data: world };
        window.__db = await new Promise((resolve, reject) => {
          const q = indexedDB.open('editorSpeedIdb', 1);
          q.onupgradeneeded = () => q.result.createObjectStore('worlds', { keyPath: 'id' });
          q.onsuccess = () => resolve(q.result);
          q.onerror = () => reject(q.error);
        });
      }, WORLD_ID);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate });
      const put = () => blank.evaluate(async () => {
        const t0 = performance.now();
        const tx = window.__db.transaction('worlds', 'readwrite');
        tx.objectStore('worlds').put(window.__record);
        const callMs = performance.now() - t0;
        await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = tx.onabort = () => reject(tx.error); });
        return { callMs, doneMs: performance.now() - t0 };
      });
      const get = () => blank.evaluate(async (id) => {
        const t0 = performance.now();
        const q = window.__db.transaction('worlds', 'readonly').objectStore('worlds').get(id);
        const record = await new Promise((resolve, reject) => { q.onsuccess = () => resolve(q.result); q.onerror = () => reject(q.error); });
        if (!record?.data?.entities?.length) throw new Error('get returned no world');
        return { doneMs: performance.now() - t0 };
      }, WORLD_ID);
      // The shape of the library's storeWorld: read the old record, then put the new one from the read's success handler.
      const getThenPut = () => blank.evaluate(async () => {
        const t0 = performance.now();
        const tx = window.__db.transaction('worlds', 'readwrite');
        const store = tx.objectStore('worlds');
        const q = store.get(window.__record.id);
        q.onsuccess = () => store.put({ ...window.__record, createdAt: q.result?.createdAt });
        await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = tx.onabort = () => reject(tx.error); });
        return { doneMs: performance.now() - t0 };
      });
      const runs = { put: [], get: [], getThenPut: [] };
      for (let i = 0; i < 3; i++) {
        for (const [op, fn] of [['put', put], ['get', get], ['getThenPut', getThenPut]]) {
          await cdp.send('HeapProfiler.collectGarbage');
          runs[op].push(await traced(blank, cdp, fn));
        }
      }
      const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
      const summary = (rs) => ({
        doneMs: Math.round(median(rs.map((r) => r.doneMs))),
        ...(rs[0].callMs !== undefined ? { callMs: Math.round(median(rs.map((r) => r.callMs))) } : {}),
        maxBlockMs: median(rs.map((r) => r.maxBlockMs)),
        runs: rs.map((r) => ({ doneMs: Math.round(r.doneMs), maxBlockMs: r.maxBlockMs })),
      });
      await blank.evaluate(() => new Promise((resolve) => {
        window.__db.close();
        const q = indexedDB.deleteDatabase('editorSpeedIdb');
        q.onsuccess = q.onerror = q.onblocked = resolve;
      }));
      return { put: summary(runs.put), get: summary(runs.get), getThenPut: summary(runs.getThenPut) };
    } finally {
      await blank.close();
    }
  },

  ...(WORLD.includes('-pins') ? pinSteps({ settle, traced, pct, profiled }) : {}),
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
  if (HAS_BENCH) await seedWorld(page);
  await page.goto(base);
  if (HAS_BENCH) await page.getByText('Large Bench World', { exact: false }).first().waitFor({ timeout: 60_000 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  await settle(page, 2000);
  const results = {
    library: await page.evaluate(() => new Promise((resolve, reject) => {
      const q = indexedDB.open('worldsDB');
      q.onsuccess = () => {
        if (!q.result.objectStoreNames.contains('worlds')) { q.result.close(); resolve(0); return; }
        const n = q.result.transaction('worlds').objectStore('worlds').count();
        n.onsuccess = () => { q.result.close(); resolve(n.result); };
        n.onerror = () => reject(n.error);
      };
      q.onerror = () => reject(q.error);
    })),
    heapMenuMb: await heapMb(cdp),
  };
  console.log(rate + 'x', 'menu', JSON.stringify(results));
  // Unthrottled: the snapshot reads the same heap and takes minutes at 6x.
  const snapshot = async (label) => {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const summary = await heapSnapshot(cdp, path.join(HERE, '.out', `${label}-${LIBRARY}-${rate}x.heapsnapshot`));
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    console.log(rate + 'x', `${label} retainers`, JSON.stringify(summary, null, 2));
    return summary;
  };
  if (HEAP_SNAPSHOT) results.menuRetainers = await snapshot('menu');
  for (const [name, step] of Object.entries(STEPS)) {
    if (!HAS_BENCH || (ONLY && !ONLY.includes(name))) continue;
    try {
      results[name] = await step({ page, cdp, rate });
    } catch (e) {
      results[name] = { error: String(e.message ?? e).split('\n')[0] };
      if (process.env.EDITOR_SPEED_SHOT) await page.screenshot({ path: path.join(HERE, '.out', `fail-${name}.png`) });
    }
    results[name].heapMb = await heapMb(cdp).catch(() => null);
    console.log(rate + 'x', name, JSON.stringify(results[name]));
    if (HEAP_SNAPSHOT && (name === 'open' || name === 'save') && !results[name].error) results[name].retainers = await snapshot(name);
  }
  await context.close();
  return results;
}

await mkdir(path.dirname(OUT), { recursive: true });
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
