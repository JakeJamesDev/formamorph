// Per-shot setups for capture.mjs: canned network and storage, so a shot never depends on a live server or AI.
// A shot names its setups in captures.json (`"setup": ["ageGate", "communityListings"]`).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const readJson = (file) => JSON.parse(readFileSync(path.join(repoRoot, file), 'utf8'));

/** The community server's origin, as the app's dev build reaches it (`VITE_API_URL_DEV`). */
const API = /^https:\/\/api\.formamorph\.ai\//;

/** The answer the help window streams. It follows Library.md and the World Editor's own labels. */
const HELP_ANSWER = [
  'Press **New World** on the main menu. The World Editor opens on the whole screen.',
  '',
  'Add your stats, locations and entities from the list on the left. Press **Save** when you finish. The world appears in your library.',
].join('\n');

/** Worlds the community grid lists: the bundled worlds, with no download or like counts. */
const LISTED = ['emberwatch', 'veilwood', 'drone', 'slime', 'sugarscape', 'rampage'];

/**
 * The entries of the router's canned decided contest (`devEventSample.ts`), in its podium order. Each wears
 * a bundled world's art. The ids and names are the sample's own, so the podium band and the cards agree.
 */
const CONTEST = {
  eventId: 'dev-contest-decided',
  entries: [
    { id: 'dev-world', name: 'The Long Thaw', author: 'sedgewright', art: 'emberwatch' },
    { id: 'dev-world-2', name: 'Nine Frozen Bells', author: 'marrowmoss', art: 'veilwood' },
    { id: 'dev-world-3', name: 'The Kindling Hour', author: 'ashgrove', art: 'sugarscape' },
  ],
};

const listing = ({ id, name, description, author, tags = [], thumbnail, contestEventId = null }, index) => ({
  id, name, description, thumbnail_file: `${id}.webp`,
  downloads: 0, tags, created_at: '2026-10-01 12:00:00', updated_at: '2026-10-01T12:00:00.000Z',
  comment_count: 0, spoiler: false, kind: 'world', quarantined_at: null, quarantine_expires_at: null, quarantine_extended: 0,
  contest_event_id: contestEventId, visibility: 'public', revision: 1, models: [], app_version: null, placeholder: false,
  changelog_count: 0, likes: 0,
  author: { id: `00000000-0000-4000-8000-0000000001${index}0`, username: author, avatarUrl: null, role: null, supporter: null },
  thumbnailUrl: `/api/thumbnails/${id}.webp`,
  thumbnail,
});

const bundled = (file, index) => {
  const { worldOverview } = readJson(`src/defaultworlds/${file}.json`);
  return listing({
    id: `00000000-0000-4000-8000-00000000000${index + 1}`, name: worldOverview.name, description: worldOverview.description,
    author: worldOverview.author, tags: worldOverview.tags, thumbnail: worldOverview.thumbnail,
  }, index);
};

const contestEntries = () => CONTEST.entries.map((entry, index) => listing({
  id: entry.id, name: entry.name, author: entry.author, contestEventId: CONTEST.eventId,
  description: 'A world entered in the contest.', thumbnail: readJson(`src/defaultworlds/${entry.art}.json`).worldOverview.thumbnail,
}, index));

/** Answers the community catalog with `rows`, and refuses every other server call. */
async function serveCatalog(context, rows) {
  await context.route(API, (route) => route.fulfill({ status: 404, json: { success: false } }));
  await context.route(new RegExp(`${API.source}api/worlds\\?`), (route) => route.fulfill({
    json: { success: true, count: rows.length, pagination: {}, total: rows.length, anonymousLikes: false, data: rows.map(({ thumbnail, ...row }) => row) },
  }));
  await context.route(new RegExp(`${API.source}api/thumbnails/`), (route) => {
    const id = new URL(route.request().url()).pathname.split('/').pop().replace('.webp', '');
    const row = rows.find((item) => item.id === id);
    const body = Buffer.from(row.thumbnail.slice(row.thumbnail.indexOf(',') + 1), 'base64');
    return route.fulfill({ body, contentType: 'image/webp' });
  });
}

export const setups = {
  /** The attestation is on this device, so Community opens without its prompt. The key and version mirror `src/lib/ageGate.ts`. */
  async ageGate(context) {
    await context.addInitScript(() => {
      localStorage.setItem('FORMAMORPH_ageGate', JSON.stringify({ accepted: true, acceptanceVersion: 1, acceptedAt: '2026-10-01T00:00:00.000Z' }));
    });
  },

  /** Every onboarding popover is already answered. The ids are the entries of `src/lib/tutorials.ts`; list a new one here. */
  async tutorialsSeen(context) {
    await context.addInitScript(() => {
      localStorage.setItem('formamorph.tutorialsSeen', JSON.stringify([
        'help-tab', 'settings-mode-toggle', 'community-kind-tabs', 'community-filters', 'community-like',
        'community-search-prefixes', 'community-hidden', 'main-menu-sign-in', 'main-menu-feedback',
      ]));
    });
  },

  /** The community catalog lists the bundled worlds. */
  communityListings: (context) => serveCatalog(context, LISTED.map(bundled)),

  /** The community catalog lists the canned contest's entries. */
  contestListings: (context) => serveCatalog(context, contestEntries()),

  /** The app runs on its default endpoint preset, and that server answers its model list. */
  async defaultEndpoint(context) {
    await context.addInitScript(() => {
      for (const key of ['useCustomEndpoint', 'endpointUrl', 'apiToken', 'modelName']) localStorage.removeItem(`FORMAMORPH_${key}`);
    });
    await context.route(/^https:\/\/api\.lyonade\.net\//, (route) => {
      if (route.request().url().endsWith('/v1/models')) return route.fulfill({ json: { data: [{ id: 'default' }] } });
      return route.fulfill({ status: 404, json: {} });
    });
  },

  /** The help window's AI call answers with one canned reply, streamed as the endpoint would. */
  async helpAnswer(context) {
    const chunk = (delta) => `data: ${JSON.stringify({ choices: [{ index: 0, delta }] })}\n\n`;
    // The placeholder endpoint capture.mjs stores, which nothing listens on.
    await context.route(/127\.0\.0\.1:9\//, async (route) => {
      const body = JSON.parse(route.request().postData() ?? '{}');
      if (body.stream) {
        const words = HELP_ANSWER.split(/(?<=\s)/);
        return route.fulfill({
          contentType: 'text/event-stream',
          body: chunk({ role: 'assistant' }) + words.map((word) => chunk({ content: word })).join('') + 'data: [DONE]\n\n',
        });
      }
      return route.fulfill({ json: { choices: [{ index: 0, message: { role: 'assistant', content: HELP_ANSWER }, finish_reason: 'stop' }] } });
    });
  },
};
