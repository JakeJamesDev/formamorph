// Drives the unpacked Windows build through its preload bridge: starts the app on a throwaway root, loads a
// model, answers one chat turn, then quits. Run afterQuit.mjs next. See README.md.
// Usage: node testing/llama-server-matrix/smoke.mjs --models-dir <folder with a .gguf> [--exe release/win-unpacked/Formamorph.exe]
import { _electron as electron } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : null; };
const modelsDir = arg('models-dir');
if (!modelsDir) { console.error('Usage: node testing/llama-server-matrix/smoke.mjs --models-dir <folder> [--exe <Formamorph.exe>]'); process.exit(2); }
const exe = path.resolve(arg('exe') ?? 'release/win-unpacked/Formamorph.exe');

const app = await electron.launch({ executablePath: exe, env: { ...process.env, FORMAMORPH_ROOT: mkdtempSync(path.join(os.tmpdir(), 'fm-smoke-')) } });
let code = 1;
try {
  const page = await app.firstWindow();
  await page.waitForFunction(() => window.formamorphDesktop?.llm);
  const status = await page.evaluate(async (dir) => {
    const llm = window.formamorphDesktop.llm;
    await llm.setLocations({ externalDir: dir });
    const [model] = await llm.listInstalled();
    await llm.load(model.id ?? model.fileName);
    return llm.status();
  }, path.resolve(modelsDir));
  console.log(`engine: ${status.status}${status.error ? ` (${status.error})` : ''}, ${status.gpuBackend}, ${status.engineVramMB} MiB`);
  if (status.status === 'ready') {
    const res = await fetch(`http://127.0.0.1:${status.port}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: status.modelId, messages: [{ role: 'user', content: 'Say hi in three words.' }], max_tokens: 16 }),
    });
    const text = (await res.json())?.choices?.[0]?.message?.content ?? '';
    console.log(`chat: HTTP ${res.status} ${JSON.stringify(text)}`);
    if (res.ok && text.trim()) code = 0;
  }
} finally {
  await app.close();
}
console.log(code === 0 ? 'PASS (quit; now run afterQuit.mjs)' : 'FAIL');
process.exit(code);
