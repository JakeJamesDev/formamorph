import { test, expect, type Page } from '@playwright/test';
import { PAGES_URL, SITE_URL } from '../playwright.config';
import { openApp } from './app';

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

  test('the signed-in account controls stay visible and usable', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('authToken', 'held-token');
      localStorage.setItem('currentUser', JSON.stringify({ username: 'rowan' }));
    });
    await page.goto(`${PAGES_URL}/login`);

    await expect(page.getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/u/rowan');
    await expect(page.getByRole('link', { name: 'Account Settings' })).toHaveAttribute('href', '/account');
    await expect(page.getByRole('button', { name: 'Sign Out' })).toBeVisible();
    expect(await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);

    await page.getByRole('button', { name: 'Sign Out' }).click();

    await expect(page.getByRole('link', { name: 'Sign In' })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('authToken'))).toBeNull();
  });

  test('a canceled deletion is announced after the safe return', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the one-time message does not vary by viewport');
    await page.route('**/auth/login', (route) => route.fulfill({
      json: {
        token: 'fresh-token',
        user: { username: 'rowan' },
        deletionCancelled: true,
      },
    }));
    await page.route('**/auth/me', (route) => route.fulfill({
      json: { user: { username: 'rowan', email: null, emailVerified: false } },
    }));
    await page.goto(`${PAGES_URL}/login?next=%2Faccount`);

    await page.getByLabel('Username').fill('rowan');
    await page.getByLabel('Password').fill('hunter22');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page).toHaveURL(`${PAGES_URL}/account`);
    await expect(page.getByRole('status')).toContainText('Account deletion canceled');
  });

  test('an open site page follows foreign session and avatar changes', async ({ context }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'storage events do not vary by viewport');
    await context.route('**/auth/login', (route) => route.fulfill({
      json: { token: 'foreign-token', user: { username: 'rowan' } },
    }));
    await context.route('https://api.formamorph.ai/api/avatars/new.webp', (route) => route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"/>',
    }));
    const reader = await context.newPage();
    const writer = await context.newPage();
    await reader.goto(`${PAGES_URL}/login`);
    await writer.goto(`${PAGES_URL}/login`);
    await expect(reader.getByRole('link', { name: 'Sign In' })).toBeVisible();

    await writer.getByLabel('Username').fill('rowan');
    await writer.getByLabel('Password').fill('hunter22');
    await writer.getByRole('button', { name: 'Sign In' }).click();
    await expect(writer.getByRole('link', { name: 'Profile' })).toBeVisible();
    await expect(reader.getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/u/rowan');

    await writer.evaluate(() => localStorage.setItem('currentUser', JSON.stringify({
      username: 'rowan',
      avatarUrl: '/api/avatars/new.webp',
    })));
    await expect(reader.getByRole('link', { name: 'Profile' }).locator('img'))
      .toHaveAttribute('src', 'https://api.formamorph.ai/api/avatars/new.webp');

    await reader.getByRole('button', { name: 'Sign Out' }).click();
    await expect(writer.getByRole('link', { name: 'Sign In' })).toBeVisible();
  });

  test('site sign-out reaches the open app and landing page without reloads', async ({ context }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'storage events do not vary by viewport');
    await context.route('**/auth/me', (route) => route.fulfill({ json: { username: 'rowan' } }));
    const app = await context.newPage();
    const site = await context.newPage();
    const landing = await context.newPage();
    const held = { authToken: 'shared-token', currentUser: { username: 'rowan' } };
    await openApp(app, held, { url: `${PAGES_URL}/play/` });
    await site.goto(`${PAGES_URL}/account`);
    await landing.goto(`${PAGES_URL}/landing/`);

    const appAccount = app.locator('button[aria-label="Login"], button[aria-label^="User Profile"]');
    await expect(appAccount).toHaveAttribute('aria-label', /^User Profile/);
    await expect(landing.locator('[data-account]')).toHaveAttribute('href', '/u/rowan');
    await app.evaluate(() => Object.assign(window, { __documentMarker: 'app-alive' }));
    await landing.evaluate(() => Object.assign(window, { __documentMarker: 'landing-alive' }));

    await site.getByRole('button', { name: 'Sign Out' }).click();

    await expect(appAccount).toHaveAttribute('aria-label', 'Login');
    await expect(landing.locator('[data-account]')).toHaveAttribute('href', '/login?next=/');
    expect(await app.evaluate(() => (window as Window & { __documentMarker?: string }).__documentMarker))
      .toBe('app-alive');
    expect(await landing.evaluate(() => (window as Window & { __documentMarker?: string }).__documentMarker))
      .toBe('landing-alive');
  });
});
