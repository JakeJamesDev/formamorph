// Capture the landing page's gallery set: 5 screens x 5 palettes x 2 themes, plus the thumbnails,
// the favicon, and the social-embed image. Writes straight into hosting/site/.
//
// Needs a dev server (`npm run dev -- --port 5180`). Gameplay loads a prepared save without AI calls.
// Palette is the `data-theme` attribute; theme is an emulated `prefers-color-scheme`, so
// every pair is pixel-aligned.
//
//   node scripts/captureSiteShots.mjs
//   node scripts/captureSiteShots.mjs --base http://localhost:5180 --only 01-library,04-settings
//   node scripts/captureSiteShots.mjs --only 02-game --verify-only --width 1600 --height 900
//   node scripts/captureSiteShots.mjs --only 02-game --scene scripts/fixtures/site-game.json
//
// The avatar screen ships the alternate VRM, which is not the tracked default. The capture serves it
// by intercepting the fetch in a context of its own, so the tracked file is never touched: writing an
// 18 MB file into public/ restarts Vite's watcher mid-run and kills the server under the capture.
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

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
const VIEWPORT = { width: Number(arg('width', '1600')), height: Number(arg('height', '900')) };
if (!Object.values(VIEWPORT).every((size) => Number.isInteger(size) && size > 0)) throw new Error('Invalid capture viewport');
// The side-panel labels and the complete turn must fit at the capture viewport.
const WEBP_QUALITY = 0.86;
const THUMB_WIDTH = 300;
const OG = { width: 1200, height: 630, quality: 0.88 };

const ALL = ['01-library', '02-game', '03-world-details', '04-settings', '05-avatar'];
const only = arg('only', '').split(',').filter(Boolean);
const wanted = new Set(only.length ? only : ALL);

const AVATAR_ALT = 'build-assets/alternate-avatar.vrm';
const SCENE = JSON.parse(readFileSync(arg('scene', 'scripts/fixtures/site-game.json'), 'utf8'));
const VERIFY_ONLY = process.argv.includes('--verify-only');

const write = (path, buf) => {
  if (VERIFY_ONLY) return;
  mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, buf);
};

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
  return page;
};

/** Sweep one screen through every palette and theme, and keep the graphite/dark frame for reuse. */
const sweep = async (page, name, verify) => {
  let hero = null;
  for (const pal of PALETTES) {
    await page.evaluate((v) => document.documentElement.setAttribute('data-theme', v), pal);
    for (const scheme of THEMES) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.waitForTimeout(600);
      await page.dismiss();
      if (verify) await verify(page);
      const png = await page.screenshot();
      write(`${OUT}/shots/${pal}/${scheme}/${name}.webp`, await encode(png));
      if (pal === 'graphite' && scheme === 'dark') hero = png;
    }
  }
  write(`${OUT}/shots/thumbs/${name}.webp`, await encode(hero, { width: THUMB_WIDTH }));
  console.log(VERIFY_ONLY ? 'verified:' : 'swept:', name);
  return hero;
};

async function prepareGame(context) {
  const world = JSON.parse(readFileSync('src/defaultworlds/drone.json', 'utf8'));
  const location = world.locations.find((item) => item.name === SCENE.location);
  const entity = world.entities.find((item) => item.name === SCENE.entity);
  if (!location || !entity || !entity.locations.includes(location.id)) throw new Error('Capture scene does not match the world');
  location.backgroundImage ||= world.locations.find((item) => item.backgroundImage)?.backgroundImage;
  const state = {
    playerStats: world.stats.map((stat) => ({ ...stat, value: stat.starting })),
    playerTraits: [], visibleEntities: [{ name: entity.name, revealed: true }], discoveredEntities: [],
    logEntries: [], gameplayText: SCENE.narration, locationId: location.id, gameTime: 3,
    characterData: null, choices: SCENE.choices, isGameStarted: true, timestamp: new Date().toISOString(),
    worldName: world.worldOverview.name, playerNotes: '', previousStateIndex: 0, stateVersion: 2,
  };
  const openingState = { ...state, gameplayText: SCENE.opening, choices: [SCENE.action], gameTime: 0, previousStateIndex: null };
  const save = {
    currentState: state, stateHistory: [openingState, state], dictionaries: world.dictionaries,
    version: JSON.parse(readFileSync('package.json', 'utf8')).version,
    messageHistory: [
      { role: 'user', content: 'START GAME' },
      { role: 'assistant', content: JSON.stringify({
        narration: SCENE.opening, choices: [SCENE.action], entities: [entity.name],
        stat_changes: [], turnId: randomUUID(),
      }) },
      { role: 'user', content: SCENE.action },
      { role: 'assistant', content: JSON.stringify({
        narration: SCENE.narration, choices: SCENE.choices, entities: [entity.name],
        stat_changes: [], turnId: randomUUID(),
      }) },
    ],
  };
  // Replace only the capture browser's dev-fixture modules; the client and tracked fixtures stay intact.
  for (const [file, data] of [['whiteRoomWorld', world], ['whiteRoomSave', save]]) {
    await context.route(`**/src/lib/devFixtures/${file}.json*`, (route) => route.fulfill({
      contentType: 'application/javascript', body: `export default ${JSON.stringify(data)};`,
    }));
  }
  await context.route('**/chat/completions*', (route) => route.abort());
}

async function verifyGame(page) {
  if ((await page.getByTestId('action-line').textContent())?.trim() !== SCENE.action) {
    throw new Error('Gameplay capture rejected: submitted action does not match the scene');
  }
  const targets = [page.getByTestId('action-line'), page.getByTestId('narration'), page.getByTestId('action-input-wrap'),
    ...SCENE.choices.map((choice) => page.getByRole('button', { name: choice, exact: true })),
    page.getByRole('tabpanel').filter({ hasText: SCENE.entity }).getByText(SCENE.entity, { exact: true })];
  for (const target of targets) {
    const problem = await target.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      let left = 0, top = 0, right = innerWidth, bottom = innerHeight;
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent), box = parent.getBoundingClientRect();
        if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) { left = Math.max(left, box.left); right = Math.min(right, box.right); }
        if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) { top = Math.max(top, box.top); bottom = Math.min(bottom, box.bottom); }
      }
      return rect.width <= 0 || rect.height <= 0 || rect.left < left - 1 || rect.right > right + 1
        || rect.top < top - 1 || rect.bottom > bottom + 1 ? `clipped: ${element.textContent?.slice(0, 90)}` : null;
    });
    if (problem) throw new Error(`Gameplay capture rejected: ${problem}`);
  }
  const tabs = page.getByRole('tab', { name: /^(Entities|Notes|Memory|Logs)/ });
  if (await tabs.count() !== 4) throw new Error('Gameplay capture rejected: missing side-panel tabs');
  const badTabs = await tabs.evaluateAll((tabs) => tabs.filter((tab) => {
    const icon = tab.querySelector('svg')?.getBoundingClientRect();
    const label = tab.querySelector('span');
    if (!icon || !label) return true;
    const range = document.createRange(); range.selectNodeContents(label);
    const lines = [...range.getClientRects()];
    return lines.length !== 1 || icon.right > lines[0].left + 1 || label.scrollWidth > label.clientWidth + 1;
  }).map((tab) => tab.textContent));
  if (badTabs.length) throw new Error(`Gameplay capture rejected: crowded tabs: ${badTabs.join(', ')}`);
}

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
    const gameContext = await newCtx();
    await prepareGame(gameContext);
    const p = await mk(gameContext);
    await p.goto(`${BASE}/#dev?view=gameViewer&fixture=whiteRoom&mode=pages`);
    await p.getByTestId('narration').waitFor();
    await p.dismiss();
    await p.getByRole('tab', { name: 'Entities', exact: true }).click();
    await p.getByRole('button', { name: SCENE.choices[0], exact: true }).waitFor();
    await p.getByTestId('action-input-wrap').locator('textarea').fill('');
    await p.getByTestId('action-input-wrap').locator('textarea').blur();
    await p.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((image) => image.decode().catch(() => {})));
    });
    gameFrame = await sweep(p, '02-game', verifyGame);
    await p.close();
    await gameContext.close();
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
  if (!VERIFY_ONLY) console.log('wrote og.jpg');
} else {
  console.log('skipped og.jpg (no 02-game frame in this run)');
}

await browser.close();
if (failures.length) {
  console.error('capture INCOMPLETE:', failures.join(' | '));
  process.exit(1);
}
console.log('capture complete');
