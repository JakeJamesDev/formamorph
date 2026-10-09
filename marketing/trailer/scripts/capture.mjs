#!/usr/bin/env node
// Poses the app screens listed in captures.json through the dev-router and writes one PNG per shot into
// public/shots/. With --diff it captures to .capture-diff/ instead and reports each shot whose pixels
// differ from the committed PNG.
//
//   npm run capture
//   npm run capture -- --only game
//   npm run capture:diff
//
// It starts its own Vite server from the repo root, with file watching off so a peer's edit never reloads
// a capture mid-run, and stops it at the end. The port is its own (default 5188, or --port / CAPTURE_PORT).
// Playwright comes from the repo root's node_modules, which Node finds above this package.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareGame, verifyGame } from '../../../scripts/lib/demoGame.mjs';
import { setups } from './captureSetups.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(packageRoot, '../..');

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const DIFF = process.argv.includes('--diff');
const PORT = Number(arg('port', process.env.CAPTURE_PORT ?? '5188'));
const only = arg('only', '').split(',').filter(Boolean);

const list = JSON.parse(readFileSync(path.join(packageRoot, 'captures.json'), 'utf8'));
const unknown = only.filter((id) => !list.shots.some((shot) => shot.id === id));
if (unknown.length) throw new Error(`Unknown shot: ${unknown.join(', ')}`);
// A deferred shot is listed for the record and belongs to a later ticket. Only `--only` runs it.
const shots = list.shots.filter((shot) => (only.length ? only.includes(shot.id) : !shot.deferred));
const readScene = (file) => JSON.parse(readFileSync(path.join(repoRoot, file), 'utf8'));
const sceneOf = (shot) => readScene(shot.scene ?? list.demo.scene);

const committedDir = path.join(packageRoot, 'public/shots');
const outDir = DIFF ? path.join(packageRoot, '.capture-diff') : committedDir;
mkdirSync(outDir, { recursive: true });

const listening = (port, host) => new Promise((resolve) => {
  const socket = net.connect(port, host);
  socket.once('connect', () => { socket.destroy(); resolve(true); });
  socket.once('error', () => resolve(false));
});
const portInUse = async (port) => (await Promise.all(['127.0.0.1', '::1'].map((host) => listening(port, host)))).some(Boolean);

/** Starts Vite on its own port with watching off. Rejects if Vite exits before it answers. */
async function startServer() {
  // A busy port may hold someone's dev server, and a capture against it would follow their edits.
  if (await portInUse(PORT)) throw new Error(`Port ${PORT} is in use. Pass --port with a free one.`);
  const vitePackage = createRequire(path.join(repoRoot, 'package.json')).resolve('vite/package.json');
  const viteBin = path.join(path.dirname(vitePackage), 'bin/vite.js');
  const child = spawn(process.execPath, [viteBin, '--port', String(PORT), '--strictPort'], {
    cwd: repoRoot,
    env: { ...process.env, BASELINE_NO_WATCH: '1' },
    stdio: ['ignore', 'ignore', 'pipe'],
    windowsHide: true,
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const exited = new Promise((_, reject) => child.once('exit', (code) => reject(new Error(`Vite exited with code ${code}\n${stderr}`))));
  const url = `http://localhost:${PORT}`;
  const answered = (async () => {
    for (let i = 0; i < 240; i++) {
      if (await fetch(url).then((r) => r.ok, () => false)) return;
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error('Vite did not answer within 2 minutes');
  })();
  try {
    await Promise.race([answered, exited]);
  } catch (error) {
    child.kill();
    throw error;
  }
  exited.catch(() => {});
  return { url, stop: () => child.kill() };
}

async function newContext(browser, shot) {
  const context = await browser.newContext({
    viewport: shot.viewport,
    deviceScaleFactor: shot.scale,
    colorScheme: shot.theme,
    reducedMotion: 'reduce',
  });
  await context.clock.setFixedTime(new Date(list.demo.time));
  // No live events: a running contest raises a modal poster over the Main Menu, and it changes by the day.
  await context.route(/\/events(\/active)?(\?|$)/, (route) => route.fulfill({ json: { data: [] } }));
  await context.addInitScript((seed) => {
    // Never contacted: a non-empty endpoint only keeps the AI setup gate shut.
    localStorage.setItem('FORMAMORPH_introSeen', 'true');
    localStorage.setItem('FORMAMORPH_useCustomEndpoint', 'true');
    localStorage.setItem('FORMAMORPH_endpointUrl', 'http://127.0.0.1:9/v1/chat/completions');
    localStorage.setItem('FORMAMORPH_apiToken', 'capture');
    localStorage.setItem('FORMAMORPH_modelName', 'capture-model');
    localStorage.setItem('formamorph.tutorialsSeen', JSON.stringify(['help-tab']));
    // A seeded PRNG (mulberry32), so anything the app draws at random draws the same on every run.
    let a = seed >>> 0;
    Math.random = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }, list.demo.seed);
  for (const name of shot.setup ?? []) {
    if (!setups[name]) throw new Error(`Unknown setup "${name}" in shot ${shot.id}`);
    await setups[name](context);
  }
  if (shot.kind === 'game') await prepareGame(context, sceneOf(shot), list.demo.world);
  return context;
}

/** Runs a shot's `steps` after the screen is up. Each step is one key of captures.json's step list. */
async function runSteps(page, steps) {
  for (const step of steps) {
    if (step.editWorld) {
      // The router's modal route opens a blank draft, so load the stored world into the editor.
      // The bundled worlds seed in the background on first boot, so wait for this one to land.
      let id;
      for (let i = 0; i < 120 && !id; i++) {
        id = await page.evaluate(async (name) => (await window.__fmDev.listWorlds()).find((world) => world.name === name)?.id, step.editWorld);
        if (!id) await page.waitForTimeout(500);
      }
      if (!id) throw new Error(`No stored world "${step.editWorld}" after 60 s`);
      await page.evaluate((worldId) => window.__fmDev.editWorld(worldId), id);
      await page.getByText(step.editWorld, { exact: true }).first().waitFor();
    } else if (step.click) {
      await page.getByText(step.click, { exact: true }).first().click();
    } else if (step.link) {
      await page.getByRole('link', { name: new RegExp(step.link) }).first().click();
    } else if (step.uncheck) {
      const box = page.getByRole('checkbox', { name: new RegExp(step.uncheck, 'i') });
      if (await box.isVisible().catch(() => false)) await box.uncheck();
    } else if (step.ask) {
      await page.keyboard.press('F1');
      const field = page.getByRole('textbox', { name: 'Ask a Question' });
      await field.waitFor();
      await page.waitForTimeout(2000); // the window's open animation drops a fill made during it
      await field.fill(step.ask);
      await field.press('Enter');
      await page.waitForFunction(() => {
        const log = document.querySelector('[role="log"][aria-label="Conversation"]');
        return log?.getAttribute('aria-busy') === 'false' && (log.textContent ?? '').length > 150;
      }, null, { timeout: 60000 });
      await page.mouse.move(0, 0);
      await page.waitForTimeout(4000); // the reveal finishes and the pill fades
    } else if (step.wait) {
      await page.waitForTimeout(step.wait);
    } else {
      throw new Error(`Unknown step ${JSON.stringify(step)}`);
    }
    await page.waitForTimeout(400);
  }
}

/** Onboarding popovers reappear per screen, so dismissing is a loop, not a single pass. */
async function dismiss(page) {
  for (let i = 0; i < 6; i++) {
    let hit = false;
    for (const name of ['Got It', 'Dismiss', 'Continue anyway']) {
      const button = page.getByRole('button', { name }).first();
      if (await button.isVisible().catch(() => false)) { await button.click().catch(() => {}); hit = true; }
    }
    if (!hit) break;
    await page.waitForTimeout(500);
  }
}

async function capture(browser, shot) {
  const scene = sceneOf(shot);
  const context = await newContext(browser, shot);
  try {
    const page = await context.newPage();
    await page.goto(`http://localhost:${PORT}/`);
    await page.waitForFunction(() => '__fmDev' in window);
    await page.evaluate(([view, opts]) => window.__fmDev.goto(view, opts), [shot.route.view, shot.route]);
    const { text, testId, role, name } = shot.ready;
    const target = text ? page.getByText(text, { exact: true }).first() : testId ? page.getByTestId(testId) : page.getByRole(role, { name }).first();
    await target.waitFor();
    await page.evaluate((palette) => document.documentElement.setAttribute('data-theme', palette), shot.palette);
    // Toasts time out on their own clock, so a first-run notice would land in some frames and not others.
    await page.addStyleTag({ content: '[data-sonner-toaster]{display:none!important}' });
    await dismiss(page);
    if (shot.kind === 'game') {
      await page.getByRole('button', { name: scene.choices[0], exact: true }).waitFor();
      const input = page.getByTestId('action-input-wrap').locator('textarea');
      await input.fill('');
      await input.blur();
    }
    if (shot.steps) await runSteps(page, shot.steps);
    if (shot.expect) await page.getByText(shot.expect, { exact: true }).first().waitFor({ timeout: 10000 });
    // Settle: fonts and images decoded, then the pointer parked where it hovers nothing.
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((image) => image.decode().catch(() => {})));
      // A control a dialog focused on open would otherwise show its focus ring.
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });
    await page.mouse.move(0, 0);
    await page.waitForTimeout(1500);
    if (shot.kind === 'game' && shot.verify !== false) await verifyGame(page, scene);
    return await page.screenshot({ animations: 'disabled', caret: 'hide' });
  } finally {
    await context.close();
  }
}

/** Counts the pixels that differ between two PNGs, decoded by Chromium. Reports the sizes when they differ. */
async function pixelDiff(encoder, a, b) {
  return encoder.evaluate(async ([x, y]) => {
    const decode = async (b64) => {
      const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))]));
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0);
      return { width: bitmap.width, height: bitmap.height, data: ctx.getImageData(0, 0, bitmap.width, bitmap.height).data };
    };
    const [one, two] = await Promise.all([decode(x), decode(y)]);
    if (one.width !== two.width || one.height !== two.height) return { sizes: [`${one.width}x${one.height}`, `${two.width}x${two.height}`] };
    let pixels = 0;
    for (let i = 0; i < one.data.length; i += 4) {
      if (one.data[i] !== two.data[i] || one.data[i + 1] !== two.data[i + 1] || one.data[i + 2] !== two.data[i + 2] || one.data[i + 3] !== two.data[i + 3]) pixels++;
    }
    return { pixels, total: one.width * one.height };
  }, [a.toString('base64'), b.toString('base64')]);
}

const server = await startServer();
const changed = [];
const failed = [];
let browser;
try {
  browser = await chromium.launch();
  const encoder = await browser.newPage();
  for (const shot of shots) {
    let png;
    try {
      png = await capture(browser, shot);
    } catch (error) {
      failed.push(shot.id);
      console.log(`FAILED   ${shot.id}: ${String(error).split('\n')[0]}`);
      continue;
    }
    writeFileSync(path.join(outDir, `${shot.id}.png`), png);
    if (!DIFF) { console.log(`wrote public/shots/${shot.id}.png (${(png.length / 1024 / 1024).toFixed(2)} MB)`); continue; }
    const committed = path.join(committedDir, `${shot.id}.png`);
    if (!existsSync(committed)) { changed.push(shot.id); console.log(`NEW      ${shot.id}: no committed PNG`); continue; }
    const diff = await pixelDiff(encoder, readFileSync(committed), png);
    if (diff.sizes) { changed.push(shot.id); console.log(`CHANGED  ${shot.id}: size ${diff.sizes[0]} -> ${diff.sizes[1]}`); }
    else if (diff.pixels) { changed.push(shot.id); console.log(`CHANGED  ${shot.id}: ${diff.pixels} of ${diff.total} pixels (${(100 * diff.pixels / diff.total).toFixed(3)}%)`); }
    else console.log(`same     ${shot.id}`);
  }
} finally {
  await browser?.close();
  server.stop();
}
if (DIFF) console.log(changed.length ? `${changed.length} shot(s) changed. Fresh captures are in marketing/trailer/.capture-diff/.` : 'No shot changed.');
if (failed.length) console.log(`${failed.length} shot(s) failed: ${failed.join(', ')}`);
process.exit(changed.length || failed.length ? 1 : 0);
