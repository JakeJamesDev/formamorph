import { test, expect, type Page } from '@playwright/test';
import { openApp } from './app';
import { PAGES_URL } from '../playwright.config';

/**
 * The app following a session another tab established.
 *
 * `localStorage` is shared across an origin but the `storage` event only ever fires in the *other*
 * documents, so nothing here is provable from a rendered tree — it takes two real pages in one context.
 * The site-pages server proxies a second app dev server below `/play/`, matching production's shared
 * origin so the real login and logout controls can prove both cross-surface directions without reloads.
 * The smaller app-to-app cases remain direct listener checks.
 */

const HELD = { username: 'rowan' };

/** The community server, which no run can reach. A 401 on `/auth/me` would sign the token straight out. */
const stubServer = async (page: Page) => {
  await page.route('https://api.formamorph.ai/**', (route) => route.fulfill({ json: { data: [] } }));
  await page.route('**/auth/me', (route) => route.fulfill({ json: HELD }));
};

/** The account circle in the footer: "Login" signed out, "User Profile" signed in. */
const account = (page: Page) => page.locator('button[aria-label="Login"], button[aria-label^="User Profile"]');

/** Write the session the way any sign-in does. The other tab's listener is what this is aimed at. */
const signIn = (page: Page) => page.evaluate((held) => {
  localStorage.setItem('authToken', 'shared-token');
  localStorage.setItem('currentUser', JSON.stringify(held));
}, HELD);

test.describe('a session from another tab', () => {
  // The test's own context rather than a fresh one, so both pages carry the project's viewport.
  test('a sign-in elsewhere reaches the open menu without a reload', async ({ context }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the storage event does not vary by viewport');
    const app = await context.newPage();
    const other = await context.newPage();
    await stubServer(app);
    await stubServer(other);
    await openApp(app);
    await openApp(other);

    await expect(account(app)).toHaveAttribute('aria-label', 'Login');
    const before = await app.evaluate(() => performance.getEntriesByType('navigation').length);

    await signIn(other);

    await expect(account(app)).toHaveAttribute('aria-label', /^User Profile/);
    // Still the document that was open: an adoption that reloaded would have logged a second navigation.
    expect(await app.evaluate(() => performance.getEntriesByType('navigation').length)).toBe(before);
  });

  test('signing out in the app reaches the other tab', async ({ context }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the storage event does not vary by viewport');
    const app = await context.newPage();
    const other = await context.newPage();
    await stubServer(app);
    await stubServer(other);
    await openApp(app, { authToken: 'shared-token', currentUser: HELD });
    await openApp(other, { authToken: 'shared-token', currentUser: HELD });

    await expect(account(app)).toHaveAttribute('aria-label', /^User Profile/);
    await expect(account(other)).toHaveAttribute('aria-label', /^User Profile/);

    // Through the real control, because clearing the keys by hand would prove only the listener.
    await account(app).click();
    await app.getByRole('button', { name: 'Logout' }).click();

    await expect(account(app)).toHaveAttribute('aria-label', 'Login');
    await expect(account(other)).toHaveAttribute('aria-label', 'Login');
  });

  test('site sign-in reaches the app and app sign-out reaches the site without reloads', async ({ context }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'storage events do not vary by viewport');
    await context.route('**/auth/login', (route) => route.fulfill({
      json: { token: 'shared-token', user: HELD },
    }));
    await context.route('**/auth/me', (route) => route.fulfill({ json: HELD }));
    const app = await context.newPage();
    const site = await context.newPage();
    await openApp(app, {}, { url: `${PAGES_URL}/play/` });
    await site.goto(`${PAGES_URL}/login`);
    await app.evaluate(() => Object.assign(window, { __documentMarker: 'app-alive' }));

    await site.getByLabel('Username').fill('rowan');
    await site.getByLabel('Password').fill('hunter22');
    await site.getByRole('button', { name: 'Sign In' }).click();

    await expect(site.getByRole('link', { name: 'Profile' })).toBeVisible();
    await expect(account(app)).toHaveAttribute('aria-label', /^User Profile/);
    expect(await app.evaluate(() => (window as Window & { __documentMarker?: string }).__documentMarker))
      .toBe('app-alive');
    await site.evaluate(() => Object.assign(window, { __documentMarker: 'site-alive' }));

    await account(app).click();
    await app.getByRole('button', { name: 'Logout' }).click();

    await expect(account(app)).toHaveAttribute('aria-label', 'Login');
    await expect(site.getByRole('link', { name: 'Sign In' })).toBeVisible();
    expect(await site.evaluate(() => (window as Window & { __documentMarker?: string }).__documentMarker))
      .toBe('site-alive');
  });
});
