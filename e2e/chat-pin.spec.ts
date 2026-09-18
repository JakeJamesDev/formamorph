import { test, expect, type Page } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { openApp } from './app';

/**
 * Chat layout's pin, stream, and Jump to Latest, in a real browser: jsdom has no layout and no scroll.
 * The model is a local server that streams the narration in timed chunks, so the reply grows over many
 * frames the way a real one does. `page.route` can only answer a request in one piece.
 */

const PARAGRAPH = 'The White Room hums around you, and the seam in the far wall widens by a finger. ' +
  'A cold draft slides out of it and carries the smell of rain on stone. ';
// Long enough to go well past the fold at both viewport sizes.
const LONG_REPLY = Array.from({ length: 14 }, () => PARAGRAPH.repeat(3)).join('\n\n');
const SHORT_REPLY = 'The console blinks once.';
const CHUNK_CHARS = 48;
const CHUNK_GAP_MS = 25;
// Frames a view must hold still to count as settled, and frames a pin gets to land.
const STILL_FRAMES = 30;
const PIN_FRAMES = 90;

let server: Server;
let endpoint = '';
let reply = LONG_REPLY;

test.beforeAll(async () => {
  server = createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }
    if (req.url?.endsWith('/v1/models')) { res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ data: [{ id: 'e2e-model' }] })); return; }
    if (!req.url?.endsWith('/chat/completions')) { res.writeHead(404).end(); return; }
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const system = JSON.parse(body).messages.find((m: { role: string }) => m.role === 'system')?.content ?? '';
      const text = system.includes('stat tracker') ? 'No changes.' : reply;
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      const chunks = text.match(new RegExp(`[\\s\\S]{1,${CHUNK_CHARS}}`, 'g')) ?? [];
      const send = (i: number) => {
        if (i === chunks.length) { res.end('data: [DONE]\n\n'); return; }
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: chunks[i] }, finish_reason: null }] })}\n\n`);
        setTimeout(() => send(i + 1), CHUNK_GAP_MS);
      };
      send(0);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1/chat/completions`;
});

test.afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

test.beforeEach(() => { reply = LONG_REPLY; });

/** Start recording the scroll offset on every frame; `stop` ends it and returns the offsets. */
async function recordFrames(page: Page, limit = Infinity) {
  await page.evaluate((max) => {
    const sc = document.querySelector<HTMLElement>('[data-chat-scroller]')!;
    const w = window as unknown as { __frames: number[]; __recording: boolean };
    w.__frames = [];
    w.__recording = true;
    const tick = () => {
      w.__frames.push(sc.scrollTop);
      if (w.__recording && w.__frames.length < max) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, limit);
  return {
    filled: (count: number) => page.waitForFunction((n) => (window as unknown as { __frames: number[] }).__frames.length >= n, count),
    stop: () => page.evaluate(() => {
      const w = window as unknown as { __frames: number[]; __recording: boolean };
      w.__recording = false;
      return w.__frames;
    }),
  };
}

/** Frames in which the offset moved by a pixel or more. */
const movingFrames = (frames: number[]) => frames.filter((v, i) => i > 0 && Math.abs(v - frames[i - 1]) >= 1).length;

/**
 * Offsets strictly between where the frames start and where they land: the path of a glide. A resize clamp
 * (the action input shrinks on submit) moves away from the landing, so it is not one.
 */
const glideFrames = (frames: number[]) => {
  const [from, to] = [frames[0], frames[frames.length - 1]];
  return frames.filter((v) => v > Math.min(from, to) + 1 && v < Math.max(from, to) - 1).length;
};

/** The scroll offsets over the next `count` frames. */
async function nextFrames(page: Page, count: number): Promise<number[]> {
  const frames = await recordFrames(page, count);
  await frames.filled(count);
  return frames.stop();
}

async function openChat(page: Page) {
  page.on('pageerror', (error) => console.error(error.message));
  await page.route('**/api/v0/models', (route) => route.fulfill({ status: 404 }));
  await openApp(page, {
    FORMAMORPH_endpointUrl: endpoint,
    FORMAMORPH_narrationLayout: 'chat',
    FORMAMORPH_thinkingMode: 'off', FORMAMORPH_choicesEnabled: false,
    FORMAMORPH_locationChangeEnabled: false, FORMAMORPH_memoryDigests: false, FORMAMORPH_aiClock: false,
  }, { url: '/#dev?view=gameViewer&fixture=whiteRoom' });
  await page.locator('[data-chat-scroller] article').first().waitFor();
  // The list opens at the bottom over a few frames; start once it rests there.
  await expect.poll(async () => {
    const frames = await nextFrames(page, 10);
    return movingFrames(frames) === 0 && (await geometry(page)).atBottom;
  }).toBe(true);
}

/** The scroller's offset, and the latest turn's top and content end relative to the viewport top. */
const geometry = (page: Page) => page.evaluate(() => {
  const sc = document.querySelector<HTMLElement>('[data-chat-scroller]')!;
  const top = sc.getBoundingClientRect().top;
  const turns = sc.querySelectorAll('article');
  const latest = turns[turns.length - 1];
  return {
    scrollTop: sc.scrollTop,
    viewportHeight: sc.clientHeight,
    atBottom: Math.abs(sc.scrollTop + sc.clientHeight - sc.scrollHeight) < 2,
    latestLabel: latest.getAttribute('aria-label'),
    latestTop: latest.getBoundingClientRect().top - top,
    latestEnd: latest.querySelector('[data-content-end]')!.getBoundingClientRect().top - top,
  };
});

const streaming = (page: Page) => page.getByRole('button', { name: /New Text Below/ });
const jump = (page: Page) => page.getByRole('button', { name: /^Jump to Latest/ });
const send = (page: Page) => page.getByRole('button', { name: 'Send' });

async function submit(page: Page, action: string) {
  const input = page.getByPlaceholder(/Type your action/);
  await input.fill(action);
  await input.press('Enter');
}

async function pinnedAtTop(page: Page) {
  await expect.poll(async () => Math.abs((await geometry(page)).latestTop), { timeout: 10_000 }).toBeLessThan(2);
}

/** Wheel up into history, far enough that the latest turn leaves the view. */
async function scrollIntoHistory(page: Page) {
  const box = (await page.locator('[data-chat-scroller]').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 12; i++) await page.mouse.wheel(0, -400);
  await expect(jump(page)).toBeVisible();
}

test('a submit pins its turn to the viewport top, and the view holds through a long stream', async ({ page }) => {
  await openChat(page);

  // Frames from the submit: the smooth pin moves over more than one of them.
  const pinFrames = await recordFrames(page, PIN_FRAMES);
  await submit(page, 'I step through the seam.');
  await expect.poll(async () => (await geometry(page)).latestLabel).toBe('Turn 9');
  await pinnedAtTop(page);
  await pinFrames.filled(PIN_FRAMES);
  expect(movingFrames(await pinFrames.stop())).toBeGreaterThan(1);

  // The action bubble sits at the top of the viewport, inside the turn's padding.
  const action = await page.locator('[data-chat-scroller] article').last().getByText('I step through the seam.').boundingBox();
  const scroller = await page.locator('[data-chat-scroller]').boundingBox();
  expect(action!.y - scroller!.y).toBeGreaterThanOrEqual(0);
  expect(action!.y - scroller!.y).toBeLessThan(32);

  // From the pin to the end of the stream the offset never moves, while the reply grows past the fold.
  const pinned = (await geometry(page)).scrollTop;
  const stream = await recordFrames(page);
  await expect(send(page)).toBeEnabled({ timeout: 60_000 });
  const samples = await stream.stop();
  expect(samples.length).toBeGreaterThan(10);
  expect(Math.max(...samples.map((s) => Math.abs(s - pinned)))).toBeLessThan(1);
  const done = await geometry(page);
  expect(done.latestTop).toBeCloseTo(0, 0);
  expect(done.latestEnd).toBeGreaterThan(done.viewportHeight);
});

test('Re-generate pins the new reply to the viewport top', async ({ page }) => {
  reply = SHORT_REPLY;
  await openChat(page);
  await submit(page, 'I tap the console.');
  await expect(send(page)).toBeEnabled({ timeout: 30_000 });
  await pinnedAtTop(page);
  // Scroll up a little, so the pin has to move the view while the latest bubble's row stays in reach.
  const box = (await page.locator('[data-chat-scroller]').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -150);
  await expect.poll(async () => (await geometry(page)).latestTop).toBeGreaterThan(100);

  await page.locator('[data-chat-scroller] article').last().getByRole('button', { name: 'Re-generate Narration' }).click();
  await expect(send(page)).toBeEnabled({ timeout: 30_000 });
  await pinnedAtTop(page);
  expect((await geometry(page)).latestLabel).toBe('Turn 9');
});

test('Jump to Latest shows while the reply runs past the fold, lands on its end, and hides', async ({ page }) => {
  await openChat(page);
  await expect(jump(page)).toBeHidden();
  await submit(page, 'I step through the seam.');
  // The reply grows below the fold while it streams, and the button says so.
  await expect(streaming(page)).toBeVisible({ timeout: 30_000 });
  await expect(send(page)).toBeEnabled({ timeout: 60_000 });
  await expect(jump(page)).toHaveText('Jump to Latest');

  await jump(page).click();
  // A long turn lands with its end at the viewport bottom.
  await expect.poll(async () => {
    const g = await geometry(page);
    return Math.abs(g.latestEnd - g.viewportHeight);
  }, { timeout: 10_000 }).toBeLessThan(2);
  await expect(jump(page)).toBeHidden();
});

test('under reduced motion the pin and Jump to Latest land without a glide', async ({ page }) => {
  reply = SHORT_REPLY;
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openChat(page);
  const pinFrames = await recordFrames(page, PIN_FRAMES);
  await submit(page, 'I tap the console.');
  await pinnedAtTop(page);
  await pinFrames.filled(PIN_FRAMES);
  expect(glideFrames(await pinFrames.stop())).toBe(0);

  await expect(send(page)).toBeEnabled({ timeout: 30_000 });
  // Up past the short turn's end but not so far that it unmounts, so the jump is one direct scroll.
  const box = (await page.locator('[data-chat-scroller]').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -700);
  await expect(jump(page)).toBeVisible();
  const jumpFrames = await recordFrames(page, PIN_FRAMES);
  await jump(page).click();
  await pinnedAtTop(page);
  await jumpFrames.filled(PIN_FRAMES);
  expect(glideFrames(await jumpFrames.stop())).toBe(0);
});

test('a player scroll during Jump to Latest keeps the view where the player left it', async ({ page }) => {
  await openChat(page);
  await submit(page, 'I step through the seam.');
  await expect(send(page)).toBeEnabled({ timeout: 60_000 });
  await scrollIntoHistory(page);

  // The smooth jump is under way when the player wheels back up.
  const start = (await geometry(page)).scrollTop;
  await jump(page).click();
  await expect.poll(async () => (await geometry(page)).scrollTop).toBeGreaterThan(start + 1);
  await page.mouse.wheel(0, -300);
  await nextFrames(page, 2);
  // No re-aim pulls the view back down after the player took over.
  expect(movingFrames(await nextFrames(page, STILL_FRAMES * 2))).toBe(0);
  await expect(jump(page)).toBeVisible();
});

test('a short reply keeps its action at the top and shows no Jump to Latest', async ({ page }) => {
  reply = SHORT_REPLY;
  await openChat(page);
  await submit(page, 'I tap the console.');
  await expect(send(page)).toBeEnabled({ timeout: 30_000 });
  await pinnedAtTop(page);
  await expect(jump(page)).toBeHidden();
});

test('after a player scroll into history, Jump to Latest returns to a short turn with its action at the top', async ({ page }) => {
  reply = SHORT_REPLY;
  await openChat(page);
  await submit(page, 'I tap the console.');
  await expect(send(page)).toBeEnabled({ timeout: 30_000 });
  await pinnedAtTop(page);

  await scrollIntoHistory(page);
  // The view stays where the player left it.
  expect(movingFrames(await nextFrames(page, STILL_FRAMES))).toBe(0);

  await jump(page).click();
  await pinnedAtTop(page);
  await expect(jump(page)).toBeHidden();
});
