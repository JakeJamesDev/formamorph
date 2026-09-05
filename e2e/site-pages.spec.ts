import { test, expect, type Page } from '@playwright/test';
import { PAGES_URL, SITE_URL } from '../playwright.config';

/** `#rrggbb` or `rgb(r, g, b)` as three numbers. */
const channels = (color: string): [number, number, number] => {
  const hex = color.trim().match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (hex) return [1, 2, 3].map((i) => parseInt(hex[i], 16)) as [number, number, number];
  const rgb = color.match(/(\d+)\D+(\d+)\D+(\d+)/);
  if (!rgb) throw new Error(`Not a color: ${color}`);
  return [1, 2, 3].map((i) => Number(rgb[i])) as [number, number, number];
};

/** What the landing page declares, read from the landing page itself rather than copied here. */
const landingPalette = async (page: Page) => {
  await page.goto(SITE_URL);
  return page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return { bg: style.getPropertyValue('--bg'), accent: style.getPropertyValue('--accent') };
  });
};

/**
 * The formamorph.ai account pages. They are their own Vite entry with their own palette, so what jsdom
 * cannot see is exactly what matters here: that the page really lays out inside a phone's width, that
 * the landing page's colors reach the controls, and that the client-side routing serves a route the
 * hosting rules rewrite rather than a 404.
 */

test.describe('site pages', () => {
  test('the login page lays out inside the viewport', async ({ page }) => {
    await page.goto(`${PAGES_URL}/login`);

    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    await expect(page.getByLabel('Username')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();

    // The one failure a rendered tree cannot show: a panel wider than the phone it is read on.
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBe(0);
  });

  test('the controls wear the landing page palette, not the game one', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the palette does not vary by viewport');
    const landing = await landingPalette(page);

    await page.goto(`${PAGES_URL}/login`);
    const ground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const button = await page.getByRole('button', { name: 'Sign In' })
      .evaluate((node) => getComputedStyle(node).backgroundColor);

    // Within a channel or two of the landing page's own values, read out of the landing page. The
    // tokens the primitives read are HSL with whole-number parts, which cannot land on an arbitrary
    // hex exactly. The two palettes this guards against are nowhere near: the game's ground is a
    // blue-black and its primary a pale cyan, both tens of channels away.
    for (const [got, want] of [[ground, landing.bg], [button, landing.accent]] as const) {
      const [r, g, b] = channels(got);
      const [wr, wg, wb] = channels(want);
      expect(Math.max(Math.abs(r - wr), Math.abs(g - wg), Math.abs(b - wb)),
        `${got} against the landing page's ${want.trim()}`).toBeLessThanOrEqual(3);
    }
  });

  test('the register page is reachable and its own page', async ({ page }) => {
    await page.goto(`${PAGES_URL}/register`);

    await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible();
    await expect(page.getByLabel('Confirm Password')).toBeVisible();
  });

  test('a path the entry does not serve renders the not-found page', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the fallback does not vary by viewport');
    await page.goto(`${PAGES_URL}/nothing-here`);

    await expect(page.getByRole('heading', { name: 'Page Not Found' })).toBeVisible();
  });
});
