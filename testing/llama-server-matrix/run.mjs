// Load matrix against the real llama-server: each combination loads, answers one turn, stops, and must leave
// no process or VRAM behind. Outside the gates; it uses the GPU. Usage and flags: README.md.
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const ls = require('../../electron/llamaServer.cjs');
const { collect } = require('../../electron/vramCollect.cjs');

const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : null; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const BASE = { gpuLayers: ls.GPU_LAYERS_AUTO, flashAttention: true, parallelRequests: 1, unifiedKvCache: true, kCacheType: 'f16', vCacheType: 'f16', kvCacheInRam: false, device: null };
const TYPES = ['f16', 'q8_0', 'q4_0'];

/** The combinations: the baseline, each setting varied alone, and every K × V pair Flash Attention allows. */
function combinations(devices) {
  const list = [
    { id: 'baseline', settings: {} },
    { id: 'fa-off', settings: { flashAttention: false } },
    { id: 'unified-off', settings: { unifiedKvCache: false, parallelRequests: 2 } },
    { id: 'unified-on-np2', settings: { parallelRequests: 2 } },
    { id: 'kv-in-ram', settings: { kvCacheInRam: true } },
    { id: 'k-q8-fa-off', settings: { kCacheType: 'q8_0', flashAttention: false } },
    { id: 'layers-max', settings: { gpuLayers: ls.GPU_LAYERS_MAX } },
    { id: 'layers-custom-8', settings: { gpuLayers: 8 } },
  ];
  for (const k of TYPES) for (const v of TYPES) if (k !== 'f16' || v !== 'f16') list.push({ id: `k-${k}-v-${v}`, settings: { kCacheType: k, vCacheType: v } });
  if (devices[0]) list.push({ id: `device-${devices[0].id}`, settings: { device: devices[0].id } });
  // Must fail to load; serverArgs coerces it away, so the arguments are patched.
  list.push({ id: 'bad-v-q8-fa-off', settings: { flashAttention: false }, mutate: (args) => args.map((a, i) => (args[i - 1] === '-ctv' ? 'q8_0' : a)), expectFail: true });
  return list;
}

const serverProcesses = async () => (await ls.listProcesses()).filter((r) => /^llama-server(\.exe)?$/i.test(r.name));
const usedMB = async () => (await collect()).gpus.reduce((sum, g) => sum + (g.usedMB ?? 0), 0);

/** Runs one combination. Resolves { loaded, answered, detail }. */
async function run({ bin, modelPath, contextSize, combo }) {
  const work = await mkdtemp(path.join(os.tmpdir(), 'llama-matrix-'));
  const modelId = path.basename(modelPath);
  const presetPath = path.join(work, 'preset.ini');
  await writeFile(presetPath, ls.presetIni({ modelId, modelPath }));
  await mkdir(path.join(work, 'cache'));
  const port = await ls.freePort();
  let args = ls.serverArgs({ presetPath, port, contextSize, ...BASE, ...combo.settings });
  if (combo.mutate) args = combo.mutate(args);
  const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, LLAMA_CACHE: path.join(work, 'cache') }, windowsHide: true });
  const lines = [];
  let partial = '';
  child.stdout.on('data', (c) => {
    partial += c;
    const parts = partial.split('\n');
    partial = parts.pop();
    lines.push(...parts.filter(Boolean));
  });
  child.stderr.on('data', () => {});
  const base = `http://127.0.0.1:${port}`;
  const result = { loaded: false, answered: false, detail: '' };
  try {
    for (let i = 0; i < 300 && !lines.some((l) => ls.parseLogLine(l).text.includes('listening on')); i++) await wait(100);
    const sse = await fetch(`${base}/models/sse`, { signal: AbortSignal.timeout(30000) });
    const reader = sse.body.getReader();
    const decoder = new TextDecoder();
    const sseRead = ls.sseReader();
    let outcome = null;
    const pump = (async () => {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return;
        for (const e of sseRead.feed(decoder.decode(value, { stream: true }))) {
          if (e.event === ls.STATUS_EVENT && (e.data?.status === 'loaded' || e.data?.status === 'unloaded')) outcome ??= e.data.status;
        }
      }
    })().catch(() => {});
    await fetch(`${base}/models/load`, { method: 'POST', body: JSON.stringify({ model: modelId }) });
    for (let i = 0; i < 1800 && !outcome; i++) await wait(100);
    result.loaded = outcome === 'loaded';
    if (result.loaded) {
      const res = await fetch(`${base}/v1/chat/completions`, {
        method: 'POST',
        body: JSON.stringify({ model: modelId, messages: [{ role: 'user', content: 'Say hi in three words.' }], max_tokens: 16, temperature: 0, seed: 1 }),
      });
      const body = await res.json();
      const text = body?.choices?.[0]?.message?.content ?? '';
      result.answered = res.ok && text.trim().length > 0;
      result.detail = result.answered ? JSON.stringify(text.trim().slice(0, 40)) : `no answer (HTTP ${res.status})`;
      await fetch(`${base}/models/unload`, { method: 'POST', body: JSON.stringify({ model: modelId }) });
      await wait(500);
    } else {
      const texts = lines.map((l) => ls.parseLogLine(l).text);
      result.cause = texts.find((t) => /V cache|flash.attn/i.test(t) && /error|fail|require/i.test(t));
      result.detail = (result.cause ?? texts.filter((t) => /error|failed/i.test(t)).pop() ?? 'load failed').slice(0, 90);
    }
    reader.cancel().catch(() => {});
    await pump;
  } catch (e) {
    result.detail = ls.errorText(e).slice(0, 90);
  } finally {
    child.kill();
    await Promise.race([new Promise((r) => child.once('close', r)), wait(10000)]);
    await rm(work, { recursive: true, force: true }).catch(() => {});
  }
  return result;
}

/** Waits for the GPU to give its memory back; returns { leftover processes, MiB above the baseline }. */
async function afterStop(baselineMB, toleranceMB) {
  let extra = Infinity;
  let procs = [];
  for (let i = 0; i < 40; i++) {
    procs = await serverProcesses();
    extra = (await usedMB()) - baselineMB;
    if (!procs.length && extra <= toleranceMB) break;
    await wait(500);
  }
  return { procs, extra };
}

const modelPath = arg('model');
const bin = arg('bin') ?? process.env.LLAMA_SERVER_BIN ?? ls.binaryPath();
if (!modelPath || !bin) {
  console.error('Usage: node testing/llama-server-matrix/run.mjs --model <gguf> [--bin <llama-server>] [--only <id,id>] [--context 4096] [--list]');
  if (!bin) console.error('No bundled llama-server. Run npm run llama-server:fetch, or pass --bin.');
  process.exit(2);
}
const contextSize = Number(arg('context') ?? 4096);
const tolerance = Number(arg('tolerance') ?? 400);
const devices = await ls.listServerDevices({ bin });
const only = arg('only')?.split(',');
const combos = combinations(devices).filter((c) => !only || only.includes(c.id));
if (process.argv.includes('--list')) { console.log(combos.map((c) => c.id).join('\n')); process.exit(0); }

console.log(`llama-server: ${bin}\nmodel: ${modelPath}\ndevices: ${devices.map((d) => `${d.id} ${d.name} (${d.totalMB} MiB)`).join('; ') || 'none'}\n`);
const started = Date.now();
if ((await serverProcesses()).length) { console.error('A llama-server process is already running. Stop it first.'); process.exit(2); }
const baselineMB = await usedMB();
const rows = [];
for (const combo of combos) {
  const t0 = Date.now();
  const r = await run({ bin, modelPath, contextSize, combo });
  const freed = await afterStop(baselineMB, tolerance);
  const leak = freed.procs.length ? `${freed.procs.length} process(es) left` : freed.extra > tolerance ? `${freed.extra} MiB still held` : '';
  // The forced-bad row must fail for the V cache / Flash Attention reason, not any other.
  const loadOk = combo.expectFail ? !r.loaded && Boolean(r.cause) : r.loaded && r.answered;
  const pass = loadOk && !leak;
  const verdict = combo.expectFail ? (pass ? 'PASS (failed as expected)' : 'FAIL') : pass ? 'PASS' : 'FAIL';
  const detail = [r.detail, leak, combo.expectFail && r.loaded ? 'loaded but must fail' : ''].filter(Boolean).join('; ');
  rows.push({ id: combo.id, verdict, secs: ((Date.now() - t0) / 1000).toFixed(1), detail });
  console.log(`${verdict.padEnd(26)} ${combo.id.padEnd(18)} ${String((Date.now() - t0) / 1000 | 0).padStart(4)}s  ${detail}`);
}
const failed = rows.filter((r) => r.verdict === 'FAIL');
const total = ((Date.now() - started) / 60000).toFixed(1);
console.log(`\n| Combination | Result | Seconds | Detail |\n|---|---|---|---|`);
for (const r of rows) console.log(`| ${r.id} | ${r.verdict} | ${r.secs} | ${r.detail} |`);
console.log(`\n${rows.length - failed.length}/${rows.length} passed in ${total} min.`);
process.exit(failed.length ? 1 : 0);
