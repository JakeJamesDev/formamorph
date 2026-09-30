/**
 * One listing's details, from disk at once and from the server when it answers.
 *
 * The fresh read always runs and keeps the disk current: an answer replaces the entry, a listing this
 * reader may not see drops it, and no answer leaves it. The cached read gives way to a fresh answer, so
 * details from disk never land after it and a slow disk never holds it back.
 *
 * A prefetch reads a listing before it is opened: its details and its first comments page. One runs at a
 * time, and a new one cancels the last unless an open already waits on it. The next open of that listing
 * takes what it read instead of asking again, while it is in flight or recently answered.
 */
import WorldStorageService, { type ListingDetails, type ListingDetailsRead } from '@/services/WorldStorageService';
import { dropCachedDetails, getCachedDetails, putCachedDetails } from '@/lib/listingDetailsCache';
import { currentReader } from '@/lib/currentReader';

export interface ListingDetailsLoad {
  /** This reader's last known details, or null when none are held or the fresh answer came first. */
  cached: Promise<ListingDetails | null>;
  fresh: Promise<ListingDetailsRead>;
}

/** How many comments the first page holds, and how many more each "Load more" adds. */
export const COMMENTS_PAGE = 20;

/** How long an answered prefetch still stands in for the open's own request. */
export const PREFETCH_REUSE_MS = 30_000;

export type CommentsPage = Awaited<ReturnType<typeof WorldStorageService.fetchComments>>;

/** A prefetched read, with when it answered so an old one is not passed off as fresh. */
interface Held<T> {
  read: Promise<T>;
  settledAt: number | null;
  /** Whether it got an answer; a failed read never stands in for the open's own. */
  answered: boolean;
}

interface Prefetch {
  listingId: string;
  reader: string;
  controller: AbortController;
  details: Held<ListingDetailsRead> | null;
  comments: Held<CommentsPage> | null;
  /** Whether an open took part of it, which puts it out of a later prefetch's reach. */
  joined: boolean;
}

let prefetch: Prefetch | null = null;

/** Listings answered for a reader in this visit, which a prefetch then leaves alone. */
const answered = new Set<string>();
/** Bumped by a purge, so a read in flight across it never writes its answer back. */
let generation = 0;
const visitKey = (reader: string, listingId: string) => `${reader}\u0000${listingId}`;

const hold = <T>(read: Promise<T>, isAnswer: (value: T) => boolean): Held<T> => {
  const held: Held<T> = { read, settledAt: null, answered: false };
  void read.then(
    (value) => { held.settledAt = Date.now(); held.answered = isAnswer(value); },
    () => { held.settledAt = Date.now(); },
  );
  return held;
};

const usable = <T>(held: Held<T> | null): held is Held<T> =>
  held !== null
  && (held.settledAt === null || (held.answered && Date.now() - held.settledAt <= PREFETCH_REUSE_MS));

/** The prefetch of this listing for this reader, when one is held. */
const prefetchOf = (listingId: string): Prefetch | null =>
  prefetch && prefetch.listingId === listingId && prefetch.reader === currentReader() ? prefetch : null;

const readFresh = async (listingId: string, signal?: AbortSignal): Promise<ListingDetailsRead> => {
  let reader: string;
  let read: ListingDetailsRead;
  const startedIn = generation;
  try {
    reader = currentReader();
    read = await WorldStorageService.readListingDetails(listingId, signal);
    // An answer read for somebody who has since signed in or out is theirs, not the new reader's.
    if (currentReader() !== reader || generation !== startedIn) return read;
  } catch {
    return { status: 'unreachable' };
  }
  if (read.status === 'ok') answered.add(visitKey(reader, listingId));
  const write = read.status === 'ok' ? putCachedDetails(listingId, read.details)
    : read.status === 'gone' ? dropCachedDetails(listingId)
      : null;
  write?.catch((error: unknown) => console.error('Failed to update the listing details cache:', error));
  return read;
};

/** Start reading a listing's details, joining its prefetch when one is held. */
export function loadListingDetails(listingId: string): ListingDetailsLoad {
  const pending = prefetchOf(listingId);
  let fresh: Promise<ListingDetailsRead>;
  if (pending && usable(pending.details)) {
    fresh = pending.details.read;
    pending.details = null;
    pending.joined = true;
  } else {
    fresh = readFresh(listingId);
  }
  // Only a real answer supersedes the disk; after a failed request the cached details are all there is.
  const answeredFresh = fresh.then((read) => (read.status === 'unreachable' ? new Promise<null>(() => {}) : null));
  const cached = Promise.race([getCachedDetails(listingId).catch(() => null), answeredFresh]);
  return { cached, fresh };
}

/** The first comments page a prefetch of this listing read, once, or null when none is held. */
export function takePrefetchedComments(listingId: string): Promise<CommentsPage> | null {
  const pending = prefetchOf(listingId);
  if (!pending || !usable(pending.comments)) return null;
  const { read } = pending.comments;
  pending.comments = null;
  pending.joined = true;
  return read;
}

/** Read a listing ahead of its open, unless this visit already has its details. */
export function prefetchListing(listingId: string): void {
  const reader = currentReader();
  const current = prefetchOf(listingId);
  if (answered.has(visitKey(reader, listingId)) || (current && !current.joined && usable(current.details))) {
    // The details are in hand; a comments page that got no answer is read again.
    const failed = current?.comments;
    if (current && !current.joined && failed && failed.settledAt !== null && !failed.answered) {
      current.comments = hold(
        WorldStorageService.fetchComments(listingId, 1, COMMENTS_PAGE, current.controller.signal),
        (page) => page.success,
      );
    }
    return;
  }

  if (prefetch && !prefetch.joined) prefetch.controller.abort();
  const controller = new AbortController();
  prefetch = {
    listingId, reader, controller, joined: false,
    details: hold(readFresh(listingId, controller.signal), (read) => read.status !== 'unreachable'),
    comments: hold(WorldStorageService.fetchComments(listingId, 1, COMMENTS_PAGE, controller.signal), (page) => page.success),
  };
}

/** Drop the held prefetch and what this visit has answered, as a purge of the community caches does. */
export function forgetListingPrefetch(): void {
  if (prefetch && !prefetch.joined) prefetch.controller.abort();
  prefetch = null;
  answered.clear();
  generation += 1;
}
