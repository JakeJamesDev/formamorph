// Capture the landing page's gallery set: 5 screens x 5 palettes x 2 themes, plus the thumbnails,
// the favicon, and the social-embed image. Writes straight into hosting/site/.
//
// Needs a dev server (`npm run dev -- --port 5180`) and, for the in-game screen, a reachable text
// endpoint. Palette is the `data-theme` attribute; theme is an emulated `prefers-color-scheme`, so
// every pair is pixel-aligned.
//
//   node scripts/captureSiteShots.mjs
//   node scripts/captureSiteShots.mjs --base http://localhost:5180 --only 01-library,04-settings
//
// The avatar screen ships the alternate VRM, which is not the tracked default. The capture serves it
// by intercepting the fetch in a context of its own, so the tracked file is never touched: writing an
// 18 MB file into public/ restarts Vite's watcher mid-run and kills the server under the capture.
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const BASE = arg('base', 'http://localhost:5180');
const OUT = 'hosting/site';
const ENDPOINT = process.env.CAPTURE_ENDPOINT ?? 'https://api.lyonade.net';
const MODEL = process.env.CAPTURE_MODEL ?? 'default';
const PALETTES = ['graphite', 'purple', 'forest', 'rose', 'monochrome'];
const THEMES = ['light', 'dark'];
const VIEWPORT = { width: 1280, height: 720 };
// The gallery renders ~1050 CSS px wide, so 1280 covers a 1x display outright and most of a 2x one.
const WEBP_QUALITY = 0.86;
const THUMB_WIDTH = 300;
const OG = { width: 1200, height: 630, quality: 0.88 };

const ALL = ['01-library', '02-game', '03-world-details', '04-settings', '05-avatar'];
const only = arg('only', '').split(',').filter(Boolean);
const wanted = new Set(only.length ? only : ALL);

const AVATAR_ALT = 'build-assets/alternate-avatar.vrm';

const write = (path, buf) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, buf); };

const browser = await chromium.launch();
const newCtx = async () => {
  const c = await browser.newContext({ viewport: VIEWPORT });
  // A first boot with only the legacy keys migrates them into an active "Custom" endpoint preset,
  // which sidesteps the read-only fields on the Default preset.
  await c.addInitScript(([url, model]) => {
    if (!localStorage.getItem('FORMAMORPH_promptPresets') && !localStorage.getItem('FORMAMORPH_textEndpointPresets')) {
      localStorage.setItem('FORMAMORPH_endpointUrl', url);
      localStorage.setItem('FORMAMORPH_modelName', model);
    }
  }, [ENDPOINT, MODEL]);
  return c;
};
const ctx = await newCtx();

// Chromium is the encoder, so the script needs no image dependency of its own.
const encoder = await browser.newPage();
await encoder.goto('about:blank');
const encode = async (png, { type = 'image/webp', quality = WEBP_QUALITY, width = 0, crop = null } = {}) => {
  const data = await encoder.evaluate(async ([b64, type, quality, width, crop]) => {
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const bmp = await createImageBitmap(new Blob([bin]));
    const scale = width ? width / bmp.width : 1;
    const c = document.createElement('canvas');
    if (crop) {
      c.width = crop.width; c.height = crop.height;
      // Cover: fill the frame, then centre what does not fit.
      const s = Math.max(crop.width / bmp.width, crop.height / bmp.height);
      const w = bmp.width * s, h = bmp.height * s;
      c.getContext('2d').drawImage(bmp, (crop.width - w) / 2, (crop.height - h) / 2, w, h);
    } else {
      c.width = Math.round(bmp.width * scale);
      c.height = Math.round(bmp.height * scale);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    }
    const url = c.toDataURL(type, quality);
    if (!url.startsWith(`data:${type}`)) throw new Error(`${type} encoding unsupported`);
    return url.slice(url.indexOf(',') + 1);
  }, [png.toString('base64'), type, quality, width, crop]);
  return Buffer.from(data, 'base64');
};

const mk = async (context = ctx) => {
  const page = await context.newPage();
  page.clickIfVisible = async (name) => {
    const b = page.getByRole('button', { name }).first();
    if (await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); return true; }
    return false;
  };
  // Onboarding popovers reappear per screen, so dismissing is a loop, not a single pass.
  page.dismiss = async () => {
    for (let i = 0; i < 6; i++) {
      let hit = false;
      for (const n of ['Got It', 'Dismiss', 'Continue anyway']) hit = (await page.clickIfVisible(n)) || hit;
      if (!hit) break;
      await page.waitForTimeout(500);
    }
  };
  page.closeDialogs = async () => {
    for (let i = 0; i < 4; i++) {
      const dlg = page.locator('[role="dialog"]').last();
      if (!(await dlg.isVisible().catch(() => false))) break;
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      if (!(await dlg.isVisible().catch(() => false))) break;
      const close = dlg.getByRole('button', { name: /close/i }).first();
      if (await close.isVisible().catch(() => false)) await close.click().catch(() => {});
      else { const b = await dlg.boundingBox(); if (b) await page.mouse.click(b.x + b.width - 18, b.y + 18); }
      await page.waitForTimeout(700);
    }
  };
  return page;
};

/** Sweep one screen through every palette and theme, and keep the graphite/dark frame for reuse. */
const sweep = async (page, name) => {
  let hero = null;
  for (const pal of PALETTES) {
    await page.evaluate((v) => document.documentElement.setAttribute('data-theme', v), pal);
    for (const scheme of THEMES) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.waitForTimeout(600);
      await page.dismiss();
      const png = await page.screenshot();
      write(`${OUT}/shots/${pal}/${scheme}/${name}.webp`, await encode(png));
      if (pal === 'graphite' && scheme === 'dark') hero = png;
    }
  }
  write(`${OUT}/shots/thumbs/${name}.webp`, await encode(hero, { width: THUMB_WIDTH }));
  console.log('swept:', name);
  return hero;
};

/** Give every drone location the one authored backdrop, in the seeded copy only. */
const patchBackdrops = (page) => page.evaluate(() => new Promise((res, rej) => {
  const req = indexedDB.open('worldsDB');
  req.onsuccess = () => {
    const st = req.result.transaction(['worlds'], 'readwrite').objectStore('worlds');
    const g = st.get('drone');
    g.onsuccess = () => {
      const rec = g.result;
      if (!rec) return rej('drone not seeded yet');
      const src = (rec.data.locations || []).find((l) => l.backgroundImage);
      if (!src) return rej('no background source');
      let n = 0;
      for (const l of rec.data.locations) if (!l.backgroundImage) { l.backgroundImage = src.backgroundImage; n++; }
      rec.dirty = true; // keeps the auto-reseed from reverting it on a later launch
      st.put(rec).onsuccess = () => res(`patched ${n} locations`);
    };
    g.onerror = () => rej('get failed');
  };
  req.onerror = () => rej('open failed');
}));

let gameFrame = null;
const failures = [];
try {
  if (wanted.has('01-library') || wanted.has('03-world-details')) {
    const p = await mk();
    await p.goto(`${BASE}/#dev?view=mainMenu`);
    await p.waitForTimeout(12000); // first boot seeds the bundled worlds into IndexedDB
    await p.dismiss();
    if (wanted.has('01-library')) await sweep(p, '01-library');
    if (wanted.has('03-world-details')) {
      await p.getByText('Veilwood', { exact: true }).first().click();
      await p.waitForTimeout(1800);
      await sweep(p, '03-world-details');
    }
    await p.close();
  }

  if (wanted.has('02-game')) {
    const p = await mk();
    p.on('response', (r) => { if (r.url().includes('chat/completions')) console.log('AI response <-', r.status()); });
    await p.goto(`${BASE}/#dev?view=mainMenu`);
    await p.waitForTimeout(8000);
    await p.dismiss();
    console.log('backdrop patch:', await patchBackdrops(p));
    await p.getByText('Reincarnated to Another World as a Cute Assault Drone', { exact: false }).first().click();
    await p.waitForTimeout(1500);
    await p.getByRole('button', { name: 'Quick Start' }).click();
    await p.waitForTimeout(4000);
    await p.closeDialogs();
    // The opening narration fires on its own; wait for the choices it ends with.
    let nudged = false;
    for (let i = 0; i < 60; i++) {
      await p.waitForTimeout(3000);
      await p.dismiss();
      const n = await p.locator('button', { hasText: /^I / }).count().catch(() => 0);
      if (n >= 2) { console.log('choices up at tick', i); break; }
      if (i === 6 && !nudged) {
        const input = p.locator('textarea').last();
        if (await input.isVisible().catch(() => false)) { await input.click().catch(() => {}); await p.keyboard.press('Enter'); nudged = true; }
      }
    }
    await p.waitForTimeout(2500);
    gameFrame = await sweep(p, '02-game');
    await p.close();
  }

  if (wanted.has('04-settings')) {
    const p = await mk();
    await p.goto(`${BASE}/#dev?modal=settings&tab=display`);
    await p.waitForTimeout(9000);
    await p.dismiss();
    await sweep(p, '04-settings');
    await p.close();
  }

  if (wanted.has('05-avatar')) {
    // Its own context, because the seed happens once per IndexedDB: a page sharing the earlier
    // context would already hold the tracked avatar and never re-fetch.
    const avatarCtx = await newCtx();
    const alt = readFileSync(AVATAR_ALT);
    await avatarCtx.route('**/default-avatar.vrm', (route) =>
      route.fulfill({ body: alt, contentType: 'application/octet-stream' }));
    const p = await mk(avatarCtx);
    await p.goto(`${BASE}/#dev?modal=avatar`);
    await p.waitForTimeout(11000);
    await p.dismiss();
    const anim = p.getByRole('checkbox', { name: /animate/i });
    if (await anim.isVisible().catch(() => false)) { await anim.uncheck().catch(() => {}); await p.waitForTimeout(1500); }
    await sweep(p, '05-avatar');
    await p.close();
    await avatarCtx.close();
  }
} catch (error) {
  // Report and carry on to the derived files, so one flaky screen does not throw away the rest.
  failures.push(String(error).split(/\r?\n/)[0]);
}

// The favicon and hero logo reuse the app icon at the size the page actually paints it.
write(`${OUT}/icon.png`, await encode(readFileSync('public/icon.png'), { type: 'image/png', width: 256 }));

// The social card: one gallery screenshot, cover-cropped to the 1.91:1 frame the platforms expect.
const ogSource = gameFrame ?? (existsSync(`${OUT}/shots/graphite/dark/02-game.webp`)
  ? readFileSync(`${OUT}/shots/graphite/dark/02-game.webp`)
  : null);
if (ogSource) {
  write(`${OUT}/og.jpg`, await encode(ogSource, { type: 'image/jpeg', quality: OG.quality, crop: OG }));
  console.log('wrote og.jpg');
} else {
  console.log('skipped og.jpg (no 02-game frame in this run)');
}

await browser.close();
if (failures.length) {
  console.error('capture INCOMPLETE:', failures.join(' | '));
  process.exit(1);
}
console.log('capture complete');
