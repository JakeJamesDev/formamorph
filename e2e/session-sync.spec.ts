import { test, expect, type Page } from '@playwright/test';
import { openApp } from './app';

/**
 * The app following a session another tab established.
 *
 * `localStorage` is shared across an origin but the `storage` event only ever fires in the *other*
 * documents, so nothing here is provable from a rendered tree — it takes two real pages in one context.
 * Live, the writer is `formamorph.ai/login` and the reader is `formamorph.ai/play/`. Under the runner
 * they are two different dev servers on two ports, which is two origins and therefore two separate
 * `localStorage`s, so a second app page stands in for the site the way `landing.spec.ts` uses `/privacy`
 * to stand in for both. The site half of the same mechanism is covered there.
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
});
