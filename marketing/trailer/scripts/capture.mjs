#!/usr/bin/env node
// Poses the app screens listed in captures.json through the dev-router and writes one PNG per shot into
// public/shots/. A clip shot films one live turn, a model shot the avatar's idle animation, and an ask shot the
// help window answering, frame by frame, and writes an MP4 instead after a check for jumps (clipMotion.mjs).
// With --diff it captures to .capture-diff/ and reports each shot whose pixels differ from the committed file.
//
//   npm run capture
//   npm run capture -- --only game
//   npm run capture:diff
//
// It starts its own Vite server from the repo root, with file watching off so a peer's edit never reloads
// a capture mid-run, and stops it at the end. The port is its own (default 5188, or --port / CAPTURE_PORT).
// Playwright comes from the repo root's node_modules, which Node finds above this package.
import { chromium } from '@playwright/test';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareGame, verifyGame } from '../../../scripts/lib/demoGame.mjs';
import { setups } from './captureSetups.mjs';
import { EDGES_FILE, formatSeries, formatSpikes, motionSeries, movingMedian, spikes } from './clipMotion.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(packageRoot, '../..');

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const DIFF = process.argv.includes('--diff');
/** The trailer's frame rate, which a clip's frames step at. */
const FPS = 60;
const FRAME_MS = 1000 / FPS;
const PORT = Number(arg('port', process.env.CAPTURE_PORT ?? '5188'));
const only = arg('only', '').split(',').filter(Boolean);

const list = JSON.parse(readFileSync(path.join(packageRoot, 'captures.json'), 'utf8'));
const unknown = only.filter((id) => !list.shots.some((shot) => shot.id === id));
if (unknown.length) throw new Error(`Unknown shot: ${unknown.join(', ')}`);
// A deferred shot is listed for the record and belongs to a later ticket. Only `--only` runs it.
const shots = list.shots.filter((shot) => (only.length ? only.includes(shot.id) : !shot.deferred));
const readScene = (file) => JSON.parse(readFileSync(path.join(repoRoot, file), 'utf8'));
const sceneOf = (shot) => readScene(shot.scene ?? list.demo.scene);
/** Built worlds by name, filled once per run by `buildWorlds`. */
const builtWorlds = {};
/** The world a game shot loads: a built world by name, or the demo world file. */
const worldOf = (shot) => (shot.world ? builtWorlds[shot.world] : list.demo.world);

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
  const config = path.join(packageRoot, 'scripts/captureVite.config.mjs');
  const child = spawn(process.execPath, [viteBin, '--config', config, '--port', String(PORT), '--strictPort'], {
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

/**
 * Builds each world the listed shots name, from the app's own modules through the capture server. `tour` is the
 * world the Authoring Tour leaves when an author takes every step's example (ruling Q42). Ids count up, so every
 * run builds the same world.
 */
async function buildWorlds(browser, names) {
  if (!names.length) return;
  const context = await browser.newContext();
  try {
    await context.addInitScript(() => {
      let n = 0;
      crypto.randomUUID = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    });
    const page = await context.newPage();
    await page.goto(`http://localhost:${PORT}/`);
    for (const name of names) {
      if (name !== 'tour') throw new Error(`Unknown world "${name}"`);
      builtWorlds[name] = await page.evaluate(async () => {
        const { TOUR_STEPS, replayTourSteps } = await import('/src/lib/authoringTour/steps.ts');
        const { newBlankWorld } = await import('/src/lib/blankWorld.ts');
        return (await replayTourSteps(newBlankWorld(), TOUR_STEPS.length)).world;
      });
    }
  } finally {
    await context.close();
  }
}

/** A promise and the function that settles it, so a held request waits for the capture to let it through. */
const gate = () => {
  let open;
  const opened = new Promise((resolve) => { open = resolve; });
  return { opened, open };
};

async function newContext(browser, shot) {
  const films = shot.kind === 'clip' || !!shot.film;
  const context = await browser.newContext({
    viewport: shot.viewport,
    deviceScaleFactor: shot.scale,
    colorScheme: shot.theme,
    // A clip films the app's own motion; a still shows every animation at its end.
    reducedMotion: films ? 'no-preference' : 'reduce',
  });
  if (!shot.model && !films) {
    await context.clock.setFixedTime(new Date(list.demo.time));
  } else {
    // The page clock runs until the capture pauses it, so its timers and frames move only when the capture says.
    await context.clock.install({ time: new Date(list.demo.time) });
  }
  if (shot.model) {
    // The models load only once the clock is paused, so the animation starts at a known time.
    context.models = gate();
    await context.route(/\.(vrm|fbx)(\?|$)/, async (route) => {
      await context.models.opened;
      await route.fallback();
    });
  }
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
  if (shot.kind === 'game') await prepareGame(context, sceneOf(shot), worldOf(shot));
  if (shot.kind === 'clip') {
    await prepareGame(context, sceneOf(shot), worldOf(shot), { openingOnly: true });
    context.stats = gate();
    context.choices = gate();
    await answerTurn(context, shot, sceneOf(shot));
  }
  return context;
}

/**
 * Plays a clip's turn from canned replies, picked by each call's system prompt. The choice reply waits for
 * `context.choices` and the stat reply for `context.stats`.
 */
async function answerTurn(context, shot, scene) {
  const replies = [
    ['narrator stage', scene.narration],
    ['player choice writer', scene.choices.join('\n')],
    ['stat tracker', (shot.turn.stats ?? []).join('\n')],
    ['location router', 'NONE'],
    ['memory keeper', 'Keep: none'],
  ];
  const chunk = (delta) => `data: ${JSON.stringify({ choices: [{ index: 0, delta, finish_reason: null }] })}\n\n`;
  await context.route('**/chat/completions*', async (route) => {
    const body = route.request().postDataJSON();
    const system = body.messages.find((message) => message.role === 'system')?.content ?? '';
    const [role, text] = replies.find(([key]) => system.includes(key)) ?? ['other', 'Done.'];
    // A reveal clip films the narration alone: calls after it never answer, so nothing else lands mid-clip.
    if (shot.turn.film === 'reveal' && context.narrated) return;
    if (role === 'player choice writer') await context.choices.opened;
    if (role === 'stat tracker') await context.stats.opened;
    if (role === 'narrator stage') context.narrated = true;
    if (!body.stream) return route.fulfill({ json: { choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }] } });
    const words = text.split(/(?<=\s)/);
    return route.fulfill({ contentType: 'text/event-stream', body: chunk({ role: 'assistant' }) + words.map((word) => chunk({ content: word })).join('') + 'data: [DONE]\n\n' });
  });
}

/** A time well past any capture's own run, for pausing the page clock. */
const pauseTime = () => new Date(Date.parse(list.demo.time) + 10 * 60 * 1000);

/** Films the clip's stat change one seeked frame at a time, on a paused page clock so timed UI holds still. */
async function filmTurn(page, shot, scene, sink) {
  const input = page.getByTestId('action-input-wrap').locator('textarea');
  await page.getByRole('button', { name: scene.action, exact: true }).click();
  await input.press('Enter');
  const ending = scene.narration.trim().slice(-60);
  // Choices that land over a still-fading narration wait for the turn's commit, which waits for the held stats.
  // So the choices answer once the narration's words have all faded in.
  await page.waitForFunction((text) => {
    const narration = document.querySelector('[data-testid="narration"]');
    return !!narration?.textContent?.includes(text) && narration.getAnimations({ subtree: true }).every((animation) => animation.playState === 'finished');
  }, ending, { timeout: 60000 });
  await page.waitForTimeout(500); // the reveal's drain settles on its own timer
  page.context().choices.open();
  await page.getByRole('button', { name: scene.choices[0], exact: true }).waitFor();
  await verifyGame(page, scene);
  await input.blur();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(2500); // the reveal and the choices finish their own motion
  await page.clock.pauseAt(pauseTime());
  await page.evaluate(() => {
    const before = new Set(document.getAnimations());
    window.__clip = { fresh: () => document.getAnimations().filter((animation) => !before.has(animation)) };
    // Holds each new animation at its start until the capture seeks it. Frames come only from the capture's clock steps.
    const hold = () => {
      for (const animation of window.__clip.fresh()) animation.pause();
      requestAnimationFrame(hold);
    };
    hold();
  });
  page.context().stats.open();
  const started = () => page.evaluate(() => window.__clip.fresh().some((animation) => animation.animationName === 'stat-fill-slide'));
  for (let i = 0; i < 600 && !(await started()); i++) await page.clock.runFor(16);
  if (!(await started())) throw new Error('The stat bars never animated');
  await page.clock.runFor(1500); // the stat code's bars commit after the tracker's
  for (let i = 0; i < shot.frames; i++) {
    await page.evaluate((time) => {
      for (const animation of window.__clip.fresh()) {
        animation.pause();
        animation.currentTime = time;
      }
    }, i * FRAME_MS);
    sink.add(await page.screenshot({ caret: 'hide' }));
  }
}

/**
 * Ties every animation that starts from now on to the paused page clock: `window.__clip.sync()` seeks each one to
 * the clock time since it first showed, so frames come from the clock alone. CSS runs on real time, so with
 * `onChange` each new animation is held at its start the moment its element changes, even while the capture waits.
 */
async function followClock(page, { onChange = false } = {}) {
  await page.evaluate((onChange) => {
    const before = new Set(document.getAnimations());
    const seen = new Map();
    const hold = () => {
      const now = performance.now();
      for (const animation of document.getAnimations()) {
        if (before.has(animation) || seen.has(animation)) continue;
        seen.set(animation, now);
        animation.pause();
        animation.currentTime = 0;
      }
    };
    if (onChange) new MutationObserver(hold).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
    window.__clip = {
      sync: () => {
        hold();
        const now = performance.now();
        for (const animation of document.getAnimations()) {
          if (before.has(animation)) continue;
          animation.pause();
          animation.currentTime = now - seen.get(animation);
        }
      },
    };
  }, onChange);
}

/** Moves a paused page clock on by film frames, on the 60 fps grid from where it starts, syncing animations each step. */
function filmClock(page) {
  let frame = 0;
  return async () => {
    frame += 1;
    await page.clock.runFor(Math.round(frame * FRAME_MS) - Math.round((frame - 1) * FRAME_MS));
    await page.evaluate(() => window.__clip.sync());
  };
}

/**
 * Films the help window answering (ruling Q47): the question is sent on a paused clock, the Mascot's change to her
 * thinking look plays out unfilmed, and the clip opens on that look. The `helpAnswer` setup holds the reply for
 * `ask.thinking` frames; then it streams in on the page clock and she moves to her idle look as the answer reveals.
 */
async function filmAsk(page, shot, sink) {
  await page.keyboard.press('F1');
  const field = page.getByRole('textbox', { name: 'Ask a Question' });
  await field.waitFor();
  await page.waitForTimeout(2000); // the window's open animation drops a fill made during it
  await field.fill(shot.ask.question);
  await page.mouse.move(0, 0);
  await page.waitForTimeout(500);
  await page.clock.pauseAt(pauseTime());
  // The help answer's word animations start as its text lands, between clock steps.
  await followClock(page, { onChange: true });
  await field.press('Enter');
  await field.blur();
  const asked = () => page.evaluate(() => window.__helpAnswer.asked);
  for (let i = 0; i < 200 && !(await asked()); i++) await page.waitForTimeout(50);
  if (!(await asked())) throw new Error('The help question was never sent');
  const step = filmClock(page);
  for (let i = 0; i < SETTLE_FRAMES; i++) await step();
  for (let i = 0; i < shot.ask.thinking; i++) {
    if (i > 0) await step();
    sink.add(await page.screenshot({ caret: 'hide' }));
  }
  await page.evaluate(() => window.__helpAnswer.open());
  for (let i = shot.ask.thinking; i < shot.frames; i++) {
    await step();
    sink.add(await page.screenshot({ caret: 'hide' }));
  }
}

/** Frames the send's own change of look takes before an ask clip opens: the Mascot's transition and the bubble's entrance. */
const SETTLE_FRAMES = 60;

/**
 * Films the turn's narration reveal: the screen before the turn, then one frame per step of the paused page
 * clock. Each animation the reveal starts is seeked to the clock time since it first showed, so the frames come
 * from the page clock alone and a second run films the same clip.
 */
async function filmReveal(page, context, shot, scene, sink) {
  const input = page.getByTestId('action-input-wrap').locator('textarea');
  await page.getByRole('button', { name: scene.action, exact: true }).click();
  await input.blur();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(1500);
  await page.clock.pauseAt(pauseTime());
  await followClock(page);
  // The narration's bottom edge on each frame, so the motion check can tell the app's line growth from a jump.
  const edges = [];
  const shoot = async () => {
    sink.add(await page.screenshot({ caret: 'hide' }));
    edges.push(await page.evaluate(() => {
      const narration = document.querySelector('[data-testid="narration"]');
      if (!narration) return null;
      const line = parseFloat(getComputedStyle(narration.querySelector('p') ?? narration).lineHeight);
      return { bottom: narration.getBoundingClientRect().bottom / innerHeight, line: line / innerHeight };
    }));
  };
  await shoot();
  await input.press('Enter');
  await input.blur();
  // The narration lands on real network time, so the clock holds until the app has read all of it.
  for (let i = 0; i < 200 && !context.narrated; i++) await page.waitForTimeout(50);
  if (!context.narrated) throw new Error('The narration was never asked for');
  await page.waitForTimeout(1000);
  const step = filmClock(page);
  for (let i = 1; i < shot.frames; i++) {
    await step();
    await shoot();
  }
  writeFileSync(path.join(sink.dir, EDGES_FILE), JSON.stringify(edges));
}

/**
 * Films the avatar's idle animation: pauses the page clock, lets the held models load, runs the clock to
 * `model.from` seconds into the animation, then draws and screenshots one frame per trailer frame.
 */
async function filmModel(page, context, shot, sink) {
  const loaded = [];
  page.on('console', (message) => { if (/animation loaded$/.test(message.text())) loaded.push(message.text()); });
  await page.clock.pauseAt(pauseTime());
  context.models.open();
  // The viewer starts its first animation once all three are in.
  for (let i = 0; i < 240 && loaded.length < 3; i++) await page.waitForTimeout(250);
  if (loaded.length < 3) throw new Error(`Only ${loaded.length} of 3 avatar animations loaded`);
  await page.clock.runFor(Math.round(shot.model.from * 1000));
  // The fake clock fires animation frames on its own 16 ms grid. Queue them instead, so each film frame draws once at its own time.
  await page.evaluate(() => {
    const queue = [];
    window.requestAnimationFrame = (callback) => { queue.push(callback); return 0; };
    window.__film = { draw: () => { const due = queue.splice(0); for (const callback of due) callback(performance.now()); return due.length; } };
  });
  // A loop the clock had already scheduled moves into the queue on its next tick.
  await page.clock.runFor(16);
  for (let i = 0; i < shot.frames; i++) {
    if (i > 0) await page.clock.runFor(Math.round(i * FRAME_MS) - Math.round((i - 1) * FRAME_MS));
    if ((await page.evaluate(() => window.__film.draw())) === 0) throw new Error(`The avatar stopped drawing at frame ${i}`);
    sink.add(await page.screenshot({ animations: 'disabled', caret: 'hide' }));
  }
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
    } else if (step.button) {
      await page.getByRole('button', { name: new RegExp(step.button) }).first().click();
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

async function capture(browser, shot, sink) {
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
    await page.addStyleTag({ content: '[data-sonner-toaster],.Toastify{display:none!important}' });
    // Parts of the screen a shot leaves out, where the app has no switch for them.
    for (const selector of shot.hide ?? []) await page.addStyleTag({ content: `${selector}{visibility:hidden!important}` });
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
    await page.evaluate(async (gifFrame) => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((image) => image.decode().catch(() => {})));
      // An animated GIF plays on real time, so each one is swapped for a still of frame `gifFrame`.
      await Promise.all([...document.images].filter((image) => /^data:image\/gif|\.gif(\?|$)/i.test(image.currentSrc)).map(async (image) => {
        try {
          const decoder = new ImageDecoder({ data: await (await fetch(image.currentSrc)).arrayBuffer(), type: 'image/gif' });
          await decoder.tracks.ready;
          const { image: frame } = await decoder.decode({ frameIndex: Math.min(gifFrame, decoder.tracks.selectedTrack.frameCount - 1) });
          const canvas = document.createElement('canvas');
          canvas.width = frame.displayWidth;
          canvas.height = frame.displayHeight;
          canvas.getContext('2d').drawImage(frame, 0, 0);
          frame.close();
          decoder.close();
          image.src = canvas.toDataURL();
        } catch {
          return; // a cross-origin image can't be read back
        }
        await image.decode().catch(() => {});
      }));
      // A control a dialog focused on open would otherwise show its focus ring.
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    }, shot.gifFrame ?? 0);
    await page.mouse.move(0, 0);
    await page.waitForTimeout(1500);
    if (shot.kind === 'clip') return await (shot.turn.film === 'reveal' ? filmReveal(page, context, shot, scene, sink) : filmTurn(page, shot, scene, sink));
    if (shot.model) return await filmModel(page, context, shot, sink);
    if (shot.film === 'ask') return await filmAsk(page, shot, sink);
    if (shot.kind === 'game' && shot.verify !== false) await verifyGame(page, scene);
    return await page.screenshot({ animations: 'disabled', caret: 'hide' });
  } finally {
    await context.close();
  }
}

/** An empty folder that takes a clip's frames as they are filmed, one numbered PNG each, so a long clip never sits in memory. */
function clipSink(dir) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  let count = 0;
  return {
    dir,
    add: (png) => writeFileSync(path.join(dir, `${String(count++).padStart(3, '0')}.png`), png),
    get count() { return count; },
  };
}

/** Encodes a clip's frames near-lossless and bit-exact, so the same frames give the same file. */
function encodeClip(frameDir, file) {
  execFileSync('npx', ['remotion', 'ffmpeg', '-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', `"${path.join(frameDir, '%03d.png')}"`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '12', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    '-fflags', '+bitexact', '-flags:v', '+bitexact', '-map_metadata', '-1', `"${file}"`], { cwd: packageRoot, shell: true, stdio: 'inherit' });
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

/** Where a clip's frames stay after the run, to compare two runs. */
const frameDir = (shot) => path.join(DIFF ? outDir : path.join(packageRoot, '.capture-clip'), shot.id);

/** The narration reveal clip: its frame 0 is the screen before the send, and ruling Q41 holds it to the motion rule. */
const isReveal = (shot) => shot.turn?.film === 'reveal';

const server = await startServer();
const changed = [];
const failed = [];
let browser;
try {
  browser = await chromium.launch();
  await buildWorlds(browser, [...new Set(shots.flatMap((shot) => (shot.world ? [shot.world] : [])))]);
  const encoder = await browser.newPage();
  for (const shot of shots) {
    let png;
    try {
      png = await capture(browser, shot, shot.frames ? clipSink(frameDir(shot)) : null);
    } catch (error) {
      failed.push(shot.id);
      console.log(`FAILED   ${shot.id}: ${String(error).split('\n')[0]}`);
      continue;
    }
    if (shot.frames) {
      const series = await motionSeries(encoder, frameDir(shot));
      // A reveal clip starts with the send, a cut the app makes itself.
      const found = spikes(series).filter((spike) => !(isReveal(shot) && spike.frame === 1));
      const jumps = found.filter((spike) => !spike.edge);
      const edges = found.filter((spike) => spike.edge);
      console.log(`motion   ${shot.id}, % of pixels per frame (moving median ${(movingMedian(series) * 100).toFixed(3)}%, ! = spike, ~ = edge grows):\n${formatSeries(series)}`);
      if (edges.length) console.log(`         ${edges.length} edge growth(s) pass: ${formatSpikes(edges)}`);
      // Other clips only print their series: the Mascot's change of look is motion, not a jump.
      if (jumps.length && isReveal(shot)) {
        failed.push(shot.id);
        console.log(`FAILED   ${shot.id}: ${jumps.length} jump(s) far above the median: ${formatSpikes(jumps)}`);
        continue;
      }
      const file = path.join(outDir, `${shot.id}.mp4`);
      encodeClip(frameDir(shot), file);
      const clip = readFileSync(file);
      if (!DIFF) { console.log(`wrote public/shots/${shot.id}.mp4 (${shot.frames} frames, ${(clip.length / 1024 / 1024).toFixed(2)} MB)`); continue; }
      const committed = path.join(committedDir, `${shot.id}.mp4`);
      // The encode is bit-exact, so the same frames give the same file.
      if (!existsSync(committed)) { changed.push(shot.id); console.log(`NEW      ${shot.id}: no committed clip`); }
      else if (!clip.equals(readFileSync(committed))) { changed.push(shot.id); console.log(`CHANGED  ${shot.id}: the clip's frames differ`); }
      else console.log(`same     ${shot.id}`);
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
