// Community Creations open-speed harness. `npm run profile:open-speed` builds an unminified production
// bundle into testing/open-speed/.build, serves it, and opens the browser cold, warm 1, warm 2 and
// reopen (close, then open again in the same page) at 1x and 4x CPU throttle. Block timing comes from a trace; a CPU profile inside the same trace gives the
// tooltip share. Not part of the four gates.
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const BUILD = path.join(HERE, '.build');
const OUT = path.join(HERE, 'results.json');
const ROWS = Number(process.env.OPEN_SPEED_ROWS ?? 700);
const THROTTLES = (process.env.OPEN_SPEED_THROTTLE ?? '1,4').split(',').map(Number);
const BLOCK_US = 50_000;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp' };

function build() {
  if (process.env.OPEN_SPEED_SKIP_BUILD) return;
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const r = spawnSync(npx, ['vite', 'build', '--outDir', BUILD, '--emptyOutDir', '--minify', 'false'], { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) throw new Error(`build failed (${r.status})`);
}

function serve() {
  const server = createServer(async (req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
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

const catalog = () => Array.from({ length: ROWS }, (_, i) => ({
  _id: `os-${i}`, id: `os-${i}`, kind: i % 4 === 0 ? 'entity' : 'world',
  name: `Harness Listing ${i}`, description: 'A canned listing for the open-speed harness.',
  author: { id: `a-${i % 20}`, username: `author${i % 20}` },
  tags: ['forest', 'fantasy', `t${i % 9}`], likes: i % 30, comment_count: i % 5, changelog_count: i % 3,
  updated_at: new Date(Date.UTC(2026, 0, 1) + i * 3_600_000).toISOString(),
}));

const SEED = {
  FORMAMORPH_introSeen: 'true',
  FORMAMORPH_useCustomEndpoint: 'true',
  FORMAMORPH_endpointUrl: 'http://127.0.0.1:9/v1/chat/completions',
  FORMAMORPH_apiToken: 'harness',
  FORMAMORPH_modelName: 'harness-model',
  FORMAMORPH_ageGate: JSON.stringify({ accepted: true, acceptanceVersion: 1, acceptedAt: '2026-01-01T00:00:00.000Z' }),
};

/** Trace events into per-open numbers. */
function analyze(events, marks) {
  const main = new Map();
  for (const e of events) if (e.ph === 'M' && e.name === 'thread_name' && e.args?.name === 'CrRendererMain') main.set(e.pid, e.tid);
  const isMain = (e) => main.get(e.pid) === e.tid;
  const mark = (name) => events.find((e) => e.cat?.includes('blink.user_timing') && e.name === name)?.ts;
  const t0 = mark(marks.start), t1 = mark(marks.end);
  if (t0 === undefined || t1 === undefined) throw new Error('trace is missing the open marks');
  const blocks = events.filter((e) => e.ph === 'X' && e.name === 'RunTask' && isMain(e) && e.dur > BLOCK_US && e.ts + e.dur > t0 && e.ts < t1).map((e) => e.dur / 1000);

  // CPU profile: samples with a tooltip frame in the stack, over all script samples in the open. React's
  // scheduler frames are minified in node_modules, so script time stands in for render time.
  const profiles = new Map();
  for (const e of events) {
    if (e.name === 'Profile') profiles.set(e.id, { start: e.args.data.startTime, nodes: new Map(), samples: [], deltas: [] });
    if (e.name === 'ProfileChunk') {
      const p = profiles.get(e.id);
      if (!p) continue;
      const cp = e.args.data.cpuProfile;
      for (const n of cp.nodes ?? []) p.nodes.set(n.id, n);
      p.samples.push(...(cp.samples ?? []));
      p.deltas.push(...(e.args.data.timeDeltas ?? []));
    }
  }
  const NON_SCRIPT = /^\((root|idle|program|garbage collector)\)$/;
  const TOOLTIP = /tooltip|^Tip$/i;
  let script = 0, tooltip = 0;
  for (const p of profiles.values()) {
    const cache = new Map();
    const classify = (id) => {
      if (cache.has(id)) return cache.get(id);
      let inScript = false, inTip = false;
      for (let n = p.nodes.get(id); n; n = p.nodes.get(n.parent)) {
        const f = n.callFrame.functionName;
        if (f && !NON_SCRIPT.test(f)) inScript = true;
        if (TOOLTIP.test(f)) inTip = true;
      }
      const v = [inScript, inTip];
      cache.set(id, v);
      return v;
    };
    let t = p.start;
    p.samples.forEach((id, i) => {
      t += p.deltas[i] ?? 0;
      if (t < t0 || t > t1) return;
      const dt = p.deltas[i + 1] ?? p.deltas[i] ?? 0;
      const [inScript, inTip] = classify(id);
      if (inScript) { script += dt; if (inTip) tooltip += dt; }
    });
  }
  return {
    blocks: blocks.length,
    blockMs: Math.round(blocks.reduce((a, b) => a + b, 0)),
    maxBlockMs: Math.round(Math.max(0, ...blocks)),
    tooltipPct: script ? Math.round((tooltip / script) * 1000) / 10 : null,
  };
}

async function measureOpen(page, cdp, label) {
  const events = [];
  const onData = (m) => events.push(...m.value);
  cdp.on('Tracing.dataCollected', onData);
  const done = new Promise((r) => cdp.once('Tracing.tracingComplete', r));
  await cdp.send('Tracing.start', {
    traceConfig: { includedCategories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'blink.user_timing', 'disabled-by-default-v8.cpu_profiler', 'v8'] },
    transferMode: 'ReportEvents',
  });
  await page.evaluate(() => {
    window.__open = { visible: null, lastLong: performance.now() };
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__open.lastLong = e.startTime + e.duration; }).observe({ entryTypes: ['longtask'] });
    const button = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Community Creations'));
    if (!button) throw new Error('Community Creations button not found');
    button.addEventListener('click', () => {
      performance.mark('open-start');
      const t0 = performance.now();
      const mo = new MutationObserver(() => {
        const dialogs = [...document.querySelectorAll('[role="dialog"]')];
        if (!dialogs.some((d) => d.textContent?.includes('Community Creations'))) return;
        mo.disconnect();
        requestAnimationFrame(() => requestAnimationFrame(() => { window.__open.visible = performance.now() - t0; }));
      });
      mo.observe(document.body, { childList: true, subtree: true });
    }, { capture: true, once: true });
  });
  await page.getByRole('button', { name: 'Community Creations' }).click();
  await page.waitForFunction(() => window.__open.visible !== null, null, { timeout: 30_000 });
  await page.getByText(/^Harness Listing \d+$/).first().waitFor({ timeout: 60_000 });
  await page.waitForFunction(() => performance.now() - window.__open.lastLong > 700, null, { timeout: 60_000, polling: 100 });
  await page.evaluate(() => performance.mark('open-end'));
  const visibleMs = await page.evaluate(() => Math.round(window.__open.visible));
  await cdp.send('Tracing.end');
  await done;
  cdp.off('Tracing.dataCollected', onData);
  return { open: label, visibleMs, ...analyze(events, { start: 'open-start', end: 'open-end' }) };
}

/** Rows in the catalog cache, 0 when the database does not exist yet. */
const catalogRows = (page) => page.evaluate(async () => {
  const names = (await indexedDB.databases()).map((d) => d.name);
  if (!names.includes('FORMAMORPH_CATALOG_DB')) return 0;
  const db = await new Promise((resolve, reject) => {
    const q = indexedDB.open('FORMAMORPH_CATALOG_DB');
    q.onsuccess = () => resolve(q.result);
    q.onerror = () => reject(q.error);
  });
  const n = await new Promise((resolve) => {
    if (!db.objectStoreNames.contains('worlds')) return resolve(0);
    const q = db.transaction('worlds').objectStore('worlds').count();
    q.onsuccess = () => resolve(q.result);
  });
  db.close();
  return n;
});

/** One throwaway trace so the profiler's first start does not land inside the cold open. */
async function warmProfiler(cdp) {
  const done = new Promise((r) => cdp.once('Tracing.tracingComplete', r));
  await cdp.send('Tracing.start', { traceConfig: { includedCategories: ['disabled-by-default-v8.cpu_profiler'] }, transferMode: 'ReportEvents' });
  await cdp.send('Tracing.end');
  await done;
}

async function runThrottle(browser, base, rate) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript((seed) => { for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); }, SEED);
  const rows = catalog();
  await context.route(/\/events(\/active)?(\?|$)/, (r) => r.fulfill({ json: { data: [] } }));
  await context.route('**/worlds?*', (r) => r.fulfill({ json: { success: true, data: rows, total: rows.length } }));
  await context.route('**/worlds/*/comments*', (r) => r.fulfill({ json: { success: true, data: [] } }));
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  const results = [];
  for (const label of ['cold', 'warm 1', 'warm 2']) {
    await page.goto(base);
    await page.getByRole('button', { name: 'Community Creations' }).waitFor({ timeout: 60_000 });
    await page.waitForTimeout(1500);
    const cached = await catalogRows(page);
    if ((label === 'cold') !== (cached === 0)) throw new Error(`${label} open started with ${cached} cached rows`);
    if (label === 'cold') await warmProfiler(cdp);
    results.push(await measureOpen(page, cdp, label));
  }
  // Close and open again in the same page: the browser stays mounted and keeps its rows, so nothing
  // arrives late to commit after the window.
  await page.getByRole('button', { name: 'Back' }).click();
  await page.locator('[role="dialog"][data-state="closed"]', { hasText: 'Community Creations' }).waitFor({ state: 'attached', timeout: 30_000 });
  await page.waitForTimeout(2500);
  results.push(await measureOpen(page, cdp, 'reopen'));
  await context.close();
  return results;
}

build();
const server = await serve();
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();
const report = { rows: ROWS, when: new Date().toISOString(), runs: {} };
try {
  for (const rate of THROTTLES) {
    report.runs[`${rate}x`] = await runThrottle(browser, base, rate);
    console.log(`\nCPU throttle ${rate}x`);
    console.table(report.runs[`${rate}x`]);
  }
} finally {
  await browser.close();
  server.close();
}
await writeFile(OUT, JSON.stringify(report, null, 2));
console.log(`Wrote ${path.relative(ROOT, OUT)}`);
