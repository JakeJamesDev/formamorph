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

/** The canned decided contest of the router's samples (`devEventSample.ts`), alone and on fixed dates, with its sole-winner podium. */
const DECIDED_CONTEST = {
  id: CONTEST.eventId, type: 'contest', title: 'Autumn Ruins Contest',
  bannerText: 'Build a world around a single season and enter it before the deadline.',
  body: null, rulesText: null, posterColor: '#1e3a8a', posterImageUrl: null, posterPlacement: null,
  startsAt: '2026-08-09T12:00:00.000Z', endsAt: '2026-09-08T12:00:00.000Z', cancelledAt: null,
  startMessageId: null, endMessageId: null, resultsMessageId: null, resultsAnnouncedAt: '2026-09-09T12:00:00.000Z',
  placements: CONTEST.entries.map((entry, i) => ({ place: i + 1, worldId: entry.id, worldName: entry.name, authorName: entry.author })),
};

/** The built-in engine with a model loaded and ready, on one GPU. The model is an 8 GB pick from the catalog (`src/lib/localModels.ts`). */
const ENGINE_STATE = {
  status: 'ready', modelPath: 'C:\\Formamorph\\models\\Anubis-Mini-8B-v1h-Q4_K_M.gguf', modelId: 'Anubis-Mini-8B-v1h-Q4_K_M.gguf',
  port: 8977, error: null, loadProgress: null, contextSize: 8192, gpuLayers: 99, flashAttention: true, parallelRequests: 2,
  maxContextSize: 32768, engineVramMB: 6100, gpuBackend: 'cuda', gpuDeviceNames: ['NVIDIA GeForce RTX 4070'],
  deviceVramTotalMB: 12282, deviceVramFreeMB: 11200, gpuDeviceIndex: 0, gpuDeviceRawIndex: 0, gpuDeviceOrigin: 'auto',
  gpuDeviceOptions: ['NVIDIA GeForce RTX 4070'],
};

/** The VRAM readout for that GPU, with the engine's process holding the model. */
const GPU_STATS = {
  gpus: [{ index: 0, name: 'NVIDIA GeForce RTX 4070', totalMB: 12282, usedMB: 7180, freeMB: 5102 }],
  processes: [{ pid: 4242, name: 'Formamorph.exe', usedMB: 6100 }],
  selfPid: 4242,
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

  /** The contest list holds only the canned decided contest, so each entry wears one placement badge. */
  async contestEvents(context) {
    await context.route(new RegExp(`${API.source}api/events\\?slim=1`), (route) => route.fulfill({ json: { data: [DECIDED_CONTEST] } }));
  },

  /**
   * The desktop bridge, with the built-in engine serving a model that is already loaded. Nothing loads or
   * downloads: every engine call answers from a fixed ready state, and the engine's local server answers its model list.
   */
  async desktopEngine(context) {
    await context.addInitScript(({ engine, gpu }) => {
      for (const key of ['useCustomEndpoint', 'endpointUrl', 'apiToken', 'modelName']) localStorage.removeItem(`FORMAMORPH_${key}`);
      let state = engine;
      const idle = () => () => {};
      const model = { id: engine.modelId, fileName: engine.modelId, subpath: '', size: 4_920_000_000, path: engine.modelPath, source: 'root' };
      window.formamorphDesktop = {
        fetch: async ({ url, method, headers, body }) => {
          const response = await fetch(url, { method, headers, body });
          return { ok: response.ok, status: response.status, body: await response.text() };
        },
        vramStats: async () => gpu,
        llm: {
          status: async () => state,
          stop: async () => state,
          load: async () => state,
          setOptions: async (opts) => {
            state = { ...state, contextSize: opts.contextSize, gpuLayers: opts.gpuLayers, flashAttention: opts.flashAttention, parallelRequests: opts.parallelRequests };
            return state;
          },
          onStatus: idle,
          onMoveProgress: idle,
          onDownloadProgress: idle,
          modelsDir: async () => 'C:\\Formamorph\\models',
          listModels: async () => [engine.modelId],
          listInstalled: async () => [model],
          listPartials: async () => [],
          listDevices: async () => ({ backend: engine.gpuBackend, devices: engine.gpuDeviceNames, autoPick: engine.gpuDeviceNames[0] }),
          getLocations: async () => ({
            rootDir: 'C:\\Formamorph\\models', defaultDir: 'C:\\Formamorph\\models', isDefaultDir: true, downloadDirMissing: false,
            freeBytes: 512_000_000_000, externalDir: null, searchSubfolders: false, lmStudioDir: null,
          }),
          freeSpace: async () => 512_000_000_000,
        },
      };
    }, { engine: ENGINE_STATE, gpu: GPU_STATS });
    await context.route(/^http:\/\/(localhost|127\.0\.0\.1):8977\/v1\/models/, (route) => route.fulfill({ json: { data: [{ id: ENGINE_STATE.modelId }] } }));
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
