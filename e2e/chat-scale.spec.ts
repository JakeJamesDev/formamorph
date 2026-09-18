import { expect, test, type Page } from '@playwright/test';
import { gotoDev, openApp } from './app';
import { READING_LINE } from '../src/lib/chatReadingLine';

/**
 * Chat at scale and at the edges: a save of 1000 turns, an engine with no scroll anchoring, the on-screen
 * keyboard, and a narrow phone. The long save is real narration from the baseline runs, with a scene image
 * on every twentieth turn (the `thousandTurns` fixture).
 */

const REPLY = 'The console blinks once.';
const WHEEL_STEP = 240;
// A virtualized list mounts the turns in view plus a few of overscan, never the whole save.
const MAX_MOUNTED = 15;

/** What the spec installs on the page's window. */
type TestWindow = Window & {
  __scrollWrites: number;
  __mount: { pressed: number; mounted: number };
  __openKeyboard: (px: number, panned: number) => void;
};

const SETTINGS = {
  FORMAMORPH_thinkingMode: 'off', FORMAMORPH_choicesEnabled: false,
  FORMAMORPH_locationChangeEnabled: false, FORMAMORPH_memoryDigests: false, FORMAMORPH_aiClock: false,
};

async function openGame(page: Page, fixture: string, extra: Record<string, unknown> = {}) {
  page.on('pageerror', (error) => console.error(error.message));
  await page.route('**/api/v0/models', (route) => route.fulfill({ status: 404 }));
  await page.route('**/v1/models', (route) => route.fulfill({ json: { data: [{ id: 'e2e-model' }] } }));
  await page.route('**/chat/completions', (route) => route.fulfill({
    headers: { 'Content-Type': 'text/event-stream' },
    body: `data: ${JSON.stringify({ choices: [{ delta: { content: REPLY }, finish_reason: null }] })}\n\ndata: [DONE]\n\n`,
  }));
  await openApp(page, { FORMAMORPH_narrationLayout: 'chat', ...SETTINGS, ...extra }, { url: `/#dev?view=gameViewer&fixture=${fixture}` });
}

/** Wait until the list rests at the bottom with the latest turn mounted. */
async function restsAtBottom(page: Page, latest: number) {
  await expect(page.locator(`[data-chat-scroller] article[aria-label="Turn ${latest}"]`)).toBeAttached({ timeout: 60_000 });
  await expect.poll(() => geometry(page).then((g) => g.atBottom), { timeout: 10_000 }).toBe(true);
}

/** Wait `count` animation frames. */
const frames = (page: Page, count: number) => page.evaluate((n) => new Promise<void>((resolve) => {
  let left = n;
  const tick = () => (--left <= 0 ? resolve() : requestAnimationFrame(tick));
  requestAnimationFrame(tick);
}), count);

/** The scroller's box and offset, the mounted turns, and the latest turn's top relative to the scroller. */
const geometry = (page: Page) => page.evaluate(() => {
  const sc = document.querySelector<HTMLElement>('[data-chat-scroller]')!;
  const box = sc.getBoundingClientRect();
  const turns = sc.querySelectorAll('article');
  const latest = turns[turns.length - 1];
  return {
    top: box.top,
    bottom: box.bottom,
    mounted: turns.length,
    atBottom: Math.abs(sc.scrollTop + sc.clientHeight - sc.scrollHeight) < 2,
    latestLabel: latest?.getAttribute('aria-label') ?? null,
    latestTop: latest ? latest.getBoundingClientRect().top - box.top : null,
  };
});

/** The turn on the reading line and its top in the viewport. */
const onLine = (page: Page) => page.evaluate((share) => {
  const sc = document.querySelector<HTMLElement>('[data-chat-scroller]')!;
  const box = sc.getBoundingClientRect();
  const line = box.top + box.height * share;
  for (const el of sc.querySelectorAll<HTMLElement>('article[data-index]')) {
    const rect = el.getBoundingClientRect();
    if (rect.top <= line && rect.bottom > line) return { index: el.dataset.index!, top: rect.top };
  }
  return null;
}, READING_LINE);

/** Count every scroll the page's code makes on the scroller from now on. */
const countScrollWrites = (page: Page) => page.evaluate(() => {
  const sc = document.querySelector<HTMLElement>('[data-chat-scroller]')! as HTMLElement & Record<string, unknown>;
  const w = window as unknown as TestWindow;
  w.__scrollWrites = 0;
  for (const name of ['scrollTo', 'scrollBy', 'scroll'] as const) {
    const original = sc[name].bind(sc) as (...args: unknown[]) => void;
    sc[name] = (...args: unknown[]) => { w.__scrollWrites += 1; original(...args); };
  }
  const top = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop')!;
  Object.defineProperty(sc, 'scrollTop', {
    configurable: true,
    get() { return top.get!.call(this); },
    set(value: number) { w.__scrollWrites += 1; top.set!.call(this, value); },
  });
});

const scrollWrites = (page: Page) => page.evaluate(() => (window as unknown as TestWindow).__scrollWrites);

async function pointAtList(page: Page) {
  const box = (await page.locator('[data-chat-scroller]').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
}

async function submit(page: Page, action: string) {
  const input = page.getByPlaceholder(/Type your action/);
  await input.fill(action);
  await input.press('Enter');
}

async function pinnedAtTop(page: Page) {
  await expect.poll(async () => Math.abs((await geometry(page)).latestTop!), { timeout: 10_000 }).toBeLessThan(2);
}

/** Scene images mounted in the list that decoded from a data URL. */
const decodedImages = (page: Page) => page.locator('[data-chat-scroller] img').evaluateAll((imgs) =>
  imgs.filter((img) => (img as HTMLImageElement).naturalWidth > 0 && (img as HTMLImageElement).src.startsWith('data:image/')).length);

/** Horizontal overflow of the page and the list, and the Chat parts that leave the list's box on either side. */
const overflowAt = (page: Page) => page.evaluate(() => {
  const sc = document.querySelector<HTMLElement>('[data-chat-scroller]')!;
  const box = sc.getBoundingClientRect();
  const groups = {
    action: [...sc.querySelectorAll('[data-testid="player-action"]')],
    choice: [...sc.querySelectorAll('[data-testid="chat-choices"] button')],
    row: [...sc.querySelectorAll('[data-testid="bubble-actions"], [data-testid="bubble-actions"] button')],
    jump: [...document.querySelectorAll('button')].filter((b) => b.textContent?.startsWith('Jump to Latest')),
  };
  return {
    page: document.documentElement.scrollWidth - innerWidth,
    list: sc.scrollWidth - sc.clientWidth,
    counts: Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.length])) as Record<keyof typeof groups, number>,
    outside: Object.values(groups).flat().filter((el) => {
      const r = el.getBoundingClientRect();
      return r.left < box.left - 0.5 || r.right > box.right + 0.5;
    }).map((el) => el.outerHTML.slice(0, 80)),
  };
});

const jump = (page: Page) => page.getByRole('button', { name: /^Jump to Latest/ });

test.describe('Chat on a save of 1000 turns', () => {
  test.beforeEach(({ page: _page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'one viewport is enough for the long save');
    test.setTimeout(120_000);
  });

  test('opens at the bottom with a small mounted count, and a submit still pins', async ({ page }) => {
    await openGame(page, 'thousandTurns');
    await restsAtBottom(page, 1000);
    expect((await geometry(page)).mounted).toBeLessThanOrEqual(MAX_MOUNTED);

    await submit(page, 'I step onto the ferry.');
    await expect.poll(() => geometry(page).then((g) => g.latestLabel)).toBe('Turn 1001');
    await pinnedAtTop(page);
    expect((await geometry(page)).mounted).toBeLessThanOrEqual(MAX_MOUNTED);
  });

  test('a wheel scroll through history makes no scroll writes from code', async ({ page }) => {
    await openGame(page, 'thousandTurns');
    await restsAtBottom(page, 1000);
    // Past the open aim's last frame, so only the wheel moves the list from here.
    await frames(page, 40);
    await countScrollWrites(page);
    await pointAtList(page);
    const start = (await onLine(page))!.index;
    let imagesSeen = 0;
    for (let step = 0; step < 80; step++) {
      await page.mouse.wheel(0, -WHEEL_STEP * 2);
      await frames(page, 2);
      imagesSeen = Math.max(imagesSeen, await decodedImages(page));
    }
    // The scroll went through many turns, scene images among them, each mounted and measured on the way.
    expect(Number(start) - Number((await onLine(page))!.index)).toBeGreaterThan(20);
    expect(imagesSeen).toBeGreaterThan(0);
    expect(await scrollWrites(page)).toBe(0);
  });

  test('records heap and mount time for the Chat body', async ({ page }) => {
    await openGame(page, 'thousandTurns', { FORMAMORPH_narrationLayout: 'pages' });
    await expect(page.getByLabel('Go to previous page')).toBeVisible({ timeout: 60_000 });
    const cdp = await page.context().newCDPSession(page);
    // The save loads in steps after the first paint; read once two collections a few frames apart agree.
    const heap = async () => {
      let last = -Infinity;
      for (;;) {
        await frames(page, 20);
        await cdp.send('HeapProfiler.collectGarbage');
        const used = (await cdp.send('Runtime.getHeapUsage')).usedSize;
        if (Math.abs(used - last) < 2 ** 20) return used;
        last = used;
      }
    };
    const pagesHeap = await heap();

    await gotoDev(page, 'gameViewer', { modal: 'settings', tab: 'display' });
    const chat = page.getByRole('radiogroup', { name: 'Narration Layout' }).getByRole('radio', { name: 'Chat' });
    // From the press to the first mounted turn.
    await page.evaluate(() => {
      const w = window as unknown as TestWindow;
      w.__mount = { pressed: 0, mounted: 0 };
      document.addEventListener('pointerdown', () => { w.__mount.pressed = performance.now(); }, { capture: true, once: true });
      const seen = new MutationObserver(() => {
        if (!document.querySelector('[data-chat-scroller] article')) return;
        w.__mount.mounted = performance.now();
        seen.disconnect();
      });
      seen.observe(document.body, { childList: true, subtree: true });
    });
    await chat.click();
    await page.keyboard.press('Escape');
    await restsAtBottom(page, 1000);
    const mount = await page.evaluate(() => (window as unknown as TestWindow).__mount);
    const chatHeap = await heap();
    const g = await geometry(page);
    const nodes = await page.evaluate(() => document.getElementsByTagName('*').length);
    // The bottom turns hold no image; read again with a scene image decoded in view.
    await pointAtList(page);
    await expect(async () => {
      await page.mouse.wheel(0, -WHEEL_STEP * 2);
      expect(await decodedImages(page)).toBeGreaterThan(0);
    }).toPass({ timeout: 30_000, intervals: [50] });
    const imageHeap = await heap();
    const mb = (bytes: number) => `${(bytes / 2 ** 20).toFixed(1)} MB`;
    test.info().annotations.push(
      { type: 'mount', description: `${Math.round(mount.mounted - mount.pressed)} ms to the first turn, ${g.mounted} turns mounted, ${nodes} nodes` },
      { type: 'heap', description: `Pages ${mb(pagesHeap)}, Chat ${mb(chatHeap)}, Chat with an image in view ${mb(imageHeap)}` },
    );
    expect(g.mounted).toBeLessThanOrEqual(MAX_MOUNTED);
  });
});

test.describe('Chat on an engine with no scroll anchoring', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'one viewport is enough for the fallback');
    test.setTimeout(120_000);
    // What WebKit reports and does: no overflow-anchor, so no native anchoring.
    await page.addInitScript(() => {
      const supports = CSS.supports.bind(CSS) as (a: string, b?: string) => boolean;
      CSS.supports = ((a: string, b?: string) => (/overflow-anchor/.test(a) ? false : supports(a, b))) as typeof CSS.supports;
      document.addEventListener('DOMContentLoaded', () => {
        const style = document.createElement('style');
        style.textContent = '* { overflow-anchor: none !important; }';
        document.head.append(style);
      });
    });
  });

  test('the turn on the reading line moves only by the wheel while turns above mount', async ({ page }) => {
    await openGame(page, 'thousandTurns');
    await restsAtBottom(page, 1000);
    await frames(page, 40);
    await pointAtList(page);
    let mountedAbove = 0;
    for (let step = 0; step < 40; step++) {
      const before = (await onLine(page))!;
      const firstBefore = await page.locator('[data-chat-scroller] article').first().getAttribute('data-index');
      await page.mouse.wheel(0, -WHEEL_STEP);
      await frames(page, 3);
      const firstAfter = await page.locator('[data-chat-scroller] article').first().getAttribute('data-index');
      if (firstAfter !== firstBefore) mountedAbove += 1;
      const after = await page.locator(`[data-chat-scroller] article[data-index="${before.index}"]`).evaluate((el) => el.getBoundingClientRect().top);
      expect(Math.abs(after - before.top - WHEEL_STEP), `step ${step}, turn ${Number(before.index) + 1}`).toBeLessThan(2);
    }
    // The steps above really mounted turns of a real size over the estimate.
    expect(mountedAbove).toBeGreaterThan(5);
  });
});

test.describe('Chat on a phone', () => {
  test.beforeEach(({ page: _page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'the phone profile has touch');
  });

  test('with the on-screen keyboard open, the pin and Jump to Latest use the visible area', async ({ page }) => {
    const keyboard = 330;
    // Engines that pan the layout viewport under the keyboard (iOS) move the visible area down as well.
    const panned = 60;
    // A visual viewport the test can shrink and pan, as the on-screen keyboard does.
    await page.addInitScript(() => {
      const vv = new EventTarget() as EventTarget & Record<string, number>;
      Object.assign(vv, { width: innerWidth, height: innerHeight, offsetTop: 0, offsetLeft: 0, pageTop: 0, pageLeft: 0, scale: 1 });
      Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => vv });
      (window as unknown as TestWindow).__openKeyboard = (px, pan) => {
        vv.height = innerHeight - px;
        vv.offsetTop = pan;
        vv.dispatchEvent(new Event('resize'));
        vv.dispatchEvent(new Event('scroll'));
      };
    });
    await openGame(page, 'whiteRoom');
    await restsAtBottom(page, 8);
    await page.evaluate(([px, pan]) => (window as unknown as TestWindow).__openKeyboard(px, pan), [keyboard, panned]);
    const visible = { top: panned, bottom: panned + (await page.evaluate(() => innerHeight)) - keyboard };
    await expect.poll(() => geometry(page).then((g) => g.bottom)).toBeLessThanOrEqual(visible.bottom);
    expect((await geometry(page)).top).toBeGreaterThanOrEqual(visible.top);

    await submit(page, 'I tap the console.');
    await expect.poll(() => geometry(page).then((g) => g.latestLabel)).toBe('Turn 9');
    await expect(page.getByText(REPLY)).toBeVisible();
    await pinnedAtTop(page);

    await pointAtList(page);
    for (let i = 0; i < 6; i++) await page.mouse.wheel(0, -400);
    await expect(jump(page)).toBeVisible();
    const button = (await jump(page).boundingBox())!;
    expect(button.y).toBeGreaterThanOrEqual(visible.top);
    expect(button.y + button.height).toBeLessThanOrEqual(visible.bottom);
    await jump(page).click();
    await pinnedAtTop(page);
    await expect(jump(page)).toBeHidden();
  });

  test('at a narrow width the bubbles, the icon row, and Jump to Latest fit with no horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await openGame(page, 'whiteRoom', { FORMAMORPH_choicesEnabled: true });
    await restsAtBottom(page, 8);
    await expect(page.getByTestId('chat-choices')).toBeVisible();
    const atBottom = await overflowAt(page);
    await pointAtList(page);
    await page.mouse.wheel(0, -900);
    await expect(jump(page)).toBeVisible();
    const inHistory = await overflowAt(page);

    for (const [where, o] of [['at the bottom', atBottom], ['in history', inHistory]] as const) {
      expect(o.page, where).toBeLessThanOrEqual(0);
      expect(o.list, where).toBeLessThanOrEqual(0);
      expect(o.outside, where).toEqual([]);
    }
    // Every part is really on screen in one of the two views.
    expect(Math.min(atBottom.counts.action, atBottom.counts.choice, atBottom.counts.row)).toBeGreaterThan(0);
    expect(inHistory.counts.jump).toBe(1);
  });
});
