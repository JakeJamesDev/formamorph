import { test, expect, type Locator, type Page, type Route } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openApp, gotoDev } from './app';
import { buildLongSave } from '../src/lib/devFixtures/longSave';
import { INSTALL_HEADER_NAME } from '../src/lib/anonymousLikes';
import { LIKE_PROMPT_TURNS } from '../src/lib/likePrompt';
import type { SaveObject } from '../src/types';

/**
 * The two places a guest can give a like, in a real browser.
 *
 * Both paths are proved elsewhere over mocked fetch, and both still depend on things jsdom does not
 * have: a heart whose fill is painted by a class, a reload that has to find the same Install id in
 * local storage, and a card that only appears after a real turn commits inside the largest view in the
 * app. Those are what this spec is for.
 *
 * The server is a set of route handlers in this file, keyed by the Install header the way the real one
 * is keyed by it. A request that reaches no handler is recorded and fails the test, so a run can never
 * quietly like something on the live server.
 */

/** The one listing both paths ask about. */
const LISTING = {
  _id: 'e2e-anon-listing',
  id: 'e2e-anon-listing',
  kind: 'world',
  name: 'E2E Tidewrack',
  description: 'A canned listing for the guest heart.',
  author: { id: 'e2e-author', username: 'e2eauthor' },
  tags: [],
  likes: 4,
  updated_at: '2026-02-01T00:00:00.000Z',
};

/** What the stub server remembers, and what the run is allowed to have asked it. */
interface Server {
  /** The Installs that like the listing, as the server's rows would hold them. */
  likedBy: Set<string>;
  /** Every request that reached no stub. A run that touches the live API leaves one here. */
  stray: string[];
  /** Each write, with the listing it named and the Install it came from, in order. */
  writes: { url: string; install: string | undefined; liked: boolean }[];
  /** How many times a reader has asked for the listing's own row. */
  reads: number;
}

/**
 * The API base this run's app was built against.
 *
 * Read the same way the runner decides it: `E2E_API_URL` overrides the live host, and a spec that
 * guarded only the live host would let every request through under that override.
 */
const API_ORIGIN = new URL(process.env.E2E_API_URL ?? 'https://api.formamorph.ai').origin;

/** The Install header off a request, under the lower-case name a browser sends it as. */
const installOf = (route: Route): string | undefined =>
  route.request().headers()[INSTALL_HEADER_NAME.toLowerCase()];

/** The listing as this reader sees it: their own like, and the count with it counted. */
function listingFor(install: string | undefined, server: Server) {
  const liked = Boolean(install && server.likedBy.has(install));
  return { ...LISTING, liked, likes: LISTING.likes + (liked ? 1 : 0) };
}

/**
 * Stand the stub server up in front of the live one.
 *
 * The catch-all goes on first so the named routes, registered after it, win: Playwright matches the
 * most recently added handler. Anything left for the catch-all is a request this spec did not expect.
 */
async function stubServer(page: Page): Promise<Server> {
  const server: Server = { likedBy: new Set(), stray: [], writes: [], reads: 0 };

  await page.route(`${API_ORIGIN}/**`, (route) => {
    server.stray.push(route.request().url());
    return route.fulfill({ status: 599, json: { error: 'no stub for this request' } });
  });

  // The catalog, answered for whoever asked: the server fills `liked` for a guest from the Install.
  await page.route('**/worlds?*', (route) => route.fulfill({
    json: { success: true, anonymousLikes: true, data: [listingFor(installOf(route), server)], total: 1 },
  }));

  // One listing's own row, which is what the in-game card reads before it shows. The count is what
  // says whether the card was offered again: it reads once per offer and never otherwise.
  await page.route(`**/worlds/${LISTING.id}`, (route) => {
    server.reads += 1;
    return route.fulfill({
      json: { success: true, anonymousLikes: true, data: listingFor(installOf(route), server) },
    });
  });

  await page.route('**/worlds/*/anonymous-like', (route) => {
    const install = installOf(route);
    const { liked } = route.request().postDataJSON() as { liked: boolean };
    server.writes.push({ url: route.request().url(), install, liked });
    if (!install) {
      return route.fulfill({ status: 400, json: { code: 'install_header_invalid', error: 'No Install' } });
    }
    if (liked) server.likedBy.add(install);
    else server.likedBy.delete(install);
    return route.fulfill({ json: { success: true, data: listingFor(install, server) } });
  });

  return server;
}

/**
 * What the page actually paints where an element sits, against the same strip with that element
 * hidden.
 *
 * A box says only that layout gave it room, and a computed style says only what the rule resolved to.
 * Photographing the strip twice is what proves something reached the screen: identical pixels mean the
 * element paints nothing there, whatever its box and its styles claim.
 *
 * @returns Whether the two photographs differ
 */
async function paintsWithin(page: Page, locator: Locator): Promise<boolean> {
  const box = await locator.boundingBox();
  if (!box) return false;
  const clip = { x: box.x, y: box.y, width: Math.max(1, box.width), height: Math.max(1, box.height) };

  const shown = await page.screenshot({ clip });
  await locator.evaluate((el) => { (el as HTMLElement).style.visibility = 'hidden'; });
  const hidden = await page.screenshot({ clip });
  await locator.evaluate((el) => { (el as HTMLElement).style.visibility = ''; });

  return !shown.equals(hidden);
}

/**
 * Whether the renderer answers with this element at its own center.
 *
 * Separate from the photograph: that one proves something is painted, this one proves nothing is
 * covering it. A card behind an overlay paints its strip and still cannot be read or pressed.
 */
async function hitTestsAt(locator: Locator): Promise<boolean> {
  const box = await locator.boundingBox();
  if (!box) return false;
  return locator.evaluate((el, point) => {
    const hit = document.elementFromPoint(point.x, point.y);
    return Boolean(hit && (el === hit || el.contains(hit)));
  }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
}

/** The heart's fill rule. An unfilled lucide heart resolves `none`; the liked class resolves a color. */
const heartFill = (button: Locator): Promise<string> =>
  button.locator('svg').first().evaluate((el) => getComputedStyle(el).fill);

test.describe('a guest liking a listing', () => {
  test('fills the heart, raises the count, and is still filled after a reload', async ({ page }) => {
    const server = await stubServer(page);
    await openApp(page);
    await gotoDev(page, 'mainMenu', { modal: 'community' });

    const empty = page.getByRole('button', { name: `Like — ${LISTING.likes} likes` });
    await expect(empty).toBeVisible();
    expect(await heartFill(empty)).toBe('none');
    // The heart's own glyph, whose strip keeps its size while the count beside it grows.
    const glyph = empty.locator('svg').first();
    const emptyShape = await page.screenshot({ clip: (await glyph.boundingBox())! });

    await empty.click();

    const filled = page.getByRole('button', { name: `Unlike — ${LISTING.likes + 1} likes` });
    await expect(filled).toBeVisible();
    await expect(filled).toHaveAttribute('aria-pressed', 'true');
    // A resolved color, not merely something other than `none`: a fill that lost its color would still
    // differ from the empty heart while painting nothing a reader would call filled.
    expect(await heartFill(filled)).toMatch(/^rgba?\(/);
    // And the color reached the screen. A rule that resolves and never paints leaves these equal.
    const filledShape = await page.screenshot({ clip: (await filled.locator('svg').first().boundingBox())! });
    expect(filledShape.equals(emptyShape)).toBe(false);
    expect(await hitTestsAt(filled)).toBe(true);

    // The write named this copy of the app and the listing under the heart.
    expect(server.writes).toHaveLength(1);
    expect(server.writes[0].liked).toBe(true);
    expect(server.writes[0].url).toContain(`/worlds/${LISTING.id}/anonymous-like`);
    const stored = await page.evaluate(() => localStorage.getItem('FORMAMORPH_installId'));
    expect(server.writes[0].install).toBe(stored);

    // A reload is the whole point of storing the id: the catalog comes back liked for this Install.
    await page.reload();
    await page.waitForFunction(() => '__fmDev' in window);
    await gotoDev(page, 'mainMenu', { modal: 'community' });

    const afterReload = page.getByRole('button', { name: `Unlike — ${LISTING.likes + 1} likes` });
    await expect(afterReload).toBeVisible();
    await expect(afterReload).toHaveAttribute('aria-pressed', 'true');
    expect(await heartFill(afterReload)).toMatch(/^rgba?\(/);
    // No second write: the fill came back from the server, not from a press this reload made.
    expect(server.writes).toHaveLength(1);

    expect(server.stray).toEqual([]);
  });
});

/** The world the fixture boots, given an id so the stored record and the playthrough name one world. */
const WORLD_ID = 'e2e-anon-like-world';

/** The world fixture with an id, and a playthrough one turn short of the threshold. */
async function servePlayedFixture(page: Page): Promise<Record<string, unknown> & { worldOverview: { name: string } }> {
  const world = {
    ...JSON.parse(readFileSync('src/lib/devFixtures/whiteRoomWorld.json', 'utf8')),
    id: WORLD_ID,
  } as Record<string, unknown> & { worldOverview: { name: string } };
  const base = JSON.parse(readFileSync('src/lib/devFixtures/whiteRoomSave.json', 'utf8')) as SaveObject;
  const narrations = JSON.parse(readFileSync('src/lib/devFixtures/sedgeNarration.json', 'utf8')) as string[];
  const save = buildLongSave(base, {
    turns: LIKE_PROMPT_TURNS - 1,
    narrations,
    // One 1x1 pixel on turn one, which the builder always images. Nothing here reads a scene image, so
    // the interval only has to outrun the history.
    images: ['data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'],
    imageEvery: 1000,
  });

  for (const [kind, body] of [['World', world], ['Save', save]] as const) {
    await page.route(`**/whiteRoom${kind}.json*`, (route) => route.fulfill({
      contentType: 'application/javascript', body: `export default ${JSON.stringify(body)}`,
    }));
  }
  return world;
}

/** Answer narration for every chat call, and report how many turns have been narrated. */
async function mockNarration(page: Page): Promise<() => number> {
  let calls = 0;
  await page.route('**/api/v0/models', (route) => route.fulfill({ status: 404 }));
  await page.route('**/v1/models', (route) => route.fulfill({ json: { data: [{ id: 'e2e-model' }] } }));
  await page.route('**/chat/completions', async (route) => {
    calls += 1;
    const text = 'The white room holds its breath.';
    await route.fulfill({
      contentType: 'text/event-stream',
      body: `data: ${JSON.stringify({ choices: [{ delta: { content: text }, finish_reason: null }] })}\n\ndata: [DONE]\n\n`,
    });
  });
  return () => calls;
}

/** The settings a scripted turn needs: one AI call per turn, and nothing else running beside it. */
const settings = {
  FORMAMORPH_endpointUrl: 'http://127.0.0.1:5190/v1/chat/completions',
  FORMAMORPH_thinkingMode: 'off',
  FORMAMORPH_choicesEnabled: false,
  FORMAMORPH_locationChangeEnabled: false,
  FORMAMORPH_memoryDigests: false,
  FORMAMORPH_aiClock: false,
  FORMAMORPH_statUpdatesEnabled: false,
};

/** Record this playthrough's world as a copy downloaded from the listing, the way a download leaves it. */
async function recordDownload(page: Page, world: Record<string, unknown>): Promise<void> {
  await page.evaluate(async ({ world, listingId }) => {
    const dev = (window as unknown as { __fmDev: { putWorld(w: unknown): Promise<string> } }).__fmDev;
    const id = await dev.putWorld(world);
    // The download link is wrapper metadata rather than world content, so it goes onto the stored record.
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('worldsDB', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const transaction = request.result.transaction('worlds', 'readwrite');
        transaction.onerror = () => reject(transaction.error);
        transaction.oncomplete = () => resolve();
        const store = transaction.objectStore('worlds');
        const read = store.get(id);
        read.onsuccess = () => {
          store.put({ ...read.result, sourceId: listingId, downloadedAt: '2026-02-02T00:00:00.000Z' });
        };
      };
    });
  }, { world, listingId: LISTING.id });
}

/** Play one turn through the same path the action box drives, and wait for it to land. */
async function playTurn(page: Page, action: string): Promise<void> {
  await page.waitForFunction(() => '__baseline' in window);
  await page.evaluate(
    (script) => (window as unknown as { __baseline: { runScript(actions: string[]): Promise<void> } })
      .__baseline.runScript(script),
    [action],
  );
}

test.describe('the in-game like prompt', () => {
  test('asks on the fifteenth turn, takes the like, and does not come back', async ({ page }) => {
    page.on('pageerror', (error) => console.error(error.message));
    const server = await stubServer(page);
    const world = await servePlayedFixture(page);
    const narrationCalls = await mockNarration(page);

    await openApp(page, settings, { url: '/#dev?view=gameViewer&fixture=whiteRoom' });
    await recordDownload(page, world);

    // The save is one turn short, so this turn is the fifteenth and the first one that may ask.
    await playTurn(page, 'I step toward the door.');

    const card = page.getByTestId('like-prompt');
    await expect(card).toBeVisible();
    await expect(card.getByText(`Enjoying ${world.worldOverview.name}?`)).toBeVisible();
    expect(await paintsWithin(page, card)).toBe(true);
    expect(await hitTestsAt(card)).toBe(true);
    expect(server.reads).toBe(1);

    await card.getByRole('button', { name: 'Like', exact: true }).click();
    await expect(card).toHaveCount(0);

    // The like was an Anonymous Like against this copy of the app, for the listing being played.
    expect(server.writes).toHaveLength(1);
    expect(server.writes[0].liked).toBe(true);
    expect(server.writes[0].url).toContain(`/worlds/${LISTING.id}/anonymous-like`);
    expect(server.likedBy.has(server.writes[0].install!)).toBe(true);

    // A sixteenth turn commits and asks nothing. A turn that asks nothing signals nothing, so this
    // waits the chain out rather than racing it: the card would read the listing a second time before
    // it could return, and that read is what the count catches.
    await playTurn(page, 'I look back at the room.');
    await expect.poll(narrationCalls).toBe(2);
    await page.waitForTimeout(1000);
    expect(server.reads).toBe(1);
    await expect(card).toHaveCount(0);

    expect(server.stray).toEqual([]);
  });
});
