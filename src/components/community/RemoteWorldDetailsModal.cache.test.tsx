// Must load before the service singleton, whose constructor opens IndexedDB.
import 'fake-indexeddb/auto';
import { render, screen, cleanup, act } from '@testing-library/react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { RemoteWorldDetailsModal } from './RemoteWorldDetailsModal';
import WorldStorageService, { type ListingDetails, type ListingDetailsRead } from '@/services/WorldStorageService';
import { putCachedDetails } from '@/lib/listingDetailsCache';
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
 * The details window on a listing opened before: what the disk holds shows at once, and the server's
 * answer decides what stays.
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

// Each listing's server read stays open until a test answers it.
const answers = new Map<string, (read: ListingDetailsRead) => void>();

beforeEach(() => {
  answers.clear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(WorldStorageService, 'fetchComments').mockResolvedValue({ data: [], total: 0 } as never);
  vi.spyOn(WorldStorageService, 'readListingDetails').mockImplementation(
    (id) => new Promise((resolve) => { answers.set(id, resolve); }),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const modal = (id: string, over: Record<string, unknown> = {}) => (
  <RemoteWorldDetailsModal
    open
    onOpenChange={() => {}}
    world={{ ...world(id), ...over } as WorldRecord}
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

const answer = async (id: string, read: ListingDetailsRead) => {
  await act(async () => { answers.get(id)?.(read); });
};

describe('a listing opened before', () => {
  it('shows its cached details before the server answers', async () => {
    await putCachedDetails('w1', details('From the last visit.'));

    render(modal('w1'));

    expect(await screen.findByText('From the last visit.')).toBeInTheDocument();
  });

  it('replaces the cached details with the fresh answer', async () => {
    await putCachedDetails('w1', details('From the last visit.'));
    render(modal('w1'));
    await screen.findByText('From the last visit.');

    await answer('w1', { status: 'ok', details: details('From today.') });

    expect(await screen.findByText('From today.')).toBeInTheDocument();
    expect(screen.queryByText('From the last visit.')).toBeNull();
  });

  it('keeps the cached details when the server does not answer', async () => {
    await putCachedDetails('w1', details('From the last visit.'));
    render(modal('w1'));
    await screen.findByText('From the last visit.');

    await answer('w1', { status: 'unreachable' });

    expect(screen.getByText('From the last visit.')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Changelog' })).toBeEnabled();
  });

  it('shows the cached details when the server fails before the disk answers', async () => {
    await putCachedDetails('w1', details('From the last visit.'));
    vi.mocked(WorldStorageService.readListingDetails).mockResolvedValue({ status: 'unreachable' });

    render(modal('w1'));

    expect(await screen.findByText('From the last visit.')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Changelog' })).toBeEnabled();
  });

  it('clears the cached details when the listing is gone for this reader', async () => {
    await putCachedDetails('w1', details('From the last visit.'));
    render(modal('w1'));
    await screen.findByText('From the last visit.');

    await answer('w1', { status: 'gone' });

    expect(screen.queryByText('From the last visit.')).toBeNull();
    expect(screen.getByRole('radio', { name: 'Changelog' })).toBeDisabled();
  });

  it('lets the catalog count, not a cached entry that disagrees, hold the tab until the answer', async () => {
    // The disk says no entries; the row, read this open, says three and an update waits.
    await putCachedDetails('w1', { anonymousLikes: false, changelog: [] });
    const seen: boolean[] = [];
    const view = render(modal('w1', { changelog_count: 3 }));
    const record = () => seen.push(screen.getByRole('radio', { name: 'Changelog' }).getAttribute('aria-checked') === 'true');
    record();
    // Long enough for the disk read to land.
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
    record();

    await answer('w1', { status: 'ok', details: details('From today.') });
    await screen.findByText('From today.');
    record();
    view.unmount();

    // Changelog from the first frame to the answer, never dropped to Comments and back.
    expect(seen).toEqual([true, true, true]);
  });

  it('falls back to a disagreeing cached entry when the server does not answer', async () => {
    await putCachedDetails('w1', details('From the last visit.'));
    render(modal('w1', { changelog_count: 3 }));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });

    await answer('w1', { status: 'unreachable' });

    expect(await screen.findByText('From the last visit.')).toBeInTheDocument();
  });

  it('never shows one listing’s cached details in the next listing’s window', async () => {
    await putCachedDetails('w1', details('Only true of w1.'));

    // Switched before the disk read for w1 can answer; w2 has nothing cached and no answer yet.
    const view = render(modal('w1'));
    view.rerender(modal('w2'));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });

    expect(screen.getByText('Listing w2')).toBeInTheDocument();
    expect(screen.queryByText('Only true of w1.')).toBeNull();
  });
});
