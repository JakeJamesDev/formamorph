// Usage: node capture-thumbnail.mjs <in.vrm> <out.png> [--server http://localhost:5180] [--meta 0|1] [--size 512x768]
// Renders a .vrm to a PNG with the app's framing on an opaque white background.
// Needs a running Vite dev server for this checkout (it serves src/lib/vrmThumbnail.ts).
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const [input, output] = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
if (!input || !output) {
  console.error('Usage: node capture-thumbnail.mjs <in.vrm> <out.png> [--server URL] [--meta 0|1] [--size WxH]');
  process.exit(2);
}
const server = flag('server', 'http://localhost:5180');
const meta = flag('meta', '1');
const [w, h] = flag('size', '512x768').split('x').map(Number);
const body = readFileSync(resolve(input));

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
try {
  const context = await browser.newContext();
  await context.route('**/capture-input.vrm', (r) => r.fulfill({ body, contentType: 'application/octet-stream' }));
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(`${server}/docs-internal/specs/release-avatar-license/tools/capture-thumbnail.html`);
  await page.waitForFunction('window.ready === true', { timeout: 60000 });
  const dataUrl = await page.evaluate(([u, m, pw, ph]) => window.capture(u, m, pw, ph), ['/capture-input.vrm', meta, w, h]);
  if (!dataUrl) throw new Error('Render failed: unreadable model or no WebGL.');
  writeFileSync(resolve(output), Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log(`Wrote ${output}`);
} finally {
  await browser.close();
}
