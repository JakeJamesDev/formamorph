// Capture the landing page's screenshots: the gallery set (5 screens x 5 palettes x 2 themes, plus the
// thumbnails, the favicon, and the social-embed image) and the hero turn. Writes straight into hosting/site/.
//
// Needs a dev server (`npm run dev -- --port 5180`). Gameplay loads a prepared save without AI calls.
// The server must not have served the title card: that puts these shots in Vite's module graph, so writing one reloads the page.
// Palette is the `data-theme` attribute; theme is an emulated `prefers-color-scheme`, so
// every pair is pixel-aligned.
//
//   node scripts/captureSiteShots.mjs
//   node scripts/captureSiteShots.mjs --base http://localhost:5180 --only 01-library,04-settings
//   node scripts/captureSiteShots.mjs --only 02-game --verify-only --width 1600 --height 900
//   node scripts/captureSiteShots.mjs --only 02-game --scene scripts/fixtures/site-game.json
//
//   node scripts/captureSiteShots.mjs --only hero --base http://localhost:5181
//
// `hero` is the landing hero's Emberwatch turn from hosting/site/hero-turn.js, always 1600x900, purple, light
// and dark, into hosting/site/shots/hero/<theme>/: stats (turn and stat readouts hidden), inv-before and
// inv-after (Inventory tab without and with the new item, turn hidden), inv-full (nothing hidden, for the tour).
// shots/hero/layout.js sets `window.FM_HERO_LAYOUT`: the boxes the page draws over, stat ranges, theme colors.
// A run of `hero` alone leaves the icon and og.jpg alone.
//
// The avatar screen shows Aurelia (build-assets/alternate-avatar.vrm), not the tracked Aki. The capture serves it
// by intercepting the fetch in a context of its own, so the tracked file is never touched: writing an
// 18 MB file into public/ restarts Vite's watcher mid-run and kills the server under the capture.
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { runInNewContext } from 'node:vm';
import { assertUnclipped, prepareGame, verifyGame } from './lib/demoGame.mjs';

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

const GALLERY = ['01-library', '02-game', '03-world-details', '04-settings', '05-avatar'];
const ALL = [...GALLERY, 'hero'];
const HELP_QUESTION = arg('question', 'How do I import a world someone shared?');
const only = arg('only', '').split(',').filter(Boolean);
const wanted = new Set(only.length ? only : ALL);

const HERO_WORLD = 'src/defaultworlds/emberwatch.json';
const HERO_PALETTE = 'purple';
const HERO_VIEWPORT = { width: 1600, height: 900 };
// The new item lands between the gear and the coin.
const HERO_GEAR = [['Healing Draught', 1], ['Hooded Lantern', 1]];
const HERO_COIN = [['Silver', 3], ['Copper', 12]];
const heroTurn = () => {
  const sandbox = { window: {} };
  runInNewContext(readFileSync('hosting/site/hero-turn.js', 'utf8'), sandbox);
  return sandbox.window.FM_HERO_TURN;
};

const AVATAR_ALT = 'build-assets/alternate-avatar.vrm';

// The viewer sets no expression, so the served copy holds the relaxed smile as its face's resting morph. Three-vrm would zero a bound morph, so the preset goes.
function smiling(glb) {
  const length = glb.readUInt32LE(12);
  const json = JSON.parse(glb.subarray(20, 20 + length).toString('utf8'));
  const presets = json.extensions.VRMC_vrm.expressions.preset;
  const { index } = presets.relaxed.morphTargetBinds[0];
  const face = json.meshes[json.nodes.find((node) => node.name === 'Face').mesh];
  face.weights = face.extras.targetNames.map((_, i) => (i === index ? 1 : 0));
  delete presets.relaxed;
  const text = Buffer.from(JSON.stringify(json), 'utf8');
  const chunk = Buffer.concat([text, Buffer.alloc((4 - (text.length % 4)) % 4, 0x20)]);
  const bin = glb.subarray(20 + length);
  const head = Buffer.alloc(20);
  head.write('glTF', 0, 'latin1');
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(20 + chunk.length + bin.length, 8);
  head.writeUInt32LE(chunk.length, 12);
  head.write('JSON', 16, 'latin1');
  return Buffer.concat([head, chunk, bin]);
}
const SCENE = JSON.parse(readFileSync(arg('scene', 'scripts/fixtures/site-game.json'), 'utf8'));
const VERIFY_ONLY = process.argv.includes('--verify-only');

const write = (path, buf) => {
  if (VERIFY_ONLY) return;
  mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, buf);
};

const browser = await chromium.launch();
const newCtx = async (viewport = VIEWPORT) => {
  const c = await browser.newContext({ viewport });
  // A first boot with only the legacy keys migrates them into an active "Custom" endpoint preset,
  // which sidesteps the read-only fields on the Default preset.
  await c.addInitScript(([url, model]) => {
    if (!localStorage.getItem('FORMAMORPH_promptPresets') && !localStorage.getItem('FORMAMORPH_textEndpointPresets')) {
      localStorage.setItem('FORMAMORPH_endpointUrl', url);
      localStorage.setItem('FORMAMORPH_modelName', model);
    }
    // The Help tab note is a two-page tour, so the Got It loop can't close it.
    if (!localStorage.getItem('formamorph.tutorialsSeen')) localStorage.setItem('formamorph.tutorialsSeen', JSON.stringify(['help-tab']));
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

/** One hero state in a context of its own: the fixture modules are cached per context, so a reload keeps the old save. */
const openHero = async (scene, scheme, tab) => {
  const context = await newCtx(HERO_VIEWPORT);
  await prepareGame(context, scene, HERO_WORLD);
  const page = await mk(context);
  await page.emulateMedia({ colorScheme: scheme });
  await page.goto(`${BASE}/#dev?view=gameViewer&fixture=whiteRoom&mode=pages&tab=${tab}`);
  await page.getByTestId('narration').waitFor({ timeout: 90000 });
  await page.getByRole('button', { name: scene.choices[0], exact: true }).waitFor();
  await page.waitForTimeout(1500); // the background item passes settle
  await page.dismiss();
  await page.getByRole('tab', { name: 'Entities', exact: true }).click();
  await page.getByTestId('action-input-wrap').locator('textarea').fill('');
  await page.getByTestId('action-input-wrap').locator('textarea').blur();
  await page.evaluate((palette) => document.documentElement.setAttribute('data-theme', palette), HERO_PALETTE);
  await page.mouse.move(HERO_VIEWPORT.width / 2, 5);
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.waitForTimeout(600);
  return page;
};

const assertNoDialog = async (page) => {
  const dialog = page.getByRole('dialog');
  if (await dialog.count()) throw new Error(`Hero capture rejected: a dialog is open: ${(await dialog.first().innerText()).slice(0, 90)}`);
};

/** Throws unless the turn's text and choices, and every extra target, are on screen and unclipped. */
const verifyHeroTurn = async (page, scene, extraTargets = []) => {
  await assertNoDialog(page);
  if ((await page.getByTestId('action-line').textContent())?.trim() !== scene.action) {
    throw new Error('Hero capture rejected: submitted action does not match the turn');
  }
  const narration = (await page.getByTestId('narration').innerText()).replace(/\s+/g, ' ').trim();
  if (narration !== scene.narration.replace(/\s+/g, ' ').trim()) throw new Error('Hero capture rejected: narration does not match the turn');
  await assertUnclipped([page.getByTestId('action-line'), page.getByTestId('narration'),
    ...scene.choices.map((choice) => page.getByTestId('choice-rows').getByRole('button', { name: choice, exact: true })), ...extraTargets],
  'Hero capture');
};

const newItemRow = (page, name) => page.getByRole('tabpanel').getByRole('listitem').filter({ has: page.getByText(name, { exact: true }) });

// A persona stat row's parts (StatRow.tsx), shared by the measure and the hide passes.
const STAT_PARTS = { row: 'div.mb-2', track: '.rounded-full.bg-secondary', value: ':scope > div > div > span', descriptor: 'p' };

/** The band a value falls in, by the app's rule: the first threshold, ascending, at or above it. */
const bandAt = (stat, value) => [...(stat.descriptors ?? [])].sort((a, b) => a.threshold - b.threshold)
  .find((band) => value <= (stat.thresholdUnit === 'raw' ? band.threshold : stat.min + (band.threshold / 100) * (stat.max - stat.min)))
  ?.description ?? '';

/** Boxes and colors the page draws the turn over, in capture pixels. */
const measureHero = (page, scene, statRanges) => page.evaluate(([choices, statRanges, parts]) => {
  const box = (el) => { const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; };
  const font = (el) => {
    const s = getComputedStyle(el);
    return { family: s.fontFamily, size: parseFloat(s.fontSize), line: parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.5, weight: s.fontWeight };
  };
  const color = (el) => getComputedStyle(el).color;
  const token = (name) => `hsl(${getComputedStyle(document.documentElement).getPropertyValue(name).trim()})`;
  const textLeaf = (root, text) => [...root.querySelectorAll('*')].find((el) => el.childElementCount === 0 && el.textContent.trim() === text);
  const narration = document.querySelector('[data-testid=narration]');
  const paragraphs = [...narration.querySelectorAll('p')];
  const quote = narration.querySelector('.dialogue-quote');
  if (!quote) throw new Error('Hero capture rejected: the narration paints no dialogue');
  const actionLine = document.querySelector('[data-testid=action-line]');
  const actionText = [...actionLine.querySelectorAll('*')].find((el) => el.childElementCount === 0 && el.textContent.trim());
  const rows = [...document.querySelectorAll('[data-testid=choice-rows] button')];
  const choiceBoxes = choices.map((text) => {
    const row = rows.find((button) => button.textContent.trim() === text);
    const label = textLeaf(row, text);
    return { text, row: box(row), box: box(label), font: font(label) };
  });
  const statsRegion = document.querySelector('[data-testid=persona-stats]');
  const rowParts = [...statsRegion.querySelectorAll(parts.row)].filter((row) => row.querySelector(parts.track)).map((row) => ({
    name: row.querySelector('span').textContent.trim(), value: row.querySelector(parts.value), track: row.querySelector(parts.track),
    descriptor: row.querySelector(parts.descriptor),
  }));
  const stats = rowParts.map(({ name, value, track, descriptor }) => ({
    name, ...statRanges[name], valueText: value.textContent.trim(), value: box(value), valueFont: font(value), bar: box(track),
    descriptor: descriptor?.textContent.trim() ?? '', descriptorBox: descriptor ? box(descriptor) : null, descriptorFont: descriptor ? font(descriptor) : null,
  }));
  const [first] = rowParts;
  const panel = document.querySelector('[role=tablist][aria-label=Status]').closest('.rounded-lg.border');
  return {
    layout: { action: { box: box(actionText), font: font(actionText) }, narration: { box: box(narration), font: font(paragraphs[0] ?? narration),
      paragraphs: paragraphs.map(box) }, choices: choiceBoxes, stats, panel: box(panel) },
    colors: { text: color(paragraphs[0] ?? narration), dialogue: color(quote), action: color(actionText), choice: color(textLeaf(rows[0], choices[0])),
      value: color(first.value), fill: getComputedStyle(first.track.firstElementChild).backgroundColor,
      descriptor: color(first.descriptor ?? statsRegion), success: token('--success'), destructive: token('--destructive') },
  };
}, [scene.choices, statRanges, STAT_PARTS]);

/** Hides the turn and, unless `keepStats`, the stat readouts. Hidden elements keep their space. */
const hideTurn = (page, scene, keepStats) => page.evaluate(([choices, keepStats, parts]) => {
  const hide = (el) => { if (el) el.style.visibility = 'hidden'; };
  [...document.querySelector('[data-testid=narration]').children].forEach(hide);
  [...document.querySelector('[data-testid=action-line]').querySelectorAll('*')].filter((el) => el.childElementCount === 0).forEach(hide);
  for (const row of document.querySelectorAll('[data-testid=choice-rows] button')) {
    if (choices.includes(row.textContent.trim())) [...row.querySelectorAll('*')].filter((el) => el.childElementCount === 0 && el.textContent.trim()).forEach(hide);
  }
  if (keepStats) return;
  for (const row of document.querySelector('[data-testid=persona-stats]').querySelectorAll(parts.row)) {
    const track = row.querySelector(parts.track);
    if (!track) continue;
    hide(row.querySelector(parts.value));
    hide(track.firstElementChild);
    hide(row.querySelector(parts.descriptor));
  }
}, [scene.choices, keepStats, STAT_PARTS]);

const captureHero = async () => {
  const turn = heroTurn();
  const world = JSON.parse(readFileSync(HERO_WORLD, 'utf8'));
  // The page draws the end readout and descriptor too, since the stats frame hides them.
  const statRanges = Object.fromEntries(world.stats.map((stat) => {
    const start = stat.starting ?? stat.value;
    const change = turn.stats.find((item) => item.name === stat.name)?.change;
    return [stat.name, { min: stat.min, max: stat.max, start, startDescriptor: bandAt(stat, start),
      ...(change !== undefined && { end: start + change, endDescriptor: bandAt(stat, start + change) }) }];
  }));
  const scene = { location: 'The Cinder and Crown', entity: 'Wenna Tallow', opening: 'Firelight and noise fill the Cinder and Crown.',
    action: turn.action, narration: turn.narration, choices: turn.choices, items: [...HERO_GEAR, ...HERO_COIN], noGlobalStats: true };
  const withItem = { ...scene, items: [...HERO_GEAR, [turn.newItem, 1], ...HERO_COIN] };
  const out = `${OUT}/shots/hero`;
  const layout = { size: { w: HERO_VIEWPORT.width, h: HERO_VIEWPORT.height }, colors: {} };
  let geometry = null;
  const shoot = async (page, scheme, frame) => {
    await assertNoDialog(page);
    write(`${out}/${scheme}/${frame}.webp`, await encode(await page.screenshot()));
  };
  for (const scheme of THEMES) {
    let page = await openHero(scene, scheme, 'stats');
    const statTargets = turn.stats.map((change) => page.getByTestId('persona-stats').locator(STAT_PARTS.row).filter({ hasText: change.name }));
    await verifyHeroTurn(page, scene, statTargets);
    const measured = await measureHero(page, scene, statRanges);
    const drift = measured.layout.stats.find((stat) => stat.descriptor !== stat.startDescriptor);
    if (drift) throw new Error(`Hero capture rejected: ${drift.name} shows "${drift.descriptor}", the band rule gives "${drift.startDescriptor}"`);
    layout.colors[scheme] = measured.colors;
    await hideTurn(page, scene, false);
    await shoot(page, scheme, 'stats');
    await page.context().close();

    page = await openHero(scene, scheme, 'inventory');
    await verifyHeroTurn(page, scene);
    if (await newItemRow(page, turn.newItem).count()) throw new Error('Hero capture rejected: the new item is already in the bag');
    await hideTurn(page, scene, true);
    await shoot(page, scheme, 'inv-before');
    await page.context().close();

    page = await openHero(withItem, scheme, 'inventory');
    await verifyHeroTurn(page, scene, [newItemRow(page, turn.newItem)]);
    const newItem = await newItemRow(page, turn.newItem).evaluate((row) => {
      const b = row.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height };
    });
    // One layout serves both themes, so they must lay out alike.
    const themeGeometry = { ...measured.layout, newItem };
    if (geometry && JSON.stringify(geometry) !== JSON.stringify(themeGeometry)) throw new Error(`Hero capture rejected: ${scheme} lays out differently from light`);
    geometry = themeGeometry;
    await shoot(page, scheme, 'inv-full');
    await hideTurn(page, scene, true);
    await shoot(page, scheme, 'inv-after');
    await page.context().close();
    console.log(VERIFY_ONLY ? 'verified:' : 'captured:', `hero ${scheme}`);
  }
  write(`${out}/layout.js`, `// Written by scripts/captureSiteShots.mjs --only hero.\nwindow.FM_HERO_LAYOUT = ${JSON.stringify({ ...layout, ...geometry }, null, 1)};\n`);
};

let gameFrame = null;
const failures = [];
try {
  if (wanted.has('01-library')) {
    // Morphie answers one live question over the library, so this scene needs the capture endpoint.
    const p = await mk();
    await p.goto(`${BASE}/#dev?view=mainMenu`);
    await p.waitForTimeout(12000); // first boot seeds the bundled worlds into IndexedDB
    await p.dismiss();
    await p.keyboard.press('F1');
    const ask = p.getByRole('textbox', { name: 'Ask a Question' });
    await ask.waitFor();
    await p.waitForTimeout(2000); // the window's open animation; a fill during it is dropped
    await ask.fill(HELP_QUESTION);
    if ((await ask.inputValue()) !== HELP_QUESTION) throw new Error('Library capture: the question did not reach the Ask field');
    await ask.press('Enter');
    // Done = the log is idle and holds more than the question's wait line.
    await p.waitForFunction(() => {
      const log = document.querySelector('[role="log"][aria-label="Conversation"]');
      return log?.getAttribute('aria-busy') === 'false' && (log.textContent ?? '').length > 200;
    }, null, { timeout: 180000 });
    await p.mouse.move(VIEWPORT.width / 2, 20);
    await p.waitForTimeout(4000); // the reveal finishes and the pill fades
    await p.clickIfVisible('No Thanks'); // the Semantic Search offer covers the answer
    await p.waitForTimeout(800);
    await sweep(p, '01-library');
    await p.close();
  }

  if (wanted.has('03-world-details')) {
    const p = await mk();
    await p.goto(`${BASE}/#dev?view=mainMenu`);
    await p.waitForTimeout(12000);
    await p.dismiss();
    await p.getByText('Veilwood', { exact: true }).first().click();
    await p.waitForTimeout(1800);
    await sweep(p, '03-world-details');
    await p.close();
  }

  if (wanted.has('02-game')) {
    const gameContext = await newCtx();
    await prepareGame(gameContext, SCENE);
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
    gameFrame = await sweep(p, '02-game', (page) => verifyGame(page, SCENE));
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
    const alt = smiling(readFileSync(AVATAR_ALT));
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

  if (wanted.has('hero')) await captureHero();
} catch (error) {
  // Report and carry on to the derived files, so one flaky screen does not throw away the rest.
  failures.push(String(error).split(/\r?\n/)[0]);
}

if (GALLERY.some((name) => wanted.has(name))) {
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
}

await browser.close();
if (failures.length) {
  console.error('capture INCOMPLETE:', failures.join(' | '));
  process.exit(1);
}
console.log('capture complete');
