import { test, expect, type Browser, type Page } from '@playwright/test';
import { SITE_URL } from '../playwright.config';

type Box = { x: number; y: number; w: number; h: number };

/** The parts of the hero layout file (`hosting/site/shots/hero/layout.js`) the hero tests read. */
type HeroLayout = {
  size: { w: number; h: number };
  narration: { box: Box };
  choices: { row: Box; box: Box }[];
  stats: { name: string; min: number; max: number }[];
  panel: Box;
  newItem: Box;
  colors: Record<'light' | 'dark', Record<'success' | 'destructive', string>>;
};

declare global {
  interface Window {
    FM_HERO_LAYOUT: HeroLayout;
    /** Set by the theme test to prove no reload happened. */
    __noReload?: boolean;
  }
}

/**
 * The formamorph.ai landing page. It is static files served straight from `hosting/`, so it shares no
 * code with the app and none of its behavior is provable from a rendered tree:
 *
 *  - the onion-skin divider is a pointer drag against real element boxes,
 *  - the palette slideshow is a CSS opacity transition sampled while it runs,
 *  - `prefers-reduced-motion` has to actually reach the page,
 *  - the download buttons resolve against a network response that can fail.
 */

const PALETTES = 5;
const HOLD_MS = 3500;
const FADE_MS = 1200;

/** A release payload shaped like the GitHub API's, with one asset per platform. */
const RELEASE = {
  tag_name: 'v9.9.9',
  assets: [
    { name: 'Formamorph-9.9.9-win.zip', browser_download_url: 'https://example.test/win.zip' },
    { name: 'Formamorph-9.9.9.AppImage', browser_download_url: 'https://example.test/linux.AppImage' },
    { name: 'Formamorph-9.9.9.dmg', browser_download_url: 'https://example.test/mac.dmg' },
  ],
};

const API = 'https://api.github.com/repos/JakeJamesDev/formamorph/releases/latest';
const LATEST = 'https://github.com/JakeJamesDev/formamorph/releases/latest';
/** The APK's name carries no version, so its link is the latest redirect rather than an API asset. */
const APK = `${LATEST}/download/Formamorph-android.apk`;

/** Opacity of every light-stack layer, in palette order. */
const opacities = (page: Page) =>
  page.$$eval('.skin > img.lay', (imgs) => imgs.map((i) => Number(getComputedStyle(i).opacity)));

test.describe('site theme', () => {
  test('the landing page follows the held light preference without rewriting it', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.addInitScript(() => localStorage.setItem('vite-ui-theme', 'light'));
    await page.goto(SITE_URL);

    await expect(page.locator('html')).toHaveClass(/\blight\b/);
    expect(await page.evaluate(() => ({
      colorScheme: getComputedStyle(document.documentElement).colorScheme,
      stored: localStorage.getItem('vite-ui-theme'),
    }))).toEqual({ colorScheme: 'light', stored: 'light' });
  });

  test('the landing page follows the OS when no preference is held', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(SITE_URL);

    await expect(page.locator('html')).toHaveClass(/\blight\b/);
    expect(await page.evaluate(() => localStorage.getItem('vite-ui-theme'))).toBeNull();
  });

  test('an open landing page follows an OS scheme change in system mode', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.addInitScript(() => localStorage.setItem('vite-ui-theme', 'system'));
    await page.goto(SITE_URL);

    await page.emulateMedia({ colorScheme: 'dark' });

    await expect(page.locator('html')).toHaveClass(/\bdark\b/);
    expect(await page.evaluate(() => localStorage.getItem('vite-ui-theme'))).toBe('system');
  });

  test('an open landing page follows a preference changed in another tab', async ({ context }) => {
    const landing = await context.newPage();
    const app = await context.newPage();
    await landing.addInitScript(() => localStorage.setItem('vite-ui-theme', 'light'));
    await landing.goto(SITE_URL);
    await app.goto(`${SITE_URL}/privacy`);

    await app.evaluate(() => localStorage.setItem('vite-ui-theme', 'dark'));

    await expect(landing.locator('html')).toHaveClass(/\bdark\b/);
  });

});

test.describe('landing page', () => {
  test('gallery renders both theme stacks with only the first palette showing', async ({ page }) => {
    await page.goto(SITE_URL);
    const skin = page.locator('.skin');
    await expect(skin).toHaveCount(1);
    await expect(skin.locator('> img.lay')).toHaveCount(PALETTES);
    await expect(skin.locator('.topwrap > img.lay')).toHaveCount(PALETTES);
    await expect(page.locator('.thumbs button')).toHaveCount(5);
    expect(await opacities(page)).toEqual([1, 0, 0, 0, 0]);
    // The images are real files, not placeholders: a broken src decodes to zero width.
    const widths = await skin.locator('> img.lay').first()
      .evaluate((i: HTMLImageElement) => [i.naturalWidth, i.naturalHeight]);
    expect(widths[0]).toBeGreaterThan(600);
    expect(widths[1]).toBeGreaterThan(300);
  });

  test('every asset the page names is really served', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the file set does not vary by viewport');
    await page.goto(SITE_URL);
    // Everything the page points at, including the paths only a link unfurler or a browser tab ever
    // fetches: the favicon, the hero's CSS background, and the social card. A typo in any of those is
    // invisible on screen, so nothing else in this file would see it.
    const urls = await page.evaluate(() => {
      const out = new Set<string>();
      for (const img of document.querySelectorAll('img')) out.add(img.src);
      for (const l of document.querySelectorAll<HTMLLinkElement>('link[rel*="icon"]')) out.add(l.href);
      const bg = getComputedStyle(document.querySelector('.hero .bgimg')!).backgroundImage;
      const url = /url\("?(.+?)"?\)/.exec(bg);
      if (url) out.add(url[1]);
      for (const m of document.querySelectorAll<HTMLMetaElement>('meta[property$="image"], meta[name$="image"]')) {
        out.add(m.content);
      }
      return [...out];
    });
    // The social tags carry the production origin; only the path is this repo's to get right.
    const local = urls.map((u) => u.replace('https://formamorph.ai', SITE_URL));
    expect(local.length).toBeGreaterThanOrEqual(8);
    for (const url of local) {
      const res = await page.request.get(url);
      expect(res.status(), url).toBe(200);
      expect((await res.body()).length, url).toBeGreaterThan(0);
    }
  });

  test('a thumbnail switches the screen the gallery shows', async ({ page }) => {
    await page.goto(SITE_URL);
    await expect(page.locator('.skin > img.lay').first()).toHaveAttribute('src', /01-library/);
    await page.locator('.thumbs button', { hasText: 'Avatars' }).click();
    await expect(page.locator('.skin > img.lay').first()).toHaveAttribute('src', /05-avatar/);
    await expect(page.locator('.skin .topwrap > img.lay').first()).toHaveAttribute('src', /dark.*05-avatar/);
  });

  test('the divider drags', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the drag is proven once; touch uses the same handler');
    await page.goto(SITE_URL);
    const skin = page.locator('.skin');
    await skin.scrollIntoViewIfNeeded();
    const box = (await skin.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.5, { steps: 5 });
    await page.mouse.up();
    const cut = Number((await skin.evaluate((el) => el.style.getPropertyValue('--cut'))).replace('%', ''));
    expect(cut).toBeGreaterThan(70);
    expect(cut).toBeLessThan(90);
  });

  test('the palette fade holds the outgoing layer opaque', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the slideshow is viewport-independent');
    await page.goto(SITE_URL);
    await page.locator('.skin').scrollIntoViewIfNeeded();

    // Sample across one tick and the fade that follows it. A true cross-fade would show the outgoing
    // layer below 1 while the incoming one is still climbing, and that midpoint is the brightness dip
    // the design rejected.
    const trace = await page.evaluate(async (ms) => {
      const read = () => [...document.querySelectorAll('.skin > img.lay')]
        .map((i) => Number(getComputedStyle(i).opacity));
      const out: number[][] = [];
      const until = Date.now() + ms;
      while (Date.now() < until) {
        out.push(read());
        await new Promise((r) => setTimeout(r, 60));
      }
      return out;
    }, HOLD_MS + FADE_MS + 800);

    const climbing = trace.filter((row) => row[1] > 0 && row[1] < 1);
    expect(climbing.length).toBeGreaterThan(3); // the fade was actually observed running
    for (const row of climbing) expect(row[0]).toBe(1); // and the outgoing layer never dipped
    expect(trace[trace.length - 1][1]).toBe(1); // the incoming layer landed
  });

  test('reduced motion leaves the slideshow parked', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the media query is viewport-independent');
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(SITE_URL);
    await page.waitForTimeout(HOLD_MS * 2 + FADE_MS);
    expect(await opacities(page)).toEqual([1, 0, 0, 0, 0]);
    await context.close();
  });

  test('download buttons resolve to the latest release assets', async ({ page }) => {
    await page.route(API, (route) => route.fulfill({ json: RELEASE }));
    await page.goto(SITE_URL);
    const links = page.locator('[data-dl-buttons] a');
    await expect(links).toHaveCount(4);
    await expect(links.nth(0)).toHaveAttribute('href', 'https://example.test/win.zip');
    await expect(links.nth(1)).toHaveAttribute('href', 'https://example.test/linux.AppImage');
    await expect(links.nth(2)).toHaveAttribute('href', 'https://example.test/mac.dmg');
    await expect(links.nth(3)).toHaveAttribute('href', APK);
    await expect(page.locator('[data-dl-note]')).toContainText('v9.9.9');
    // A sideloaded APK raises questions the other three do not, so the guide sits beside the button.
    await expect(page.getByRole('link', { name: 'how to install it' }))
      .toHaveAttribute('href', 'https://github.com/JakeJamesDev/formamorph/wiki/Install-on-Android');
  });

  test('download buttons fall back to the releases page when the API fails', async ({ page }) => {
    await page.route(API, (route) => route.abort('failed'));
    await page.goto(SITE_URL);
    const links = page.locator('[data-dl-buttons] a');
    await expect(links).toHaveCount(4);
    for (const i of [0, 1, 2]) {
      await expect(links.nth(i)).toHaveAttribute('href', LATEST);
    }
    // Android needs no API lookup, so a dead API costs it nothing.
    await expect(links.nth(3)).toHaveAttribute('href', APK);
    await expect(page.locator('[data-dl-note]'))
      .toHaveText('Desktop and Android builds — free on GitHub');
  });

  test('the page fits its viewport', async ({ page }) => {
    await page.goto(SITE_URL);
    // Both projects run this: the phone is what a shared link opens, and the desktop width is what
    // the gallery's max-width was picked for.
    const overflow = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    expect(overflow.scroll).toBeLessThanOrEqual(overflow.client);
    await expect(page.getByRole('link', { name: /Play in your browser/ })).toBeVisible();
    await expect(page.locator('[data-live]')).toBeVisible();
    await expect(page.locator('.skin')).toBeVisible();
  });
});

/**
 * The hero's live turn: overlay text, stat bars and an Inventory switch drawn over the captured game
 * screen. Positions come from the capture's layout file, so every box here is checked against that
 * file's boxes, mapped through the stage's on-screen size.
 */
test.describe('landing hero turn', () => {
  /** Maps a capture box to page pixels through the scaled stage, whose width is the capture's. */
  const toPage = (stage: DOMRect, captureW: number, b: Box) => {
    const s = stage.width / captureW;
    return { x: stage.x + b.x * s, y: stage.y + b.y * s, w: b.w * s, h: b.h * s };
  };

  const finished = async (browser: Browser, colorScheme: 'light' | 'dark' = 'dark') => {
    const context = await browser.newContext({ reducedMotion: 'reduce', colorScheme, viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(SITE_URL);
    await page.locator('[data-live]').scrollIntoViewIfNeeded();
    return { context, page };
  };

  test('the demo waits for the hero to scroll into view, and its first frame loads eagerly', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the observer is viewport-independent');
    await page.setViewportSize({ width: 1280, height: 420 });
    await page.goto(SITE_URL);
    const live = page.locator('[data-live]');
    const base = live.locator('.stage > img');
    await expect(base).toHaveAttribute('fetchpriority', 'high');
    expect(await base.getAttribute('loading')).toBeNull();
    for (const img of await live.locator('.layer > img').all()) await expect(img).toHaveAttribute('loading', 'lazy');

    await page.waitForTimeout(2500);
    expect(await live.locator('.w.on').count()).toBe(0);
    expect(await page.evaluate(() => document.querySelector('[data-live] .stage > .overlay')!.textContent)).toBe('');

    await live.scrollIntoViewIfNeeded();
    await expect(live.locator('.stage > .overlay').first()).toHaveText("I check under the adventurers' back table.", { timeout: 5000 });
  });

  test('narration words fade in one after another over about 250 ms, with no caret', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the fade is viewport-independent');
    await page.goto(SITE_URL);
    // One opacity row per frame for the first six words, sampled from scroll until 1.2 s after the first fade.
    const trace = await page.evaluate(() => new Promise<{ t: number; o: number[] }[]>((done) => {
      document.querySelector('[data-live]')!.scrollIntoView();
      const words = [...document.querySelectorAll('[data-live] .w')].slice(0, 6);
      const rows: { t: number; o: number[] }[] = [];
      const t0 = performance.now();
      let started = 0;
      const tick = () => {
        const t = performance.now() - t0;
        const o = words.map((w) => Number(getComputedStyle(w).opacity));
        rows.push({ t, o });
        if (!started && o[0] > 0) started = t;
        if ((started && t - started > 1200) || t > 10_000) done(rows); else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }));

    const firstFull = (i: number) => trace.find((r) => r.o[i] >= 0.999)?.t ?? Infinity;
    const lastZero = (i: number) => [...trace].reverse().find((r) => r.o[i] === 0)?.t ?? -Infinity;
    expect(trace.some((r) => r.o[0] > 0), 'the narration started').toBe(true);
    for (let i = 0; i < 6; i++) {
      const span = firstFull(i) - lastZero(i);
      expect(trace.filter((r) => r.o[i] > 0.05 && r.o[i] < 0.95).length, `word ${i} mid-fade frames`).toBeGreaterThan(1);
      expect(span, `word ${i} fade length`).toBeGreaterThan(150);
      expect(span, `word ${i} fade length`).toBeLessThan(450);
      if (i) expect(lastZero(i), `word ${i} starts after word ${i - 1}`).toBeGreaterThan(lastZero(i - 1));
    }

    // Nothing but words in the narration: no caret element and no drawn pseudo-element.
    const extras = await page.evaluate(() => {
      const narr = document.querySelector('[data-live] .narr')!;
      const stray = [...narr.querySelectorAll('*')].filter((n) => n.tagName !== 'P' && !n.classList.contains('w'));
      const pseudo = [narr, ...narr.querySelectorAll('*')].flatMap((n) =>
        ['::before', '::after'].map((p) => getComputedStyle(n, p).content)).filter((c) => c !== 'none' && c !== 'normal');
      return { stray: stray.length, pseudo };
    });
    expect(extras).toEqual({ stray: 0, pseudo: [] });
  });

  test('each choice sits inside its captured row, left-aligned', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'one viewport proves the mapping');
    const { context, page } = await finished(browser);
    const read = await page.evaluate(() => {
      const L = window.FM_HERO_LAYOUT;
      const stage = document.querySelector('[data-live] .stage')!.getBoundingClientRect();
      const texts = [...document.querySelectorAll('[data-live] .choice')].map((n) => {
        const r = document.createRange();
        r.selectNodeContents(n);
        return r.getBoundingClientRect().toJSON() as DOMRect;
      });
      return { stage: stage.toJSON() as DOMRect, captureW: L.size.w, rows: L.choices.map((c) => c.row), boxes: L.choices.map((c) => c.box), texts };
    });
    expect(read.texts).toHaveLength(3);
    read.texts.forEach((t, i) => {
      const row = toPage(read.stage, read.captureW, read.rows[i]);
      const box = toPage(read.stage, read.captureW, read.boxes[i]);
      expect(Math.abs(t.x - box.x), `choice ${i} left edge`).toBeLessThan(2);
      expect(t.x).toBeGreaterThanOrEqual(row.x);
      expect(t.x + t.width).toBeLessThanOrEqual(row.x + row.w);
      expect(t.y).toBeGreaterThanOrEqual(row.y - 1);
      expect(t.y + t.height).toBeLessThanOrEqual(row.y + row.h + 1);
    });
    await context.close();
  });

  test('Faith drops with a red band over 46–50 and Renown rises with a green band over 5–10', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'one viewport proves the bands');
    for (const scheme of ['dark', 'light'] as const) {
      const { context, page } = await finished(browser, scheme);
      const read = await page.evaluate((m) => {
        const L = window.FM_HERO_LAYOUT;
        const color = (c: string) => { const n = document.createElement('i'); n.style.color = c; document.body.append(n);
          const out = getComputedStyle(n).color; n.remove(); return out; };
        const tracks = [...document.querySelectorAll('[data-live] .track')];
        const chips = [...document.querySelectorAll('[data-live] .chip')];
        return {
          success: color(L.colors[m].success), destructive: color(L.colors[m].destructive),
          stats: L.stats.map((s, i) => {
            const t = tracks[i].getBoundingClientRect();
            const band = tracks[i].querySelector('.band')!;
            const b = band.getBoundingClientRect();
            const pct = (x: number) => s.min + ((x - t.x) / t.width) * (s.max - s.min);
            return { name: s.name, from: pct(b.x), to: pct(b.x + b.width), band: getComputedStyle(band).backgroundColor,
              chip: chips[i].textContent, chipColor: getComputedStyle(chips[i]).color, chipOpacity: getComputedStyle(chips[i]).opacity };
          }),
        };
      }, scheme);
      const faith = read.stats.find((s) => s.name === 'Faith')!;
      const renown = read.stats.find((s) => s.name === 'Renown')!;
      expect(faith.from).toBeCloseTo(46, 0);
      expect(faith.to).toBeCloseTo(50, 0);
      expect(faith.band).toBe(read.destructive);
      expect([faith.chip, faith.chipColor, faith.chipOpacity]).toEqual(['−4', read.destructive, '1']);
      expect(renown.from).toBeCloseTo(5, 0);
      expect(renown.to).toBeCloseTo(10, 0);
      expect(renown.band).toBe(read.success);
      expect([renown.chip, renown.chipColor, renown.chipOpacity]).toEqual(['+5', read.success, '1']);
      for (const s of read.stats.filter((x) => x.name !== 'Faith' && x.name !== 'Renown')) expect(s.chip).toBe('');
      await context.close();
    }
  });

  test('the played turn ends on the Inventory frame, clipped to the panel, with the ring on the new row', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'one viewport proves the switch');
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(SITE_URL);
    const live = page.locator('[data-live]');
    await live.scrollIntoViewIfNeeded();
    await expect(live.locator('.ring.on')).toHaveCount(1, { timeout: 40_000 });
    await page.waitForTimeout(500);
    const read = await page.evaluate(() => {
      const L = window.FM_HERO_LAYOUT;
      const stage = document.querySelector('[data-live] .stage')!.getBoundingClientRect();
      const s = stage.width / L.size.w;
      const at = (x: number, y: number) => document.elementFromPoint(stage.x + x * s, stage.y + y * s);
      const layers = [...document.querySelectorAll('[data-live] .layer')];
      const ring = document.querySelector('[data-live] .ring')!;
      return {
        stage: stage.toJSON() as DOMRect, captureW: L.size.w, newItem: L.newItem,
        opacity: layers.map((l) => getComputedStyle(l).opacity),
        src: (layers[1].querySelector('img') as HTMLImageElement).src,
        // The after layer tops the stack, so a hit inside the panel lands on it and a hit outside never does.
        inPanel: layers[1].contains(at(L.panel.x + L.panel.w / 2, L.panel.y + L.panel.h / 2)),
        inStory: layers[1].contains(at(L.narration.box.x + 20, L.narration.box.y + 10)),
        ring: ring.getBoundingClientRect().toJSON() as DOMRect,
        ringShadow: getComputedStyle(ring).boxShadow,
      };
    });
    expect(read.opacity).toEqual(['1', '1']);
    expect(read.src).toMatch(/\/hero\/(dark|light)\/inv-after\.webp$/);
    expect(read.inPanel).toBe(true);
    expect(read.inStory).toBe(false);
    const row = toPage(read.stage, read.captureW, read.newItem);
    expect(read.ring.x).toBeLessThanOrEqual(row.x);
    expect(read.ring.y).toBeLessThanOrEqual(row.y);
    expect(read.ring.x + read.ring.width).toBeGreaterThanOrEqual(row.x + row.w);
    expect(read.ring.y + read.ring.height).toBeGreaterThanOrEqual(row.y + row.h);
    expect(read.ringShadow).not.toBe('none');
  });

  test('reduced motion shows the finished turn at once, with no transition', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the media query is viewport-independent');
    const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 420 } });
    const page = await context.newPage();
    await page.goto(SITE_URL);
    // Read before the hero is ever in view: the finished turn does not wait for the observer.
    const read = await page.evaluate(() => {
      const live = document.querySelector('[data-live]')!;
      const all = (s: string) => [...live.querySelectorAll(s)];
      return {
        action: live.querySelector('.stage > .overlay')!.textContent,
        words: [...new Set(all('.w').map((w) => getComputedStyle(w).opacity))],
        choices: [...new Set(all('.choice').map((w) => getComputedStyle(w).opacity))],
        layers: all('.layer').map((l) => getComputedStyle(l).opacity),
        chips: all('.chip').map((c) => c.textContent).filter(Boolean),
        moving: all('*').filter((n) => getComputedStyle(n).transitionDuration.split(',').some((d) => parseFloat(d) > 0)
          || getComputedStyle(n).animationName !== 'none').length,
      };
    });
    expect(read).toEqual({
      action: "I check under the adventurers' back table.",
      words: ['1'], choices: ['1'], layers: ['1', '1'], chips: ['−4', '+5'], moving: 0,
    });
    await context.close();
  });

  test('a site theme switch swaps every hero frame and color without a reload', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the theme rule is viewport-independent');
    const context = await browser.newContext({ reducedMotion: 'reduce', colorScheme: 'light' });
    const page = await context.newPage();
    await page.goto(SITE_URL);
    const read = () => page.evaluate(() => {
      const live = document.querySelector('[data-live]')!;
      const color = (s: string) => getComputedStyle(live.querySelector(s)!).color;
      return {
        frames: [...live.querySelectorAll('img')].map((i) => (i as HTMLImageElement).src.replace(/^.*\/hero\//, '')),
        bg: getComputedStyle(document.querySelector('.hero .bgimg')!).backgroundImage.replace(/^.*\/hero\/|"?\)$/g, ''),
        text: color('.narr'), dialogue: color('.w.q'), action: color('.stage > .overlay'), choice: color('.choice'),
        fill: getComputedStyle(live.querySelector('.fill')!).backgroundColor,
        marker: window.__noReload ?? false,
      };
    });
    const light = await read();
    expect(light.frames).toEqual(['light/stats.webp', 'light/inv-before.webp', 'light/inv-after.webp']);
    expect(light.bg).toBe('light/stats.webp');
    await page.evaluate(() => { window.__noReload = true; });

    await page.emulateMedia({ colorScheme: 'dark' });
    await expect.poll(async () => (await read()).frames[0]).toBe('dark/stats.webp');
    const dark = await read();
    expect(dark.marker).toBe(true);
    expect(dark.frames).toEqual(['dark/stats.webp', 'dark/inv-before.webp', 'dark/inv-after.webp']);
    expect(dark.bg).toBe('dark/stats.webp');
    for (const k of ['text', 'dialogue', 'action', 'choice', 'fill'] as const) expect(dark[k], k).not.toBe(light[k]);
    await context.close();
  });
});

/**
 * The header's account control. It reads `localStorage` the app writes and follows the `storage`
 * event, and neither is provable from a rendered tree: the event only ever fires in a *different*
 * document, so the second test drives two real pages in one context.
 */
test.describe('landing header account control', () => {
  const AVATAR = '/api/avatars/9f2c.webp';
  const control = (page: Page) => page.locator('[data-account]');

  /** Sign in before the page loads, the way a reader arriving with a held session does. */
  const holding = (page: Page, user: Record<string, unknown>) =>
    page.addInitScript(([held]) => {
      localStorage.setItem('authToken', 'tok');
      localStorage.setItem('currentUser', JSON.stringify(held));
    }, [user]);

  /** The stored avatar loads from the API host, which no test run can reach. */
  const serveAvatar = (page: Page) =>
    page.route(`https://api.formamorph.ai${AVATAR}`, (route) =>
      route.fulfill({ path: 'hosting/site/icon.png', contentType: 'image/png' }));

  test('signed out it offers Sign In with a person icon', async ({ page }) => {
    await page.goto(SITE_URL);

    const link = page.getByRole('link', { name: 'Sign In' });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/login?next=/');
    await expect(control(page).locator('svg')).toBeVisible();
    await expect(control(page).locator('img')).toHaveCount(0);
  });

  test('signed in the avatar opens a menu linking to the profile', async ({ page }) => {
    await serveAvatar(page);
    await holding(page, { username: 'rowan', avatarUrl: AVATAR });
    await page.goto(SITE_URL);

    await expect(control(page)).toHaveAttribute('aria-label', 'Account menu');
    await control(page).click();
    await expect(page.getByRole('link', { name: 'Profile', exact: true })).toHaveAttribute('href', '/u/rowan');
    await expect(page.getByText('Sign In')).toHaveCount(0);
    const avatar = control(page).locator('img');
    await expect(avatar).toBeVisible();
    // A real decode, not just an attribute: a wrong origin would render an empty box.
    expect(await avatar.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);
  });

  test('signed in with no avatar it falls back to the shared initial', async ({ page }) => {
    await holding(page, { username: 'rowan' });
    await page.goto(SITE_URL);

    await expect(control(page)).toHaveAttribute('aria-label', 'Account menu');
    await control(page).click();
    await expect(page.getByRole('link', { name: 'Profile', exact: true })).toHaveAttribute('href', '/u/rowan');
    await expect(control(page)).toHaveText('R');
    await expect(page.getByText('Sign In')).toHaveCount(0);
  });

  // The test's own context rather than a fresh one, so the pages carry the project's viewport: a
  // `browser.newContext()` here would run the phone project at desktop size and prove it twice.
  test('a sign-in in another tab reaches an open landing page', async ({ context }) => {
    const landing = await context.newPage();
    const other = await context.newPage();
    await landing.goto(SITE_URL);
    // Any other document on the origin stands in for /login and /play/, which are the real writers.
    await other.goto(`${SITE_URL}/privacy`);

    await other.evaluate(() => {
      localStorage.setItem('authToken', 'tok');
      localStorage.setItem('currentUser', JSON.stringify({ username: 'rowan' }));
    });
    await expect(control(landing)).toHaveAttribute('aria-label', 'Account menu');
    await control(landing).click();
    await expect(landing.getByRole('link', { name: 'Profile', exact: true })).toHaveAttribute('href', '/u/rowan');

    await other.evaluate(() => localStorage.clear());
    await expect(control(landing)).toHaveAttribute('href', '/login?next=/');
    await expect(landing.getByRole('link', { name: 'Sign In' })).toBeVisible();
  });
});

test.describe('privacy policy page', () => {
  // Content, not behavior: the page is static HTML with no script. What can actually break is the
  // path — it lives at `privacy/index.html` so that `/privacy` resolves the same way here as it does
  // on Pages, and a move to `privacy.html` would 404 locally while still working in production.
  test('/privacy serves the policy', async ({ page }) => {
    const response = await page.goto(`${SITE_URL}/privacy`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeVisible();
  });
});
