import { test, expect, type Page } from '@playwright/test';
import { openApp, gotoDev, signIn } from './app';
import { REASONING_CATALOG_URL } from '../src/lib/reasoningCatalog';

/**
 * Publishing a world into a running contest, end to end: sign in, publish with the entry switch on, and
 * find the listing in both the Contest tab and the catalog it also belongs to. Then the other half of a
 * contest's life — an admin builds a shared 1st place in the Podium dialog, announces it, and the result
 * reaches the band, the cards and the bar the author reads it on.
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

interface EventPlacement {
  place: 1 | 2 | 3;
  worldId: string | null;
  worldName: string;
  authorName: string;
}

interface ServerEvent {
  id: string;
  type: string;
  title: string;
  resultsAnnouncedAt?: string | null;
  placements?: EventPlacement[];
}

/** The admin account the announce goes through; the seeding recipe's defaults. Admin, not any staff:
 *  announcing results speaks to every player at once, so the server refuses a moderator. */
const ADMIN = {
  username: process.env.E2E_ADMIN_USERNAME ?? 'e2eadmin',
  password: process.env.E2E_ADMIN_PASSWORD ?? 'e2eadminpass',
};

/** Set when the flow cannot run here; the test reports it as a skip rather than a failure. */
let unavailable = '';
/** Set when the entry flow can run but the results half cannot — a contest only ever announces once. */
let cannotAnnounce = '';
/** The admin bearer the announce goes through, once `beforeAll` has proved there is one. */
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
  // A contest refuses a second announcement, so a scratch server that has already run this once needs a
  // fresh one. Said as a skip with the reason rather than a failure, like every other precondition here.
  if (found.resultsAnnouncedAt) {
    cannotAnnounce = `${found.title} has already announced its results — seed a fresh contest for that half`;
    return;
  }

  // Checked here rather than mid-flow: without an admin account the results half cannot run at all, and
  // finding that out after publishing would spend one of the server's few credential calls for nothing.
  adminToken = await tokenFor(ADMIN.username, ADMIN.password);
  if (!adminToken) {
    cannotAnnounce = `no admin account at ${API} for ${ADMIN.username} — set E2E_ADMIN_USERNAME/PASSWORD`;
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

/** One placeable entry, reduced to what the flow has to name it by. */
interface Entry {
  id: string;
  /** Who published it. Every run publishes the same bundled world, so the author is what tells two apart. */
  author: string;
  publishedAt: string;
}

/**
 * The contest's other entries, oldest listing first — which is the order the server stores a tie in.
 *
 * Empty when this run's world is the only one. A tie needs two worlds, so the flow reports that as a
 * skip rather than inventing a second entrant.
 *
 * @param mine - The listing id to exclude
 */
async function entriesOtherThan(mine: string): Promise<Entry[]> {
  const response = await fetch(`${API}/worlds?page=1&limit=1000`);
  if (!response.ok) return [];
  const catalog = ((await response.json()) as {
    data?: {
      id: string;
      created_at: string;
      author?: { username?: string } | null;
      contest_event_id?: string | null;
      quarantined_at?: string | null;
    }[];
  }).data ?? [];

  return catalog
    .filter((row) => row.contest_event_id === contest!.id
      && row.id !== mine
      && !row.quarantined_at
      && Boolean(row.author?.username))
    .map((row) => ({ id: row.id, author: row.author!.username!, publishedAt: row.created_at }))
    .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
}

/**
 * Close the contest, so the admin tools offer the podium.
 *
 * Announcing is offered on a contest that has stopped taking entries, and this run publishes into one
 * that is still open — so the window is moved rather than waited out. It is the same transition a
 * contest makes on its own; only the clock is skipped.
 */
async function closeTheContest(): Promise<void> {
  const closed = await fetch(`${API}/events/${contest!.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ endsAt: new Date(Date.now() - 60_000).toISOString() }),
  });
  expect(closed.ok, `could not close the contest for judging: ${await closed.text()}`).toBe(true);
}

/**
 * Close whatever dialogs are open, the way a player closes them.
 *
 * A modal puts everything behind it out of the accessibility tree, so the footer's account button is
 * unreachable while one stands — and both halves of this flow leave one open: publishing leaves the
 * world's own details dialog, announcing leaves the admin panel.
 */
async function closeDialogs(page: Page): Promise<void> {
  const dialogs = page.getByRole('dialog');
  for (let open = await dialogs.count(); open > 0; open -= 1) {
    await page.keyboard.press('Escape');
    await expect(dialogs).toHaveCount(open - 1);
  }
}

/** Sign the current account out through the account dialog, so the next one can sign in. */
async function signOut(page: Page): Promise<void> {
  await closeDialogs(page);
  await gotoDev(page, 'mainMenu', { modal: 'profile' });
  await page.getByRole('button', { name: 'Logout' }).click();
  // Off the profile route before the next sign-in. The account dialog is one surface signed in or out,
  // so a route still pointing at it re-opens it over the menu the moment there is an account again.
  await gotoDev(page, 'mainMenu');
  await closeDialogs(page);
  await page.getByRole('button', { name: 'Login' }).waitFor();
}

/** Everything this flow legitimately talks to runs on this machine: the dev server, the local API, and
 *  the dead endpoint `openApp` seeds so the AI setup gate stays shut. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * The one off-machine address the app reaches for on its own: the public reasoning catalog, read once
 * per launch to learn which model ids think. It is still cut off — nothing here needs it — but it is not
 * what the assertion is watching for, so it does not fail the run. Imported rather than written out
 * again, so moving the catalog re-opens this decision instead of quietly widening it.
 */
const EXPECTED_OFF_MACHINE = new Set([REASONING_CATALOG_URL]);

/**
 * Refuse every off-machine request, and remember the ones nobody expected.
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
    if (!EXPECTED_OFF_MACHINE.has(url)) stray.push(url);
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
  // phases are answered before the first paint: the results half sees the closing one too.
  await openApp(page, {
    FORMAMORPH_eventAcknowledged: [`${running.id}:start`, `${running.id}:end`],
  }, { liveEvents: true });

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

  // Exact: the menu's event banner behind this dialog is a button too, and a contest whose own title
  // carries the word would otherwise match it as well.
  await page.getByRole('button', { name: 'Contest', exact: true }).click();
  // The bar's Rules button, not the contest's title: the title also sits in the menu's event banner
  // behind this dialog. What ties the grid below to *this* contest is the entry itself — the tab shows
  // only worlds carrying the contest's id, so a listing appearing here is the server having stored it.
  await expect(page.getByRole('button', { name: 'Rules' })).toBeVisible();
  await expect(catalogEntry).toBeVisible();
  await expect(page.getByText(worldName, { exact: true }).first()).toBeVisible();

  expect(stray).toEqual([]);
});

/**
 * A shared 1st place, built in the Podium dialog and read back on the surfaces players use.
 *
 * A tie crosses every layer this project keeps apart — the dialog derives the places, the server stores
 * an order inside one place, and three player surfaces read a repeated place back. Each layer has its own
 * tests against its own seam; none of them can show that the four agree, which is what this does.
 *
 * First rather than third place, deliberately: gold is where a surface that kept the old "one winner"
 * shape still renders something, so a wrong answer here looks right rather than blank.
 */
test('a tie built in the podium dialog reaches the band, the cards and the bar', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one viewport is enough for a server flow');
  test.skip(Boolean(unavailable), unavailable);
  test.skip(Boolean(cannotAnnounce), cannotAnnounce);

  const running = contest!;
  const { username, password, worldName, stray } = await publishIntoTheContest(page);

  // The listing id, read as the author: what the podium names, and what the local copy was linked to
  // when it published. Both halves of the badge's matching rule meet on this one string.
  const authorToken = await tokenFor(username, password);
  expect(authorToken, 'the account this run just registered could not log in through the API').toBeTruthy();
  const mine = await fetch(`${API}/users/me/worlds`, { headers: { Authorization: `Bearer ${authorToken}` } });
  const listingId = ((await mine.json()) as { data?: { id: string }[] }).data?.[0]?.id;
  expect(listingId, 'the published listing is not on the author’s own list').toBeTruthy();

  // This run's world publishes last, so the entry it ties with is always the older of the two — which
  // makes the band's order an assertion with a right answer rather than whichever way it came out.
  const others = await entriesOtherThan(listingId!);
  test.skip(others.length === 0, 'a tie needs a second entry — run the entry flow against this contest first');
  const partner = others[0];

  await closeTheContest();

  // The judge is not the entrant. Announcing is an admin's, and the server refuses an admin their own
  // entry, so the dialog half of this flow runs on the other account.
  await signOut(page);
  await signIn(page, ADMIN.username, ADMIN.password);

  // Without `tab`, because `#dev?modal=adminPanel&tab=events` serves the canned calendar instead of the
  // server's. The tab is clicked the way an admin clicks it, and the list is the real one.
  await gotoDev(page, 'mainMenu', { modal: 'adminPanel' });
  await page.getByRole('tab', { name: 'Events' }).click();
  await page.getByRole('button', { name: 'Announce Results' }).click();

  const podiumDialog = page.getByRole('dialog').filter({ hasText: `Announce Results — ${running.title}` });
  const entryCards = podiumDialog.getByRole('group', { name: 'Entries' }).getByRole('button');
  // By author, not by name: every run publishes the same bundled world, so the entries in the grid all
  // read alike and only the credit line tells them apart.
  const entryOf = (author: string) => entryCards.filter({ hasText: `by ${author}` });

  await entryOf(username).click();
  await entryOf(partner.author).click();

  const rows = podiumDialog.getByRole('list', { name: 'Podium' }).getByRole('listitem');
  await expect(rows).toHaveCount(2);
  // The second row takes its own step until the toggle shares the one above it.
  await expect(rows.nth(1)).toContainText('2nd Place');
  await rows.nth(1).getByRole('checkbox').check();
  await expect(rows.nth(0)).toContainText('1st Place');
  await expect(rows.nth(1)).toContainText('1st Place');

  await podiumDialog.getByRole('button', { name: 'Announce Results' }).click();
  await expect(podiumDialog).toBeHidden();

  // Back to the account that entered, on the surfaces its author reads.
  await signOut(page);
  await signIn(page, username, password);

  await gotoDev(page, 'mainMenu', { modal: 'community' });
  await page.getByRole('button', { name: 'Contest', exact: true }).click();

  // The bar counts the shared place instead of naming one of two winners. No suffix: nothing placed
  // below them, so there is nothing for it to count.
  await expect(page.getByText('2 worlds tied for 1st', { exact: true })).toBeVisible();

  // Every placed world gets its own plate, and the two that share 1st are deliberately identical — so
  // what tells them from a sole winner is that there are two of them wearing the same metal.
  const band = page.getByTestId('podium-card');
  await expect(band).toHaveCount(2);
  await expect(band.nth(0)).toContainText('1st Place');
  await expect(band.nth(1)).toContainText('1st Place');
  // Publish time decides the order inside a place, so the older listing leads however the judge listed
  // them — this run put its own world in the dialog first and it is the newer of the two.
  await expect(band.nth(0)).toContainText(`by ${partner.author}`);
  await expect(band.nth(1)).toContainText(`by ${username}`);

  // Each tied world's catalog card, one author at a time: the grid pages, and both entries carry the same
  // world name, so a search by author is the only way to be sure which card the badge is on.
  const search = page.getByPlaceholder('Search entries…', { exact: false });
  for (const author of [username, partner.author]) {
    await search.fill(`author:${author} `);
    await expect(page.getByText(`By ${author}`, { exact: true })).toBeVisible();
    await expect(page.getByText(`1st Place — ${running.title}`).first()).toBeVisible();
  }

  // And the author's own downloaded copy, on a fresh launch. Nothing about the placement is stored
  // locally, so the library learns it by reading the archive again. The bare path rather than a reload:
  // the dev route is still pointing at the community browser, which would come back up over the library.
  await page.goto('/');
  await page.waitForFunction(() => '__fmDev' in window);
  // The library's own card, not the seeding toast: the worlds are already stored by now, and a launch
  // that finds them there says nothing.
  const libraryCard = page.getByText(worldName, { exact: true }).first();
  await libraryCard.waitFor();
  await expect(page.getByText(`1st Place — ${running.title}`).first()).toBeVisible();

  // And again one click in: the details modal is where the honor used to be lost.
  await libraryCard.click();
  const details = page.getByRole('dialog').filter({ hasText: worldName });
  await expect(details.getByText(`1st Place — ${running.title}`)).toBeVisible();

  expect(stray).toEqual([]);
});
