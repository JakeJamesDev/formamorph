import { test, expect, type Page } from '@playwright/test';
import { SITE_URL } from '../playwright.config';

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
    await expect(page.locator('.skin')).toBeVisible();
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
