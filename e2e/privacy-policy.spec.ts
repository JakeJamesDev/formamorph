import { test, expect, type Page } from '@playwright/test';
import { openApp, gotoDev } from './app';

/**
 * The Privacy Policy, on the two paths a player actually meets it: creating an account, and signing into
 * one that has never answered it.
 *
 * This is the path the client update ships on, so it is worth a real browser rather than only the jsdom
 * suite. What the component tests cannot show is that the prompt reaches the screen over the app's own
 * dialogs, and that the session it ends is really gone from the menu behind it.
 *
 * The server is answered from here rather than run: what is under test is the client's half of the
 * exchange, and a spec that skipped without a server would never guard it.
 */

const POLICY = {
  title: 'Privacy Policy',
  body: 'We keep a salted hash of your network address for 90 days, and use it only to detect abuse.',
};

const ACCOUNT = { id: 'e2e-user', username: 'newcomer', avatarUrl: null, status: 'normal' };

const LISTING = {
  _id: 'e2e-world-1', id: 'e2e-world-1', kind: 'world',
  name: 'E2E Sedge Landing', description: 'A canned world for the privacy path.',
  author: { id: 'e2e-author', username: 'e2eauthor' },
  tags: [], likes: 0, liked: false, updated_at: '2026-02-01T00:00:00.000Z',
};

/** Everything the app reads that is not the policy itself: the catalog, the profile, the empty feeds. */
async function stubEverythingElse(page: Page): Promise<void> {
  await page.route('**/worlds?*', (route) => route.fulfill({
    json: { success: true, data: [LISTING], total: 1 },
  }));
  await page.route('**/worlds/*/comments*', (route) => route.fulfill({ json: { success: true, data: [] } }));
  await page.route('**/events', (route) => route.fulfill({ json: { data: [] } }));
  await page.route('**/events?*', (route) => route.fulfill({ json: { data: [] } }));
  await page.route('**/auth/me', (route) => route.fulfill({ json: { user: ACCOUNT } }));
  await page.route('**/users/*/profile*', (route) => route.fulfill({ json: { success: true, data: null } }));
  await page.route('**/messages/**', (route) => route.fulfill({ json: { success: true, data: [] } }));
  await page.route('**/notifications/**', (route) => route.fulfill({ json: { success: true, data: [] } }));
}

/** The signed-in policy read, answered with whichever acceptance state the test needs next. */
async function stubPolicyState(page: Page, accepted: () => boolean): Promise<void> {
  await page.route('**/api/policies', (route) => route.fulfill({
    json: {
      success: true,
      uploadGate: null,
      tagNotice: null,
      privacyPolicy: { ...POLICY, tags: [], accepted: accepted() },
    },
  }));
}

/**
 * Open the account dialog and switch it to its register half.
 *
 * The dialog renames its own title and description with the mode, so it is located by role alone rather
 * than by any text that the switch changes underneath the locator.
 */
async function openRegisterForm(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Login' }).click();
  const auth = page.getByRole('dialog');
  await auth.getByRole('button', { name: 'Create Account' }).click();
  await expect(auth.getByRole('heading', { name: 'Register' })).toBeVisible();
  await auth.getByLabel('Username').fill(ACCOUNT.username);
  await auth.getByLabel('Password', { exact: true }).fill('hunter2!');
  await auth.getByLabel('Confirm Password').fill('hunter2!');
  await auth.getByRole('button', { name: 'Register', exact: true }).click();
}

test.describe('the Privacy Policy at signup', () => {
  test('shows the policy, and a like works once it is accepted', async ({ page }) => {
    let accepted = false;
    const sent: string[] = [];

    await stubEverythingElse(page);
    await stubPolicyState(page, () => accepted);

    // The public read: no token, because the account does not exist yet.
    await page.route('**/policies/privacy-policy', (route) => route.fulfill({
      json: { success: true, privacyPolicy: POLICY },
    }));
    await page.route('**/auth/register', (route) => {
      sent.push('register');
      return route.fulfill({ json: { token: 'e2e-token', user: ACCOUNT } });
    });
    await page.route('**/policies/privacy-policy/accept', (route) => {
      sent.push('accept');
      accepted = true;
      return route.fulfill({ json: { success: true, accepted: true } });
    });
    await page.route('**/worlds/*/like', (route) => {
      sent.push('like');
      return route.fulfill({ json: { success: true, likes: 1, liked: true } });
    });

    await openApp(page);

    await openRegisterForm(page);

    // The policy stands in front of the account being made.
    const prompt = page.getByRole('dialog').filter({ hasText: POLICY.body });
    await expect(prompt).toBeVisible();
    expect(sent).toEqual([]);

    await prompt.getByRole('button', { name: 'Accept and Create Account' }).click();
    await page.getByRole('button', { name: /^User Profile/ }).waitFor();
    expect(sent).toEqual(['register', 'accept']);

    // The account is through the gate, so an ordinary signed-in action goes through.
    await gotoDev(page, 'mainMenu', { modal: 'community' });
    await page.getByRole('button', { name: /^Like — / }).first().click();
    await expect.poll(() => sent).toContain('like');
  });

  test('creates no account when the policy is declined', async ({ page }) => {
    const sent: string[] = [];

    await stubEverythingElse(page);
    await stubPolicyState(page, () => false);
    await page.route('**/policies/privacy-policy', (route) => route.fulfill({
      json: { success: true, privacyPolicy: POLICY },
    }));
    await page.route('**/auth/register', (route) => {
      sent.push('register');
      return route.fulfill({ json: { token: 'e2e-token', user: ACCOUNT } });
    });

    await openApp(page);

    await openRegisterForm(page);

    const prompt = page.getByRole('dialog').filter({ hasText: POLICY.body });
    await expect(prompt).toBeVisible();
    await prompt.getByRole('button', { name: 'Decline' }).click();

    await expect(prompt).toBeHidden();
    // Still signed out, and nothing was ever sent.
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
    expect(sent).toEqual([]);
  });
});

test.describe('the Privacy Policy at sign-in', () => {
  test('prompts an unaccepted account, and signing out returns to the signed-out state', async ({ page }) => {
    await stubEverythingElse(page);
    await stubPolicyState(page, () => false);
    await page.route('**/auth/login', (route) => route.fulfill({ json: { token: 'e2e-token', user: ACCOUNT } }));

    await openApp(page);

    await page.getByRole('button', { name: 'Login' }).click();
    const auth = page.getByRole('dialog').filter({ has: page.getByText('Enter your credentials') });
    await auth.getByLabel('Username').fill(ACCOUNT.username);
    await auth.getByLabel('Password', { exact: true }).fill('hunter2!');
    await auth.getByRole('button', { name: 'Login', exact: true }).click();

    const prompt = page.getByRole('dialog').filter({ hasText: POLICY.body });
    await expect(prompt).toBeVisible();

    await prompt.getByRole('button', { name: 'Sign Out' }).click();

    await expect(prompt).toBeHidden();
    // The menu behind it follows the session, rather than keeping a signed-in header over no session.
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^User Profile/ })).toHaveCount(0);
  });
});
