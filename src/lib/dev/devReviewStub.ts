/** DEV only: serves `ReviewService` from an in-memory queue while the dev route has `fixture=review`. */
import { getDevRoute } from '@/lib/devRouter';
import type { ChangelogEntry } from '@/lib/listingChangelog';
import type { PendingUpdate } from '@/lib/listingModeration';
import ReviewService, { ReviewConflictError, type AutoApproval, type ReviewQueueItem } from '@/services/ReviewService';
import WorldStorageService, { type CatalogFetch, type ListingDetailsRead } from '@/services/WorldStorageService';
import type { CatalogWorld } from '@/lib/worldCatalog';
import { DEV_REVIEW_FIXTURE } from '@/lib/dev/devReviewViewer';

const STUBBED_KEYS = [
  'fetchMeta', 'fetchQueue', 'fetchCount', 'fetchContent', 'approve', 'reject', 'fetchAutoApproved', 'setTrusted',
  'discardUpdate', 'fetchPendingThumbnail',
] as const satisfies readonly (keyof typeof ReviewService)[];
type Stubbed = Pick<typeof ReviewService, (typeof STUBBED_KEYS)[number]>;

const hoursAgo = (hours: number): string => new Date(Date.now() - hours * 3_600_000).toISOString();

const person = (id: string, username: string, role: string | null = null) => ({ id, username, role, avatarUrl: null });

/** A square of two colors, standing in for a thumbnail. */
const swatch = (from: string, to: string): string => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">`
  + `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/>`
  + `<stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="96" height="96" fill="url(#g)"/></svg>`;

/** The live thumbnail of the canned update's listing. */
export const DEV_LIVE_THUMBNAIL = `data:image/svg+xml,${encodeURIComponent(swatch('#3b6e8f', '#a7c4a0'))}`;

const PENDING_THUMBNAIL = swatch('#8f3b5a', '#e0b060');

/** Listings the canned update names: two the world requires, one of them deleted since. */
const DEV_LISTINGS: Record<string, string> = {
  'dev-dep-1': 'Marsh Words',
  'dev-dep-2': 'The Ferryman',
};

/** A world update that touches every kind of field the compare view shows. */
export function devPendingUpdate(): PendingUpdate {
  const date = new Date().toISOString().slice(0, 10);
  return {
    fields: {
      name: { approved: 'Lanterns Over the Marsh', pending: 'Lanterns Over the Fen' },
      description: {
        approved: 'Lanterns drift over the marsh at night. Follow one home.',
        pending: 'Lanterns drift over the fen at night. Follow one home, or follow it out to the drowned bell.',
      },
      tags: { approved: ['mystery', 'marsh'], pending: ['mystery', 'fen', 'horror'] },
      visibility: { approved: 'public', pending: 'unlisted' },
      spoiler: { approved: false, pending: true },
      required_dependencies: { approved: ['dev-dep-1'], pending: ['dev-dep-1', 'dev-dep-2', 'dev-dep-gone'] },
    },
    changelog: [
      { op: 'create', id: 'dev-op-1', title: 'The Drowned Bell', body: 'Adds the bell tower and its keeper.', date },
      { op: 'edit', id: 'dev-entry-1', title: 'First Release', body: 'The marsh, its lanterns and the ferry.', date },
      { op: 'delete', id: 'dev-entry-2' },
    ],
    content_changed: true,
    thumbnail_url: '/api/reviews/dev-review-update/thumbnail',
  };
}

/** The live entries of the canned update's listing, which its edit and delete name. */
export function devApprovedChangelog(): ChangelogEntry[] {
  const entry = (id: string, title: string, day: string): ChangelogEntry => ({
    id, world_id: 'dev-review-update', title, body: '', entry_date: day, created_at: '', updated_at: '',
  });

  return [entry('dev-entry-1', 'First Release', '2026-09-01'), entry('dev-entry-2', 'Ferry Fixes', '2026-09-20')];
}

/** The queue the stub starts from: a contest entry, an update, a resubmission, and a new listing by a mod. */
export function devReviewFixtures(): ReviewQueueItem[] {
  return [
    {
      id: 'dev-review-contest', kind: 'world', name: 'Lanterns Over the Marsh', type: 'new',
      author: person('dev-author-1', 'Lantern Keeper'), contest: { id: 'dev-contest', title: 'Autumn Contest' },
      queuedAt: hoursAgo(5), createdAt: hoursAgo(5), quarantineExpiresAt: null,
    },
    {
      id: 'dev-review-update', kind: 'world', name: 'Lanterns Over the Marsh', type: 'update',
      author: person('dev-author-1', 'Lantern Keeper'), contest: null,
      queuedAt: hoursAgo(3), createdAt: hoursAgo(400), quarantineExpiresAt: null, pendingUpdate: devPendingUpdate(),
    },
    {
      id: 'dev-review-new', kind: 'entity', name: 'The Ferryman', type: 'new',
      author: person('dev-author-2', 'Reed Walker'), contest: null,
      queuedAt: hoursAgo(50), createdAt: hoursAgo(50), quarantineExpiresAt: null,
    },
    {
      id: 'dev-review-resubmitted', kind: 'dictionary', name: 'Marsh Words', type: 'resubmitted',
      author: person('dev-author-3', 'Heron Cole'), contest: null,
      queuedAt: hoursAgo(20), createdAt: hoursAgo(200), quarantineExpiresAt: new Date(Date.now() + 4 * 86_400_000).toISOString(),
    },
    {
      id: 'dev-review-staff', kind: 'world', name: 'Staff Sandbox', type: 'new',
      author: person('dev-admin', 'Formamorph Team', 'admin'), contest: null,
      queuedAt: hoursAgo(70), createdAt: hoursAgo(70), quarantineExpiresAt: null,
    },
  ];
}

/** The queue as catalog rows, so the browser's pinned group has cards. The contest tie is left off. */
export function devReviewCatalogRows(): CatalogWorld[] {
  return devReviewFixtures().map((item) => {
    const update = item.type === 'update';
    return {
      id: item.id, kind: item.kind, name: item.name, description: '', tags: [], downloads: 0,
      author: item.author ? { id: item.author.id, username: item.author.username } : null,
      created_at: item.createdAt, updated_at: item.queuedAt,
      moderation_state: update ? 'approved' : 'pending',
      moderation_queued_at: update ? item.createdAt : item.queuedAt,
      quarantined_at: item.quarantineExpiresAt ? item.queuedAt : null,
      quarantine_expires_at: item.quarantineExpiresAt ?? null,
      has_pending_update: update,
      ...(update ? {
        thumbnail_file: DEV_LIVE_FILE,
        pending_preview: { name: 'Lanterns Over the Fen', thumbnail_url: devPendingUpdate().thumbnail_url, queued_at: item.queuedAt },
      } : {}),
    };
  });
}

/** The server's catalog with the canned rows in front. A failed read still serves them. */
async function fetchDevCatalog(): Promise<CatalogFetch> {
  const live: CatalogFetch = await Object.getPrototypeOf(WorldStorageService).fetchCatalog.call(WorldStorageService, null);
  const rows = devReviewCatalogRows();
  const ids = new Set<unknown>(rows.map((row) => row.id));
  const served = live.status === 'fresh'
    ? live.data.filter((row) => !ids.has((row as { id?: unknown } | null)?.id))
    : [];

  return { status: 'fresh', data: [...rows, ...served], tag: null, anonymousLikes: live.status === 'fresh' && live.anonymousLikes };
}

/** Recent auto-approvals, newest first: a trusted author's upload and a staff upload. */
export function devAutoApprovals(): AutoApproval[] {
  const entry = (id: number, name: string, kind: string, username: string, role: string | null, hours: number): AutoApproval => ({
    id, targetId: `dev-auto-${id}`, targetKind: kind, targetName: name,
    actor: { id: `dev-actor-${id}`, username, role }, createdAt: hoursAgo(hours),
  });

  return [
    entry(4, 'Tidewrack Almanac', 'dictionary', 'Heron Cole', null, 2),
    entry(3, 'Staff Sandbox', 'world', 'Formamorph Team', 'admin', 9),
    entry(2, 'The Lamplighter', 'entity', 'Lantern Keeper', null, 30),
    entry(1, 'Marsh Primer', 'world', 'Reed Walker', 'mod', 75),
  ];
}

/** The stub's methods over one queue. */
export function devReviewMethods(queue: ReviewQueueItem[]): Stubbed {
  const take = (id: string): ReviewQueueItem => {
    const index = queue.findIndex((item) => item.id === id);
    if (index < 0) throw new ReviewConflictError('This is no longer waiting for review');
    return queue.splice(index, 1)[0];
  };

  return {
    async fetchMeta() { return { enabled: true }; },
    async fetchQueue() { return [...queue]; },
    async fetchCount() { return queue.length; },
    async fetchAutoApproved() { const entries = devAutoApprovals(); return { entries, total: entries.length }; },
    async setTrusted(id, trusted) { return { id, username: id, trustedAt: trusted ? hoursAgo(0) : null }; },
    async fetchContent(id) { return { worldOverview: { name: queue.find((item) => item.id === id)?.name } }; },
    async approve(id) { take(id); },
    async discardUpdate() { return true; },
    async fetchPendingThumbnail() { return new Blob([PENDING_THUMBNAIL], { type: 'image/svg+xml' }); },
    async reject(id, days) {
      const item = take(id);
      const expires = item.quarantineExpiresAt ?? new Date(Date.now() + (days ?? 7) * 86_400_000).toISOString();
      return {
        id, author: item.author, quarantinedAt: hoursAgo(0), quarantineExpiresAt: expires,
        quarantineExtended: item.type === 'resubmitted',
      };
    },
  };
}

/** Answers the listing read for the canned ids, so names and the live thumbnail show. Other ids go to the server. */
async function readDevListing(id: string, signal?: AbortSignal): Promise<ListingDetailsRead> {
  if (id === 'dev-dep-gone') return { status: 'gone' };
  if (id === 'dev-review-update') {
    return {
      status: 'ok',
      details: {
        name: 'Lanterns Over the Marsh', thumbnailFile: DEV_LIVE_FILE, anonymousLikes: false,
        changelog: devApprovedChangelog(),
      },
    };
  }
  const name = DEV_LISTINGS[id];
  if (name) return { status: 'ok', details: { changelog: [], anonymousLikes: false, name } };

  return Object.getPrototypeOf(WorldStorageService).readListingDetails.call(WorldStorageService, id, signal);
}

const DEV_LIVE_FILE = 'dev-live-thumbnail';

/** Serves the canned live thumbnail; every other file goes to the server. */
function devThumbnailUrl(file: string): string {
  if (file === DEV_LIVE_FILE) return DEV_LIVE_THUMBNAIL;

  return Object.getPrototypeOf(WorldStorageService).thumbnailUrl.call(WorldStorageService, file);
}

let stubbed = false;

/** Shadows the class methods with the stub while the route asks for it; deleting the shadows restores them. */
function sync(): void {
  const wanted = getDevRoute()?.fixture === DEV_REVIEW_FIXTURE;
  if (wanted === stubbed) return;
  if (wanted) {
    Object.assign(ReviewService, devReviewMethods(devReviewFixtures()));
    Object.assign(WorldStorageService, {
      readListingDetails: readDevListing, thumbnailUrl: devThumbnailUrl, fetchCatalog: fetchDevCatalog,
    });
  } else {
    for (const key of STUBBED_KEYS) delete (ReviewService as Partial<Stubbed>)[key];
    delete (WorldStorageService as Partial<typeof WorldStorageService>).fetchCatalog;
    delete (WorldStorageService as Partial<typeof WorldStorageService>).readListingDetails;
    delete (WorldStorageService as Partial<typeof WorldStorageService>).thumbnailUrl;
  }
  stubbed = wanted;
}

/** Watches the dev route for `fixture=review`. A no-op outside DEV. */
export function installDevReviewStub(): void {
  if (!import.meta.env.DEV) return;
  sync();
  window.addEventListener('hashchange', sync);
}
