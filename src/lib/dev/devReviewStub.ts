/** DEV only: serves `ReviewService` from an in-memory queue while the dev route has `fixture=review`. */
import { getDevRoute } from '@/lib/devRouter';
import ReviewService, { ReviewConflictError, type ReviewQueueItem } from '@/services/ReviewService';

export const DEV_REVIEW_FIXTURE = 'review';

const STUBBED_KEYS = [
  'fetchMeta', 'fetchQueue', 'fetchCount', 'fetchContent', 'approve', 'reject',
] as const satisfies readonly (keyof typeof ReviewService)[];
type Stubbed = Pick<typeof ReviewService, (typeof STUBBED_KEYS)[number]>;

const hoursAgo = (hours: number): string => new Date(Date.now() - hours * 3_600_000).toISOString();

const person = (id: string, username: string, role: string | null = null) => ({ id, username, role, avatarUrl: null });

/** The queue the stub starts from: a contest entry, a resubmission, and a new listing by a mod. */
export function devReviewFixtures(): ReviewQueueItem[] {
  return [
    {
      id: 'dev-review-contest', kind: 'world', name: 'Lanterns Over the Marsh', type: 'new',
      author: person('dev-author-1', 'Lantern Keeper'), contest: { id: 'dev-contest', title: 'Autumn Contest' },
      queuedAt: hoursAgo(5), createdAt: hoursAgo(5), quarantineExpiresAt: null,
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
    async fetchContent(id) { return { worldOverview: { name: queue.find((item) => item.id === id)?.name } }; },
    async approve(id) { take(id); },
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

let stubbed = false;

/** Shadows the class methods with the stub while the route asks for it; deleting the shadows restores them. */
function sync(): void {
  const wanted = getDevRoute()?.fixture === DEV_REVIEW_FIXTURE;
  if (wanted === stubbed) return;
  if (wanted) Object.assign(ReviewService, devReviewMethods(devReviewFixtures()));
  else for (const key of STUBBED_KEYS) delete (ReviewService as Partial<Stubbed>)[key];
  stubbed = wanted;
}

/** Watches the dev route for `fixture=review`. A no-op outside DEV. */
export function installDevReviewStub(): void {
  if (!import.meta.env.DEV) return;
  sync();
  window.addEventListener('hashchange', sync);
}
