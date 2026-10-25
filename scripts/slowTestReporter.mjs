// Vitest reporter that warns about slow tests and separates load from real slowness. The main process times a
// fixed CPU loop through the run; a test's duration divided by the load at its time is its idle cost, which is
// compared with that test's own recent runs. History lives in node_modules/.cache, outside git.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

const SAMPLE_EVERY_MS = 250;
const HISTORY_RUNS = 5;
/** Idle cost past this multiple of the test's own recent median is a regression, not load. */
export const REGRESSION = 2;
const CACHE_FILE = path.resolve('node_modules/.cache/formamorph-slow-tests.json');

/** Milliseconds one fixed unit of CPU work takes right now. */
export function calibrate() {
  const start = performance.now();
  let hash = 2166136261;
  for (let i = 0; i < 300_000; i++) hash = Math.imul(hash ^ i, 16777619);
  const ms = performance.now() - start;
  return hash === 0 ? ms + 1 : ms; // keeps the loop from being optimized away
}

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

/** How many times slower than idle the machine ran over [start, end]; the run's median when no sample falls inside. */
export function loadFactor(samples, start, end, reference) {
  const inside = samples.filter((s) => s.at >= start && s.at <= end).map((s) => s.ms);
  const ms = inside.length ? median(inside) : samples.length ? median(samples.map((s) => s.ms)) : reference;
  return Math.max(1, ms / reference);
}

/**
 * Sorts the tests over the threshold: `regressed` ran at least REGRESSION times its recent idle median even with
 * load taken out; `loaded` is under the threshold at idle, so load alone made it slow; the rest are heavy as usual.
 */
export function classify(tests, samples, reference, threshold, history) {
  const regressed = [];
  const loaded = [];
  let heavy = 0;
  for (const t of tests) {
    if (t.duration < threshold) continue;
    const load = loadFactor(samples, t.startTime, t.startTime + t.duration, reference);
    const idle = t.duration / load;
    const past = history[t.key];
    const usual = past?.length ? median(past) : undefined;
    const row = { ...t, load, idle, usual };
    if (usual !== undefined && idle >= usual * REGRESSION) regressed.push(row);
    else if (idle < threshold) loaded.push(row);
    else heavy++;
  }
  regressed.sort((a, b) => b.idle / b.usual - a.idle / a.usual);
  loaded.sort((a, b) => b.duration - a.duration);
  return { regressed, loaded, heavy };
}

/** Each test's history with this run's idle cost added, keeping the last HISTORY_RUNS. */
export function recordRun(history, tests, samples, reference) {
  const next = { ...history };
  for (const t of tests) {
    const idle = t.duration / loadFactor(samples, t.startTime, t.startTime + t.duration, reference);
    next[t.key] = [...(history[t.key] ?? []), Math.round(idle)].slice(-HISTORY_RUNS);
  }
  return next;
}

function readCache() {
  try {
    const cache = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    return { calibrationMs: cache.calibrationMs, tests: cache.tests ?? {} };
  } catch {
    return { calibrationMs: undefined, tests: {} };
  }
}

function writeCache(cache) {
  try {
    mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(cache));
  } catch {
    // A missing cache only makes the next run's comparison less exact.
  }
}

const seconds = (ms) => `${(ms / 1000).toFixed(1)} s`;

export default class SlowTestReporter {
  samples = [];
  tests = [];
  threshold = 2000;
  timer;

  onInit(vitest) {
    this.threshold = vitest.config.slowTestThreshold ?? this.threshold;
    this.samples.push({ at: Date.now(), ms: calibrate() });
    this.timer = setInterval(() => this.samples.push({ at: Date.now(), ms: calibrate() }), SAMPLE_EVERY_MS);
    this.timer.unref();
  }

  onTestCaseResult(testCase) {
    const { duration, startTime } = testCase.diagnostic() ?? {};
    if (typeof duration !== 'number' || testCase.result().state !== 'passed') return;
    const file = path.relative(process.cwd(), testCase.module.moduleId).replace(/\\/g, '/');
    this.tests.push({ key: `${file} > ${testCase.fullName}`, duration, startTime });
  }

  onTestRunEnd() {
    clearInterval(this.timer);
    const cache = readCache();
    const fastest = Math.min(...this.samples.map((s) => s.ms));
    const reference = cache.calibrationMs === undefined ? fastest : Math.min(cache.calibrationMs, fastest);
    const { regressed, loaded, heavy } = classify(this.tests, this.samples, reference, this.threshold, cache.tests);
    writeCache({ calibrationMs: reference, tests: recordRun(cache.tests, this.tests, this.samples, reference) });

    const total = regressed.length + loaded.length + heavy;
    if (!total) return;
    const runLoad = loadFactor(this.samples, -Infinity, Infinity, reference);
    console.log(`\nSlow tests: ${total} over ${seconds(this.threshold)} at load ${runLoad.toFixed(1)}×. ` +
      `${regressed.length} slower than their recent runs, ${loaded.length} slow from load, ${heavy} as usual.`);
    for (const t of regressed) {
      console.log(`  ⚠ ${seconds(t.idle)} idle vs ${seconds(t.usual)} usual (${(t.idle / t.usual).toFixed(1)}×)  ${t.key}`);
    }
    for (const t of loaded) {
      console.log(`  · ${seconds(t.duration)} at load ${t.load.toFixed(1)}× (${seconds(t.idle)} idle)  ${t.key}`);
    }
  }
}
