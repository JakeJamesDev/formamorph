// Capture the itch.io page assets (build-assets/itch-page/) into thumbnails/itch-page/: the page
// background, the description art, and a paste page for the description. Needs a dev server:
// `npm run dev -- --port 5180`.
//
//   npm run itch-page
//   node scripts/captureItchPage.mjs --base http://localhost:5180 --only bg,art,paste
//
// Chromium is the encoder, so the script needs no image dependency of its own.
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const BASE = arg('base', 'http://localhost:5180');
const SRC = 'build-assets/itch-page';
const OUT = 'thumbnails/itch-page';
// itch rejects uploads over 3 MB and does not take WebP.
const JPEG_LIMIT = 2_900_000;
const only = arg('only', '').split(',').filter(Boolean);
const wants = (step) => !only.length || only.includes(step);

mkdirSync(OUT, { recursive: true });

// SwiftShader keeps the VRM renders identical across GPUs.
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('page error:', e.message));

if (wants('bg')) {
  await page.goto(`${BASE}/${SRC}/background.html`);
  await page.waitForFunction(() => window.__itchBackgroundReady === true, null, { timeout: 60000 });
  const [jpeg, quality] = await page.evaluate(async (limit) => {
    const i = new Image();
    i.src = await window.renderBackground();
    await i.decode();
    const c = document.createElement('canvas');
    c.width = i.width; c.height = i.height;
    c.getContext('2d').drawImage(i, 0, 0);
    for (let q = 0.95; q > 0.5; q -= 0.03) {
      const url = c.toDataURL('image/jpeg', q);
      if (url.length * 0.75 < limit) return [url.slice(url.indexOf(',') + 1), q];
    }
    throw new Error('background does not fit under the itch upload limit');
  }, JPEG_LIMIT);
  writeFileSync(`${OUT}/itch-bg.jpg`, Buffer.from(jpeg, 'base64'));
  console.log(`wrote ${OUT}/itch-bg.jpg (quality ${quality.toFixed(2)})`);
}

if (wants('art')) {
  await page.goto(`${BASE}/${SRC}/art.html`);
  await page.evaluate(() => document.fonts.ready);
  for (const name of await page.$$eval('[data-art]', (els) => els.map((e) => e.dataset.art))) {
    // Round the box so a fractional offset does not add a row (a 70px button stays 70px).
    const b = await page.locator(`[data-art="${name}"]`).boundingBox();
    const clip = { x: Math.round(b.x), y: Math.round(b.y), width: Math.round(b.width), height: Math.round(b.height) };
    await page.screenshot({ path: `${OUT}/${name}.png`, clip, omitBackground: true });
    console.log(`wrote ${OUT}/${name}.png`);
  }
}

if (wants('paste')) {
  const desc = readFileSync(`${SRC}/description.html`, 'utf8');
  const tpl = readFileSync(`${SRC}/paste.template.html`, 'utf8');
  writeFileSync(`${OUT}/paste.html`, tpl.replace('<!-- DESCRIPTION -->', desc));
  console.log(`wrote ${OUT}/paste.html`);
}

await browser.close();
