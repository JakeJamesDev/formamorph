// Must load before the service singleton, whose constructor opens IndexedDB.
import 'fake-indexeddb/auto';
import { render, screen, cleanup, act } from '@testing-library/react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { RemoteWorldDetailsModal } from './RemoteWorldDetailsModal';
import WorldStorageService, { type ListingDetails, type ListingDetailsRead } from '@/services/WorldStorageService';
import { clearListingDetails } from '@/lib/listingDetailsCache';
import { forgetListingPrefetch, prefetchListing } from '@/lib/listingDetailsLoader';
import { type ChangelogEntry } from '@/lib/listingChangelog';
import { type WorldRecord } from '@/components/WorldDetails';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/useCachedThumbnail', () => ({ useCachedThumbnail: () => ({ src: '' }) }));
vi.mock('@/components/game/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ text }: { text: string }) => <div>{text}</div>,
}));
vi.mock('@/components/prompt/PromptField', () => ({
  default: () => <textarea aria-label="Comment" />,
}));

/**
 * The details window opened on a listing its card already started loading: it reads what the prefetch
 * brings and sends no request of its own.
 */

const world = (id: string): WorldRecord => ({
  id,
  name: `Listing ${id}`,
  description: 'A drowned coastal town.',
  kind: 'world',
  author: { id: 'author-1', username: 'wren_hallow' },
  tags: [],
}) as unknown as WorldRecord;

const entry = (body: string): ChangelogEntry => ({
  id: body, world_id: 'w1', title: 'Update', body, entry_date: '2026-08-01',
  created_at: '2026-08-01T12:00:00.000Z', updated_at: '2026-08-01T12:00:00.000Z',
});

const details = (body: string): ListingDetails => ({ anonymousLikes: false, changelog: [entry(body)] });

const comment = {
  id: 'c1', content: 'Read by the prefetch.', created_at: '2026-08-01T12:00:00.000Z',
  user: { id: 'u2', username: 'marsh_reader' },
};

let answer: (read: ListingDetailsRead) => void;

beforeEach(async () => {
  forgetListingPrefetch();
  await clearListingDetails();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(WorldStorageService, 'fetchComments').mockResolvedValue(
    { success: true, data: [comment], total: 1, pagination: {} } as never,
  );
  vi.spyOn(WorldStorageService, 'readListingDetails').mockImplementation(
    () => new Promise((resolve) => { answer = resolve; }),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const modal = (id: string) => (
  <RemoteWorldDetailsModal
    open
    onOpenChange={() => {}}
    world={world(id)}
    collapsed={false}
    onToggleCollapsed={() => {}}
    isAuthenticated
    openImageViewer={() => {}}
    // An update waiting opens the window on Changelog, where the entries are on screen.
    downloadStateForWorld={() => 'update'}
    downloadProgress={{}}
    onContextualDownload={() => {}}
  />
);

describe('opening a listing its card is prefetching', () => {
  it('shows what the prefetch reads and sends no request of its own', async () => {
    prefetchListing('w1');

    render(modal('w1'));
    await act(async () => { answer({ status: 'ok', details: details('From the prefetch.') }); });

    expect(await screen.findByText('From the prefetch.')).toBeInTheDocument();
    expect(WorldStorageService.readListingDetails).toHaveBeenCalledTimes(1);
    expect(WorldStorageService.fetchComments).toHaveBeenCalledTimes(1);
  });

  it('shows the comments the prefetch read', async () => {
    prefetchListing('w1');

    render(modal('w1'));

    expect(await screen.findByText('Read by the prefetch.')).toBeInTheDocument();
    expect(WorldStorageService.fetchComments).toHaveBeenCalledTimes(1);
  });

  it('asks for itself when the card prefetched another listing', async () => {
    prefetchListing('w2');

    render(modal('w1'));

    await vi.waitFor(() => expect(WorldStorageService.readListingDetails).toHaveBeenCalledTimes(2));
    expect(vi.mocked(WorldStorageService.readListingDetails).mock.calls[1][0]).toBe('w1');
    expect(WorldStorageService.fetchComments).toHaveBeenCalledTimes(2);
  });
});
