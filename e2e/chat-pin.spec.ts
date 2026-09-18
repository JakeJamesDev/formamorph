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
  await page.waitForFunction(() => new Promise<boolean>((resolve) => {
    const sc = document.querySelector<HTMLElement>('[data-chat-scroller]')!;
    const offsets: number[] = [];
    const tick = () => {
      offsets.push(sc.scrollTop);
      if (offsets.length < 10) { requestAnimationFrame(tick); return; }
      resolve(new Set(offsets).size === 1 && Math.abs(sc.scrollTop + sc.clientHeight - sc.scrollHeight) < 2);
    };
    requestAnimationFrame(tick);
  }));
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

async function submit(page: Page, action: string) {
  const input = page.getByPlaceholder(/Type your action/);
  await input.fill(action);
  await input.press('Enter');
}

/** Record the scroll offset on every frame until the reply finishes revealing. */
async function sampleUntilDone(page: Page): Promise<number[]> {
  await page.evaluate(() => {
    const sc = document.querySelector<HTMLElement>('[data-chat-scroller]')!;
    const w = window as unknown as { __samples: number[]; __sampling: boolean };
    w.__samples = [];
    w.__sampling = true;
    const tick = () => { w.__samples.push(sc.scrollTop); if (w.__sampling) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  await expect(page.getByRole('button', { name: 'Send' })).toBeEnabled({ timeout: 60_000 });
  return page.evaluate(() => {
    const w = window as unknown as { __samples: number[]; __sampling: boolean };
    w.__sampling = false;
    return w.__samples;
  });
}

test('a submit pins its turn to the viewport top, and the view holds through a long stream', async ({ page }) => {
  await openChat(page);
  const before = await geometry(page);
  expect(before.atBottom).toBe(true);

  // Frames from the submit: the smooth pin moves over more than one of them.
  await page.evaluate(() => {
    const sc = document.querySelector<HTMLElement>('[data-chat-scroller]')!;
    const w = window as unknown as { __pin: number[] };
    w.__pin = [];
    const tick = () => { w.__pin.push(sc.scrollTop); if (w.__pin.length < 90) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  await submit(page, 'I step through the seam.');
  await expect.poll(async () => (await geometry(page)).latestLabel).toBe('Turn 9');
  await expect.poll(async () => Math.abs((await geometry(page)).latestTop), { timeout: 10_000 }).toBeLessThan(1);
  await page.waitForFunction(() => (window as unknown as { __pin: number[] }).__pin.length >= 90);
  const pin = await page.evaluate(() => (window as unknown as { __pin: number[] }).__pin);
  const moving = pin.filter((v, i) => i > 0 && Math.abs(v - pin[i - 1]) >= 1).length;
  expect(moving).toBeGreaterThan(1);

  // The action bubble sits at the top of the viewport, inside the turn's padding.
  const action = await page.locator('[data-chat-scroller] article').last().getByText('I step through the seam.').boundingBox();
  const scroller = await page.locator('[data-chat-scroller]').boundingBox();
  expect(action!.y - scroller!.y).toBeGreaterThanOrEqual(0);
  expect(action!.y - scroller!.y).toBeLessThan(32);

  // From the pin to the end of the stream the offset never moves, while the reply grows past the fold.
  const pinned = (await geometry(page)).scrollTop;
  const samples = await sampleUntilDone(page);
  expect(samples.length).toBeGreaterThan(10);
  expect(Math.max(...samples.map((s) => Math.abs(s - pinned)))).toBeLessThan(1);
  const done = await geometry(page);
  expect(done.latestTop).toBeCloseTo(0, 0);
  expect(done.latestEnd).toBeGreaterThan(done.viewportHeight);
});

test('Jump to Latest shows while the reply runs past the fold, lands on its end, and hides', async ({ page }) => {
  await openChat(page);
  await expect(jump(page)).toBeHidden();
  await submit(page, 'I step through the seam.');
  // The reply grows below the fold while it streams, and the button says so.
  await expect(streaming(page)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Send' })).toBeEnabled({ timeout: 60_000 });
  await expect(jump(page)).toHaveText('Jump to Latest');

  await jump(page).click();
  // A long turn lands with its end at the viewport bottom.
  await expect.poll(async () => {
    const g = await geometry(page);
    return Math.abs(g.latestEnd - g.viewportHeight);
  }, { timeout: 10_000 }).toBeLessThan(2);
  await expect(jump(page)).toBeHidden();
});

test('under reduced motion the pin lands in one frame', async ({ page }) => {
  reply = SHORT_REPLY;
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openChat(page);
  await page.evaluate(() => {
    const sc = document.querySelector<HTMLElement>('[data-chat-scroller]')!;
    const w = window as unknown as { __pin: number[] };
    w.__pin = [];
    const tick = () => { w.__pin.push(sc.scrollTop); if (w.__pin.length < 60) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  await submit(page, 'I tap the console.');
  await expect.poll(async () => Math.abs((await geometry(page)).latestTop), { timeout: 10_000 }).toBeLessThan(1);
  await page.waitForFunction(() => (window as unknown as { __pin: number[] }).__pin.length >= 60);
  const pin = await page.evaluate(() => (window as unknown as { __pin: number[] }).__pin);
  expect(pin.filter((v, i) => i > 0 && Math.abs(v - pin[i - 1]) >= 1).length).toBe(1);
});

test('a player scroll during Jump to Latest keeps the view where the player left it', async ({ page }) => {
  await openChat(page);
  await submit(page, 'I step through the seam.');
  await expect(page.getByRole('button', { name: 'Send' })).toBeEnabled({ timeout: 60_000 });
  const box = (await page.locator('[data-chat-scroller]').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 12; i++) await page.mouse.wheel(0, -400);
  await expect(jump(page)).toBeVisible();

  // The smooth jump is under way when the player wheels back up.
  const start = (await geometry(page)).scrollTop;
  await jump(page).click();
  await expect.poll(async () => (await geometry(page)).scrollTop).toBeGreaterThan(start + 1);
  await page.mouse.wheel(0, -300);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const left = (await geometry(page)).scrollTop;
  // No re-aim pulls the view back down after the player took over.
  await page.waitForTimeout(1000);
  expect(Math.abs((await geometry(page)).scrollTop - left)).toBeLessThan(1);
  await expect(jump(page)).toBeVisible();
});

test('a short reply keeps its action at the top and shows no Jump to Latest', async ({ page }) => {
  reply = SHORT_REPLY;
  await openChat(page);
  await submit(page, 'I tap the console.');
  await expect(page.getByRole('button', { name: 'Send' })).toBeEnabled({ timeout: 30_000 });
  await expect.poll(async () => Math.abs((await geometry(page)).latestTop), { timeout: 10_000 }).toBeLessThan(1);
  await expect(jump(page)).toBeHidden();
});

test('after a player scroll into history, Jump to Latest returns to a short turn with its action at the top', async ({ page }) => {
  reply = SHORT_REPLY;
  await openChat(page);
  await submit(page, 'I tap the console.');
  await expect(page.getByRole('button', { name: 'Send' })).toBeEnabled({ timeout: 30_000 });
  await expect.poll(async () => Math.abs((await geometry(page)).latestTop), { timeout: 10_000 }).toBeLessThan(1);

  const box = (await page.locator('[data-chat-scroller]').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 12; i++) await page.mouse.wheel(0, -400);
  await expect(jump(page)).toBeVisible();
  // The view stays where the player left it.
  const scrolled = (await geometry(page)).scrollTop;
  await page.waitForTimeout(300);
  expect((await geometry(page)).scrollTop).toBe(scrolled);

  await jump(page).click();
  await expect.poll(async () => Math.abs((await geometry(page)).latestTop), { timeout: 10_000 }).toBeLessThan(2);
  await expect(jump(page)).toBeHidden();
});
