/** DEV only: serves a staff catalog with Likes Markers and a canned likes audit while the dev route has `fixture=likesMarker`. */
import { getDevRoute } from '@/lib/devRouter';
import WorldStorageService, { type CatalogFetch, type ListingDetailsRead } from '@/services/WorldStorageService';
import type { CatalogWorld } from '@/lib/worldCatalog';
import type { AnonymousLikeRow, LikerAuditRow, LikesMarkerReason, LikesSummary, NetworkKind } from '@/types';
import { DEV_LIKES_FIXTURE } from '@/lib/dev/devReviewViewer';

const hoursAgo = (hours: number): string => new Date(Date.now() - hours * 3_600_000).toISOString();

const MARKED: Record<string, LikesMarkerReason[]> = {
  'dev-likes-burst': ['burst'],
  'dev-likes-share': ['flagged_share'],
  'dev-likes-both': ['burst', 'flagged_share'],
  'dev-likes-contest-marked': ['burst'],
};

/** The contest the canned entries belong to: an archived one, since the running sample's id changes per call. */
const DEV_CONTEST_ID = 'dev-contest-decided';

const world = (id: string, name: string, likes: number, extra: Record<string, unknown> = {}): CatalogWorld => ({
  id, kind: 'world', name, description: 'A canned listing for the Likes Marker.', tags: ['dev'], downloads: 12, likes,
  author: { id: `${id}-author`, username: 'Reed Walker' },
  created_at: hoursAgo(300), updated_at: hoursAgo(20),
  likes_marker: MARKED[id] ?? [],
  ...extra,
});

/** Five catalog listings, three of them marked, and two contest entries, one of them marked. */
export function devLikesCatalog(): CatalogWorld[] {
  return [
    world('dev-likes-burst', 'Lanterns Over the Marsh', 58),
    world('dev-likes-share', 'The Drowned Bell', 41),
    world('dev-likes-both', 'Nine Frozen Bells', 96),
    world('dev-likes-plain', 'Marsh Primer', 7),
    world('dev-likes-plain-2', 'The Kindling Hour', 3),
    world('dev-likes-contest-marked', 'Autumn Ruins Entry', 34, { contest_event_id: DEV_CONTEST_ID }),
    world('dev-likes-contest-plain', 'Ash Grove Entry', 5, { contest_event_id: DEV_CONTEST_ID }),
  ];
}

const liker = (n: number, kind: NetworkKind | null, group: number | null): LikerAuditRow => ({
  id: `dev-liker-${n}`, username: `reedfern${n}`, avatarUrl: null, status: 'active',
  createdAt: hoursAgo(6), likedAt: hoursAgo(5 - n * 0.01), accountAgeAtLikeSeconds: 3600,
  groupId: group, linkedToAuthor: false, networkKind: kind,
});

const anonymous = (n: number, kind: NetworkKind | null, group: number | null): AnonymousLikeRow => ({
  likedAt: hoursAgo(4 - n * 0.01), browserFamily: n % 2 ? 'Firefox' : 'Chrome',
  groupId: group, linkedToAuthor: false, addressKey: `dev-address-${n}`, networkKind: kind,
});

/** Rows covering all three kinds, a clean row, and one Burst. */
export function devLikesAudit() {
  const summary: LikesSummary = {
    windowDays: 90, flagged: 6, total: 9, share: 6 / 9,
    bursts: [{ startedAt: hoursAgo(5), size: 8 }], reasons: ['burst', 'flagged_share'],
  };

  return {
    total: 9,
    rows: [liker(1, 'vpn', null), liker(2, 'hosting', null), liker(3, null, null)],
    anonymous: 2,
    anonymousRows: [anonymous(1, 'tor', null), anonymous(2, null, null)],
    summary,
  };
}

/** Answers the listing read for the canned ids. Other ids go to the server. */
async function readDevListing(id: string, signal?: AbortSignal): Promise<ListingDetailsRead> {
  if (id.startsWith('dev-likes-')) {
    return { status: 'ok', details: { changelog: [], anonymousLikes: false, likesMarker: MARKED[id] ?? [] } };
  }

  return Object.getPrototypeOf(WorldStorageService).readListingDetails.call(WorldStorageService, id, signal);
}

async function fetchDevCatalog(): Promise<CatalogFetch> {
  return { status: 'fresh', data: devLikesCatalog(), tag: null, anonymousLikes: false };
}

async function fetchDevLikers() {
  const audit = devLikesAudit();
  return { total: audit.total, rows: audit.rows, anonymous: audit.anonymous };
}

async function fetchDevAudit() {
  return devLikesAudit();
}

async function fetchDevComments() {
  return { success: true, data: [], pagination: {}, total: 0 };
}

const STUBBED = ['fetchCatalog', 'readListingDetails', 'fetchLikers', 'fetchLikersAudit', 'fetchComments'] as const;
let stubbed = false;

/** Shadows the class methods with the stub while the route asks for it; deleting the shadows restores them. */
function sync(): void {
  const wanted = getDevRoute()?.fixture === DEV_LIKES_FIXTURE;
  if (wanted === stubbed) return;
  if (wanted) {
    Object.assign(WorldStorageService, {
      fetchCatalog: fetchDevCatalog, readListingDetails: readDevListing,
      fetchLikers: fetchDevLikers, fetchLikersAudit: fetchDevAudit, fetchComments: fetchDevComments,
    });
  } else {
    for (const key of STUBBED) delete (WorldStorageService as Partial<typeof WorldStorageService>)[key];
  }
  stubbed = wanted;
}

/** Watches the dev route for `fixture=likesMarker`. A no-op outside DEV. */
export function installDevLikesStub(): void {
  if (!import.meta.env.DEV) return;
  sync();
  window.addEventListener('hashchange', sync);
}
