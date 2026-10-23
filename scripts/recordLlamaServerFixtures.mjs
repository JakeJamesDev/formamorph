// Records the fake llama-server's fixtures from a real run of the pinned build: --list-devices, a load that
// answers one chat turn, a load that fails on the KV cache, a CPU load and a fit-off load. `--thinking` records
// one turn of a Qwen-style thinking model into <tag>-thinking.json, `--gemma` one of a Gemma 4 model into
// <tag>-gemma.json. Rerun all after every pin bump.
// Usage: node scripts/recordLlamaServerFixtures.mjs [<model.gguf>] [--thinking <model.gguf>] [--gemma <model.gguf>]
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ls = require('../electron/llamaServer.cjs');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const OUT_DIR = path.join(ROOT, 'electron', 'fixtures', 'llama-server');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** The chat turn each scenario records, by its `chat` name. */
const CHATS = {
  plain: { messages: [{ role: 'user', content: 'Say hi in three words.' }], maxTokens: 12, template: false },
  thinking: {
    messages: [{ role: 'system', content: 'Answer briefly.' }, { role: 'user', content: 'What is 2+2? One word.' }],
    maxTokens: 600,
    template: true,
  },
  // Gemma 4 thinks only when the request turns it on.
  gemma: {
    messages: [{ role: 'system', content: 'Answer briefly.' }, { role: 'user', content: 'What is 2+2? One word.' }],
    maxTokens: 600,
    template: true,
    extra: { chat_template_kwargs: { enable_thinking: true } },
  },
};

/** Runs one router scenario and returns its stdout split at the load request and at the load's outcome. */
async function scenario({ bin, modelPath, settings, chat }) {
  const work = await mkdtemp(path.join(os.tmpdir(), 'llama-rec-'));
  const modelId = path.basename(modelPath);
  const presetPath = path.join(work, 'preset.ini');
  await writeFile(presetPath, ls.presetIni({ modelId, modelPath }));
  await mkdir(path.join(work, 'cache'));
  const port = await ls.freePort();
  const args = ls.serverArgs({ presetPath, port, ...settings });
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
  for (let i = 0; i < 100; i++) {
    if (lines.some((l) => ls.parseLogLine(l).text.includes('listening on'))) break;
    await wait(100);
  }

  const models = await (await fetch(`${base}/models`)).json();
  const events = [];
  const sse = await fetch(`${base}/models/sse`);
  const reader = sse.body.getReader();
  const decoder = new TextDecoder();
  const sseRead = ls.sseReader();
  let outcome = null;
  const pump = (async () => {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      for (const e of sseRead.feed(decoder.decode(value, { stream: true }))) {
        events.push(e);
        if (e.event === ls.STATUS_EVENT && (e.data?.status === 'loaded' || e.data?.status === 'unloaded')) outcome ??= e.data.status;
      }
    }
  })().catch(() => {});

  const bootLines = lines.length;
  const loadReply = await (await fetch(`${base}/models/load`, { method: 'POST', body: JSON.stringify({ model: modelId }) })).json();
  while (!outcome) await wait(100);
  await wait(300); // the instance's last log lines trail its status event
  const loadLines = lines.length;
  const loadEvents = events.length;

  const result = { args, models, loadReply, outcome };
  if (outcome === 'loaded' && chat) {
    const { messages, maxTokens, template, extra } = CHATS[chat];
    const body = { model: modelId, messages, max_tokens: maxTokens, temperature: 0, seed: 1, ...extra };
    // The rendered prompt shows whether the template's generation prompt opens the thought itself.
    if (template) result.applyTemplate = await (await fetch(`${base}/apply-template`, { method: 'POST', body: JSON.stringify({ model: modelId, messages, ...extra }) })).json();
    result.chat = await (await fetch(`${base}/v1/chat/completions`, { method: 'POST', body: JSON.stringify(body) })).json();
    result.chatStream = await (await fetch(`${base}/v1/chat/completions`, { method: 'POST', body: JSON.stringify({ ...body, stream: true }) })).text();
    await fetch(`${base}/models/unload`, { method: 'POST', body: JSON.stringify({ model: modelId }) });
    for (let i = 0; i < 100 && !events.slice(loadEvents).some((e) => e.data?.status === 'unloaded'); i++) await wait(100);
    await wait(300);
  }
  child.kill();
  await new Promise((r) => child.once('close', r));
  await pump;
  await rm(work, { recursive: true, force: true });

  // Machine paths out: the fake substitutes its own when it replays.
  // Child log lines nest JSON in JSON, so each path appears escaped to several depths.
  const escapes = (s) => [1, 2, 3].map((depth) => {
    let e = s;
    for (let i = 0; i < depth; i++) e = JSON.stringify(e).slice(1, -1);
    return e;
  }).reverse();
  const swaps = [[presetPath, '<preset>'], [bin, '<bin>'], [modelPath, '<model>'], [modelPath.replace(/\\/g, '/'), '<model>'], [modelId, '<modelId>']];
  const scrub = (v) => {
    let text = JSON.stringify(v);
    for (const [from, to] of swaps) for (const e of escapes(from)) text = text.split(e).join(to);
    return JSON.parse(text);
  };
  return scrub({
    ...result,
    boot: lines.slice(0, bootLines),
    load: lines.slice(bootLines, loadLines),
    after: lines.slice(loadLines),
    loadEvents: events.slice(0, loadEvents),
    afterEvents: events.slice(loadEvents),
  });
}

const flagModel = (flag) => {
  const at = process.argv.indexOf(flag);
  return at >= 0 ? process.argv[at + 1] : null;
};
const thinkingModel = flagModel('--thinking');
const gemmaModel = flagModel('--gemma');
const modelPath = process.argv[2]?.startsWith('--') ? null : process.argv[2];
if (!modelPath && !thinkingModel && !gemmaModel) { console.error('Usage: node scripts/recordLlamaServerFixtures.mjs [<model.gguf>] [--thinking <model.gguf>] [--gemma <model.gguf>]'); process.exit(1); }
const bin = ls.binaryPath();
if (!bin) { console.error('No bundled llama-server. Run npm run llama-server:fetch first.'); process.exit(1); }
const tag = JSON.parse(await (await import('node:fs/promises')).readFile(path.join(HERE, 'llamaServerPin.json'), 'utf8')).tag;

// One turn of a thinking model, kept apart: its thought must arrive in `reasoning_content`, never in `content`.
for (const [model, chat] of [[thinkingModel, 'thinking'], [gemmaModel, 'gemma']]) {
  if (!model) continue;
  const settings = { contextSize: 4096, gpuLayers: ls.GPU_LAYERS_AUTO, flashAttention: true, parallelRequests: 1 };
  const recorded = await scenario({ bin, modelPath: model, settings, chat });
  await mkdir(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${tag}-${chat}.json`);
  await writeFile(file, `${JSON.stringify({ tag, model: path.basename(model), applyTemplate: recorded.applyTemplate, chat: recorded.chat, chatStream: recorded.chatStream }, null, 1)}\n`);
  console.log(`Recorded ${path.relative(ROOT, file)}: ${recorded.outcome}`);
}
if (!modelPath) process.exit(0);

const listDevices = await new Promise((resolve) => {
  let out = '';
  const c = spawn(bin, ['--list-devices'], { windowsHide: true });
  c.stdout.on('data', (d) => { out += d; });
  c.stderr.on('data', (d) => { out += d; });
  c.once('close', () => resolve(out));
});
const settings = { contextSize: 4096, gpuLayers: ls.GPU_LAYERS_AUTO, flashAttention: true, parallelRequests: 2 };
const loaded = await scenario({ bin, modelPath, settings, chat: 'plain' });
// Far past any VRAM, with fit off so the server tries it as asked.
const kvFail = await scenario({ bin, modelPath, settings: { ...settings, contextSize: 1048576, gpuLayers: ls.GPU_LAYERS_MAX, parallelRequests: 1 } });
const cpu = await scenario({ bin, modelPath, settings: { ...settings, cpu: true } });
// Fit off: the buffer lines come from the one real load, with no fit trial before it.
const max = await scenario({ bin, modelPath, settings: { ...settings, gpuLayers: ls.GPU_LAYERS_MAX } });

await mkdir(OUT_DIR, { recursive: true });
const file = path.join(OUT_DIR, `${tag}.json`);
await writeFile(file, `${JSON.stringify({ tag, listDevices, scenarios: { loaded, kvFail, cpu, max } }, null, 1)}\n`);
console.log(`Recorded ${path.relative(ROOT, file)}: loaded ${loaded.outcome}, kvFail ${kvFail.outcome}, cpu ${cpu.outcome}, max ${max.outcome}`);
