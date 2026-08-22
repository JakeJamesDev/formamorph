import { test, expect, type Page } from '@playwright/test';
import { openApp, gotoDev, signIn } from './app';

/**
 * Publishing a world into a running contest, end to end: sign in, publish with the entry switch on, and
 * find the listing in both the Contest tab and the catalog it also belongs to. Then the other half of a
 * contest's life — staff pick the winner, and the trophy reaches the author's own library.
 *
 * This one needs a server. Every part of the entry — the switch's own visibility, the flag riding the
 * publish body, the tab reading the entries back — is covered against mocks in the unit suite; what no
 * mock can show is that those three agree with what the real API stores and returns. So the flow runs
 * against a local FormamorphServer and skips wherever there isn't one, which is most machines.
 *
 * ```bash
 * # a scratch server, its own database, an active contest seeded through the admin API
 * E2E_API_URL=http://localhost:8797/api npm run test:e2e -- --project=desktop
 * ```
 *
 * See [the README](e2e/README.md) for the full seeding recipe.
 */

/** Where the local server is. Unset — the normal case — skips the flow. */
const API = process.env.E2E_API_URL ?? '';

interface ServerEvent {
  id: string;
  type: string;
  title: string;
  winnerWorldId?: string | null;
}

/** The staff account the winner pick goes through; the seeding recipe's defaults. */
const ADMIN = {
  username: process.env.E2E_ADMIN_USERNAME ?? 'e2eadmin',
  password: process.env.E2E_ADMIN_PASSWORD ?? 'e2eadminpass',
};

/** Set when the flow cannot run here; the test reports it as a skip rather than a failure. */
let unavailable = '';
/** Set when the entry flow can run but the winner half cannot — a contest only ever decides once. */
let cannotPickWinner = '';
/** The staff bearer the winner pick goes through, once `beforeAll` has proved there is one. */
let adminToken: string | null = null;
/** The contest this run enters, read from the server. */
let contest: ServerEvent | null = null;

/** A fresh account per run: a contest takes one entry per creator, so a reused one enters exactly once. */
function newCredentials(): { username: string; password: string } {
  return { username: `e2e${Math.random().toString(36).slice(2, 12)}`, password: 'e2e-password' };
}

test.beforeAll(async () => {
  if (!API) {
    unavailable = 'set E2E_API_URL to a local FormamorphServer to run the contest flow';
    return;
  }

  let events: ServerEvent[];
  try {
    const response = await fetch(`${API}/events/active`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    events = ((await response.json()) as { data?: ServerEvent[] }).data ?? [];
  } catch (error) {
    unavailable = `no server answering at ${API} (${(error as Error).message})`;
    return;
  }

  const found = events.find((event) => event.type === 'contest');
  if (!found) {
    unavailable = `${API} has no contest running — seed one through the admin API first (see e2e/README.md)`;
    return;
  }

  contest = found;
  // A contest refuses a second pick, so a scratch server that has already run this once needs a fresh
  // one. Said as a skip with the reason rather than a failure, like every other precondition here.
  if (found.winnerWorldId) {
    cannotPickWinner = `${found.title} already has a winner — seed a fresh contest to run the winner half`;
    return;
  }

  // Checked here rather than mid-flow: without a staff account the winner half cannot run at all, and
  // finding that out after publishing would spend one of the server's few credential calls for nothing.
  adminToken = await tokenFor(ADMIN.username, ADMIN.password);
  if (!adminToken) {
    cannotPickWinner = `no staff account at ${API} for ${ADMIN.username} — set E2E_ADMIN_USERNAME/PASSWORD`;
  }
});

/** A bearer token for an account, from the API rather than the UI — fixture setup, not the subject. */
async function tokenFor(username: string, password: string): Promise<string | null> {
  const response = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { token?: string; data?: { token?: string } };
  return body.token ?? body.data?.token ?? null;
}

/**
 * Make the account this run signs in as.
 *
 * Fixture setup rather than the subject — the flow signs in through the UI with what this returns. A
 * refusal is a real failure: the server answered, so something about it is wrong. Called from the test
 * body rather than `beforeAll` so the run that skips (the mobile project) doesn't spend one of the
 * server's twenty credential calls per quarter hour on an account it never uses.
 */
async function registerAccount(): Promise<{ username: string; password: string }> {
  const credentials = newCredentials();
  const registered = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  if (!registered.ok) {
    const body = (await registered.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new Error(`Could not register an E2E account: ${body.error || body.message || registered.status}`);
  }
  return credentials;
}

/** Everything this flow legitimately talks to runs on this machine: the dev server, the local API, and
 *  the dead endpoint `openApp` seeds so the AI setup gate stays shut. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Refuse every off-machine request, and remember it.
 *
 * The app reads its API base from `VITE_API_URL_DEV` at dev-server start, and the default in `.env` is
 * the live workshop. A run against a dev server started without the override would otherwise publish a
 * world to production — so anything leaving this machine is cut off here and fails the test instead.
 */
async function pinToLocalApi(page: Page): Promise<string[]> {
  const stray: string[] = [];
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (LOCAL_HOSTS.has(new URL(url).hostname)) return route.continue();
    stray.push(url);
    return route.abort();
  });
  return stray;
}

/**
 * Sign in as a fresh account and publish the first bundled world into the running contest.
 *
 * Shared by both flows below rather than repeated: each needs an entry of its own (one per creator), and
 * everything up to "published successfully" is the same journey.
 *
 * @returns The account it made, the world it published, and the off-machine requests it caught
 */
async function publishIntoTheContest(page: Page): Promise<{
  username: string; password: string; worldName: string; stray: string[];
}> {
  const running = contest!;
  const { username, password } = await registerAccount();

  const stray = await pinToLocalApi(page);
  // The contest's posters are acknowledge-only and would sit over the menu for the whole flow. Both
  // phases are answered before the first paint: the winner half sees the closing one too.
  await openApp(page, {
    FORMAMORPH_eventAcknowledged: [`${running.id}:start`, `${running.id}:end`],
  });

  await signIn(page, username, password);
  expect(stray, `the dev server on this port is not pointed at ${API} — restart it with E2E_API_URL set`)
    .toEqual([]);

  // The bundled worlds seed into IndexedDB after the menu mounts; publishing one needs it to be there.
  await page.getByText('Loaded default worlds').waitFor({ state: 'visible' });
  const worldName = await page.evaluate(async () => {
    const dev = (window as unknown as { __fmDev: { listWorlds(): Promise<{ id: string; name: string }[]> } }).__fmDev;
    return (await dev.listWorlds())[0].name;
  });

  await page.getByText(worldName, { exact: true }).first().click();
  await page.getByRole('button', { name: 'Publish World' }).click();

  const publishDialog = page.getByRole('dialog').filter({ hasText: 'Publish World' });
  await publishDialog.getByRole('switch', { name: `Enter into ${running.title}` }).click();

  const publishButton = publishDialog.getByRole('button', { name: 'Publish & Enter' });
  await expect(publishButton).toBeVisible();
  await publishButton.click();

  // The upload gate and the tag notice are policy popups the server may or may not be serving. Neither is
  // what this flow is about, so each is answered if it appears rather than assumed away.
  for (const label of ['Accept', 'Continue']) {
    const confirm = page.getByRole('button', { name: label, exact: true });
    if (await confirm.isVisible().catch(() => false)) await confirm.click();
  }

  await expect(page.getByText('World published successfully!')).toBeVisible();

  return { username, password, worldName, stray };
}

test('a world published with the entry switch on shows up in the contest tab', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one viewport is enough for a server flow');
  test.skip(Boolean(unavailable), unavailable);
  const { username, worldName, stray } = await publishIntoTheContest(page);

  await gotoDev(page, 'mainMenu', { modal: 'community' });
  // Narrowed to this run's author: the grid pages, and a contest shuffles its entries, so the one listing
  // that matters could otherwise be on a page the assertion never looks at.
  await page.getByPlaceholder('Search Worlds…', { exact: false }).fill(`author:${username} `);

  const catalogEntry = page.getByText(`By ${username}`, { exact: true });
  await expect(catalogEntry).toBeVisible();

  await page.getByRole('tab', { name: 'Contest' }).click();
  // The bar's Rules button, not the contest's title: the title also sits in the menu's event banner
  // behind this dialog. What ties the grid below to *this* contest is the entry itself — the tab shows
  // only worlds carrying the contest's id, so a listing appearing here is the server having stored it.
  await expect(page.getByRole('button', { name: 'Rules' })).toBeVisible();
  await expect(catalogEntry).toBeVisible();
  await expect(page.getByText(worldName, { exact: true }).first()).toBeVisible();

  expect(stray).toEqual([]);
});

test('the winner wears its trophy in the library it was published from', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one viewport is enough for a server flow');
  test.skip(Boolean(unavailable), unavailable);
  test.skip(Boolean(cannotPickWinner), cannotPickWinner);

  const running = contest!;
  const { username, password, worldName, stray } = await publishIntoTheContest(page);

  // The listing id, read as the author: what the pick names, and what the local copy was linked to when
  // it published. Both halves of the badge's matching rule meet on this one string.
  const authorToken = await tokenFor(username, password);
  expect(authorToken, 'the account this run just registered could not log in through the API').toBeTruthy();
  const mine = await fetch(`${API}/users/me/worlds`, { headers: { Authorization: `Bearer ${authorToken}` } });
  const listingId = ((await mine.json()) as { data?: { id: string }[] }).data?.[0]?.id;
  expect(listingId, 'the published listing is not on the author’s own list').toBeTruthy();

  const picked = await fetch(`${API}/events/${running.id}/winner`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ worldId: listingId }),
  });
  expect(picked.ok, `the winner pick was refused: ${await picked.text()}`).toBe(true);

  // Nothing about the win is stored locally, so the library learns it by reading the archive again.
  await page.reload();
  await page.waitForFunction(() => '__fmDev' in window);
  await page.getByText('Loaded default worlds').waitFor({ state: 'visible' });

  const badge = page.getByText(`Winner — ${running.title}`);
  await expect(badge.first()).toBeVisible();

  // And again one click in: the details modal is where the honor used to be lost.
  await page.getByText(worldName, { exact: true }).first().click();
  const details = page.getByRole('dialog').filter({ hasText: worldName });
  await expect(details.getByText(`Winner — ${running.title}`)).toBeVisible();

  expect(stray).toEqual([]);
});
