// Browser parity bench: runs each export's shipped graphs on its parity case in installed Chrome, on WebGPU and
// WASM, against the case's onnxruntime CPU outputs. Exits 1 unless top-k mention overlap and antecedent argmax
// agreement are 1.0 against the same graphs on CPU.
//   node testing/coref/bench/run.mjs --exports <folder of exports> --ort <onnxruntime-web package dir> [--ep webgpu,wasm] <export> [...]
import { createReadStream, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i < 0 ? fallback : args.splice(i, 2)[1]; };
const exportsDir = resolve(opt('exports', '../formamorph-training-data/coref/work/exports'));
const ortDir = resolve(opt('ort', 'node_modules/onnxruntime-web'));
const eps = opt('ep', 'webgpu,wasm').split(',');
const names = args;
if (!names.length) {
  console.error('usage: run.mjs --exports <dir> --ort <onnxruntime-web dir> <export name> [...]');
  process.exit(2);
}
const ortVersion = JSON.parse(readFileSync(join(ortDir, 'package.json'), 'utf8')).version;

const roots = { '/exports/': exportsDir, '/ort/': join(ortDir, 'dist'), '/': import.meta.dirname };
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json' };
const server = createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const prefix = Object.keys(roots).find((p) => url.startsWith(p));
  const root = roots[prefix];
  const path = normalize(join(root, url.slice(prefix.length)));
  let size;
  try {
    if (!path.startsWith(root + sep) && path !== root) throw new Error('outside');
    const st = statSync(path);
    if (!st.isFile()) throw new Error('not a file');
    size = st.size;
  } catch { res.writeHead(404).end(); return; }
  // Cross-origin isolation, so WASM can use threads when asked.
  res.writeHead(200, { 'Content-Type': types[extname(path)] ?? 'application/octet-stream', 'Content-Length': size,
    'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp', 'Cache-Control': 'no-store' });
  createReadStream(path).pipe(res);
});
await new Promise((ok) => server.listen(0, ok));
const port = server.address().port;

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu'] });
let failed = false;
console.log(`onnxruntime-web ${ortVersion}`);
for (const name of names) {
  for (const ep of eps) {
    const page = await browser.newPage();
    await page.goto(`http://localhost:${port}/bench.html?export=${encodeURIComponent(name)}&ep=${ep}`);
    let r;
    try {
      await page.waitForFunction(() => window.__result?.done || window.__result?.error, null, { timeout: 300_000, polling: 500 });
      r = await page.evaluate(() => window.__result);
      if (ep === 'webgpu') r.adapter = await page.evaluate(async () => { const a = await navigator.gpu?.requestAdapter(); return a ? `${a.info?.vendor} ${a.info?.architecture}` : null; });
    } catch (e) {
      r = { export: name, ep, error: String(e.message ?? e) };
    }
    failed ||= !r.pass;
    console.log(r.error ? `${name} ${ep}: ERROR ${r.error}` :
      `${name} ${ep}${r.adapter ? ` (${r.adapter})` : ''}: vs CPU int8 top-k ${r.reference_a.topk}, argmax ${r.reference_b.argmax}` +
      ` · vs fp32 top-k ${r.fp32_a.topk}, argmax ${r.fp32_b.argmax} · ${r.pass ? 'PASS' : 'FAIL'}`);
    console.log(JSON.stringify(r));
    await page.close();
  }
}
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
