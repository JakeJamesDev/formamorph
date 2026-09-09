// Capture the title card (build-assets/title-card/) with each bundled avatar, as PNG and WebP,
// into thumbnails/. Needs a dev server: `npm run dev -- --port 5180`.
//
//   npm run title-card
//   node scripts/captureTitleCard.mjs --base http://localhost:5180 --only alt --t 2.5
//
// Chromium is the encoder, so the script needs no image dependency of its own.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const BASE = arg('base', 'http://localhost:5180');
const PAGE = `${BASE}/build-assets/title-card/`;
const OUT = 'thumbnails';
const SIZE = { width: 1920, height: 1080 };
const WEBP_QUALITY = 0.9;
const ALL = ['default', 'alt'];
const only = arg('only', '').split(',').filter(Boolean);
const wanted = only.length ? only : ALL;
const t = arg('t', '');

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: SIZE, deviceScaleFactor: 1 });

const toWebp = async (png) => {
  const data = await page.evaluate(async ([b64, quality]) => {
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const bmp = await createImageBitmap(new Blob([bin]));
    const c = document.createElement('canvas');
    c.width = bmp.width; c.height = bmp.height;
    c.getContext('2d').drawImage(bmp, 0, 0);
    const url = c.toDataURL('image/webp', quality);
    if (!url.startsWith('data:image/webp')) throw new Error('webp encoding unsupported');
    return url.slice(url.indexOf(',') + 1);
  }, [png.toString('base64'), WEBP_QUALITY]);
  return Buffer.from(data, 'base64');
};

for (const avatar of wanted) {
  const url = new URL(PAGE);
  url.searchParams.set('avatar', avatar);
  url.searchParams.set('scale', '1');
  if (t) url.searchParams.set('t', t);
  await page.goto(url.href);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => window.__titleCardReady === true, null, { timeout: 60000 });
  // One more frame so spring bones settle after the pose lands.
  await page.waitForTimeout(500);
  const png = await page.screenshot({ clip: { x: 0, y: 0, ...SIZE } });
  writeFileSync(`${OUT}/title-card-${avatar}.png`, png);
  writeFileSync(`${OUT}/title-card-${avatar}.webp`, await toWebp(png));
  console.log(`wrote ${OUT}/title-card-${avatar}.{png,webp}`);
}

await browser.close();
