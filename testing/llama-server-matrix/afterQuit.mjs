// After quitting the app: lists leftover llama-server processes and GPU memory in use.
// Run it once before launching to read the baseline, then again after quit with --baseline.
// Usage: node testing/llama-server-matrix/afterQuit.mjs [--baseline <MiB>] [--tolerance 400]
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ls = require('../../electron/llamaServer.cjs');
const { collect } = require('../../electron/vramCollect.cjs');

const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : null; };
const procs = (await ls.listProcesses()).filter((r) => /^llama-server(\.exe)?$/i.test(r.name));
const used = (await collect()).gpus.reduce((sum, g) => sum + (g.usedMB ?? 0), 0);
const baseline = arg('baseline');
const tolerance = Number(arg('tolerance') ?? 400);
console.log(`llama-server processes: ${procs.length ? procs.map((p) => p.pid).join(', ') : 'none'}`);
console.log(`GPU memory in use: ${used} MiB${baseline ? ` (baseline ${baseline}, ${used - Number(baseline)} above)` : ''}`);
const held = baseline && used - Number(baseline) > tolerance;
if (procs.length || held) { console.log('FAIL'); process.exit(1); }
console.log('PASS');
