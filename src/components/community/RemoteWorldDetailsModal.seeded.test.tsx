// Must load before the service singleton, whose constructor opens IndexedDB.
import 'fake-indexeddb/auto';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { RemoteWorldDetailsModal } from './RemoteWorldDetailsModal';
import WorldStorageService from '@/services/WorldStorageService';
import { changelogOf, type ChangelogEntry } from '@/lib/listingChangelog';
import { type WorldRecord } from '@/components/WorldDetails';
import { toast } from 'react-toastify';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/useCachedThumbnail', () => ({ useCachedThumbnail: () => ({ src: '' }) }));
vi.mock('@/components/game/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ text }: { text: string }) => <div>{text}</div>,
}));
vi.mock('@/components/prompt/PromptField', () => ({
  default: () => <textarea aria-label="Comment" />,
}));

/**
 * What the details window shows before its two requests answer, read off the catalog row.
 *
 * Every test holds the requests open, so what is on screen is what the row alone produced. The answers
 * are then released to show which side wins when they disagree.
 */

type Details = Awaited<ReturnType<typeof WorldStorageService.fetchListingDetails>>;
type Comments = Awaited<ReturnType<typeof WorldStorageService.fetchComments>>;

const world = (over: Record<string, unknown> = {}): WorldRecord => ({
  id: 'w1',
  name: 'Sedge Landing',
  description: 'A drowned coastal town.',
  kind: 'world',
  author: { id: 'author-1', username: 'wren_hallow' },
  tags: [],
  downloads: 7,
  likes: 3,
  ...over,
}) as unknown as WorldRecord;

const entry = (): ChangelogEntry => ({
  id: 'e1',
  world_id: 'w1',
  title: 'Update 1',
  body: 'The drowned quarter is walkable now.',
  entry_date: '2026-08-01',
  created_at: '2026-08-01T12:00:00.000Z',
  updated_at: '2026-08-01T12:00:00.000Z',
});

const owner = () => ({ id: 'author-1', username: 'wren_hallow', accountType: 'normal' }) as unknown as WorldRecord;

// Both requests stay open until a test answers them.
let answerDetails: (v: Details) => void;
let answerComments: (v: Comments) => void;

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  // A null answer is a request that got none.
  vi.spyOn(WorldStorageService, 'readListingDetails').mockReturnValue(new Promise((resolve) => {
    answerDetails = (v) => resolve(v ? { status: 'ok', details: v } : { status: 'unreachable' });
  }));
  vi.spyOn(WorldStorageService, 'fetchComments')
    .mockReturnValue(new Promise((resolve) => { answerComments = resolve; }));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const modal = (props: Record<string, unknown> = {}) => (
  <RemoteWorldDetailsModal
    open
    onOpenChange={() => {}}
    world={world()}
    collapsed={false}
    onToggleCollapsed={() => {}}
    isAuthenticated
    openImageViewer={() => {}}
    downloadStateForWorld={() => 'none'}
    downloadProgress={{}}
    onContextualDownload={() => {}}
    currentUser={{ id: 'reader-1', username: 'reader-1', accountType: 'normal' } as unknown as WorldRecord}
    {...props}
  />
);

const show = (props: Record<string, unknown> = {}) => render(modal(props));

const changelogTab = () => screen.getByRole('radio', { name: 'Changelog' });
const placeholders = () => screen.queryAllByTestId('comment-placeholder');
const emptyState = () => screen.queryByText(/no comments yet/i);

describe('the Changelog switch at open', () => {
  it('is enabled at once when the row counts entries', () => {
    show({ world: world({ changelog_count: 2 }) });

    expect(changelogTab()).toBeEnabled();
  });

  it('stays disabled when the row counts none', () => {
    show({ world: world({ changelog_count: 0 }) });

    expect(changelogTab()).toBeDisabled();
  });

  it('is enabled at once on the reader\'s own listing even when the row counts none', () => {
    show({ world: world({ changelog_count: 0 }), currentUser: owner() });

    expect(changelogTab()).toBeEnabled();
  });

  it('is unknown, so disabled, until the answer when the row has no count', async () => {
    show({ currentUser: owner() });

    expect(changelogTab()).toBeDisabled();

    await act(async () => {
      answerDetails({ anonymousLikes: false, changelog: changelogOf({ changelog: [entry()] }) } as Details);
    });
    await waitFor(() => expect(changelogTab()).toBeEnabled());
  });

  it('opens on Changelog at once when the row counts entries and the reader\'s copy is out of date', () => {
    show({ world: world({ changelog_count: 1 }), downloadStateForWorld: () => 'update' });

    expect(changelogTab()).toBeChecked();
    expect(screen.getByTestId('changelog-placeholder')).toBeInTheDocument();
  });

  it('opens on Comments when the row counts entries but the reader has no update waiting', () => {
    show({ world: world({ changelog_count: 1 }) });

    expect(changelogTab()).not.toBeChecked();
  });

  it('does not open on Changelog when the row counts none, whatever the copy says', () => {
    show({ world: world({ changelog_count: 0 }), downloadStateForWorld: () => 'update' });

    expect(changelogTab()).not.toBeChecked();
  });

  it('lets an answer with entries replace the placeholder', async () => {
    show({ world: world({ changelog_count: 1 }), downloadStateForWorld: () => 'update' });

    await act(async () => {
      answerDetails({ anonymousLikes: false, changelog: changelogOf({ changelog: [entry()] }) } as Details);
    });

    expect(await screen.findByText('The drowned quarter is walkable now.')).toBeInTheDocument();
    expect(screen.queryByTestId('changelog-placeholder')).toBeNull();
  });

  it('lets an answer with no entries win over the row, and leaves Changelog', async () => {
    show({ world: world({ changelog_count: 3 }), downloadStateForWorld: () => 'update' });

    await act(async () => {
      answerDetails({ anonymousLikes: false, changelog: [] } as unknown as Details);
    });

    await waitFor(() => expect(changelogTab()).toBeDisabled());
    expect(changelogTab()).not.toBeChecked();
    expect(screen.queryByTestId('changelog-placeholder')).toBeNull();
  });

  it('moves a reader who picked Changelog back when the answer says there is none', async () => {
    show({ world: world({ changelog_count: 3 }) });

    fireEvent.click(changelogTab());
    await act(async () => {
      answerDetails({ anonymousLikes: false, changelog: [] } as unknown as Details);
    });

    await waitFor(() => expect(changelogTab()).not.toBeChecked());
    expect(screen.queryByTestId('changelog-placeholder')).toBeNull();
  });
});

describe('the comments header and rows at open', () => {
  it('shows the row\'s count in the header before the comments answer', () => {
    show({ world: world({ comment_count: 5 }) });

    expect(screen.getByText('Comments (5)')).toBeInTheDocument();
  });

  it('shows one placeholder per expected comment', () => {
    show({ world: world({ comment_count: 3 }) });

    expect(placeholders()).toHaveLength(3);
    expect(emptyState()).toBeNull();
  });

  it('caps the placeholders at one page', () => {
    show({ world: world({ comment_count: 500 }) });

    expect(placeholders()).toHaveLength(20);
  });

  it('shows the empty state at once, with no placeholders, when the row counts none', () => {
    show({ world: world({ comment_count: 0 }) });

    expect(placeholders()).toHaveLength(0);
    expect(emptyState()).toBeInTheDocument();
  });

  it('shows the empty state at once when the row has no count', () => {
    show();

    expect(placeholders()).toHaveLength(0);
    expect(emptyState()).toBeInTheDocument();
  });

  it('lets the comments answer correct the count and replace the placeholders', async () => {
    show({ world: world({ comment_count: 5 }) });

    await act(async () => {
      answerComments({
        success: true, pagination: {}, total: 1,
        data: [{ id: 'c1', content: 'A fine place to drown.', author: { id: 'x', username: 'saltmarsh' } }],
      } as unknown as Comments);
    });

    expect(await screen.findByText('Comments (1)')).toBeInTheDocument();
    expect(placeholders()).toHaveLength(0);
  });

  it('shows the empty state when the answer is empty, though the row counted some', async () => {
    show({ world: world({ comment_count: 5 }) });

    await act(async () => {
      answerComments({ success: true, pagination: {}, total: 0, data: [] } as unknown as Comments);
    });

    expect(await screen.findByText('Comments (0)')).toBeInTheDocument();
    expect(placeholders()).toHaveLength(0);
    expect(emptyState()).toBeInTheDocument();
  });

  it('does not show the last listing\'s answered state on the next listing', async () => {
    const { rerender } = show({ world: world({ comment_count: 1 }) });
    await act(async () => {
      answerComments({ success: true, pagination: {}, total: 0, data: [] } as unknown as Comments);
    });
    await screen.findByText('Comments (0)');

    rerender(modal({ world: world({ id: 'w2', comment_count: 4 }) }));

    expect(screen.getByText('Comments (4)')).toBeInTheDocument();
    expect(placeholders()).toHaveLength(4);
  });

  it('shows the row again, not the last answer, when the same listing is reopened', async () => {
    const { rerender } = show({ world: world({ comment_count: 5 }) });
    await act(async () => {
      answerComments({ success: true, pagination: {}, total: 0, data: [] } as unknown as Comments);
    });
    await screen.findByText('Comments (0)');

    rerender(modal({ open: false, world: world({ comment_count: 5 }) }));
    rerender(modal({ open: true, world: world({ comment_count: 5 }) }));

    expect(screen.getByText('Comments (5)')).toBeInTheDocument();
    expect(placeholders()).toHaveLength(5);
    expect(emptyState()).toBeNull();
  });

  it('keeps the row count, and never claims no comments, when the comments request fails', async () => {
    show({ world: world({ comment_count: 5 }) });

    // The service's own failure shape: it resolves, it never throws.
    await act(async () => {
      answerComments({ success: false, error: 'offline', data: [], total: 0, pagination: {} } as unknown as Comments);
    });

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByText('Comments (5)')).toBeInTheDocument();
    expect(placeholders()).toHaveLength(0);
    expect(emptyState()).toBeNull();
  });

  it('treats a comments read that throws as a failure too', async () => {
    show({ world: world({ comment_count: 5 }) });

    await act(async () => {
      answerComments(Promise.reject(new Error('offline')) as unknown as Comments);
    });

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByText('Comments (5)')).toBeInTheDocument();
    expect(emptyState()).toBeNull();
  });
});

describe('a listing switched to, or a reader who picked', () => {
  it('opens on the new listing tab, not the last listing Changelog', () => {
    const { rerender } = show({ world: world({ changelog_count: 2 }), downloadStateForWorld: () => 'update' });
    expect(changelogTab()).toBeChecked();

    rerender(modal({ world: world({ id: 'w2', changelog_count: 0 }), downloadStateForWorld: () => 'update' }));

    expect(changelogTab()).not.toBeChecked();
    expect(changelogTab()).toBeDisabled();
  });

  it('keeps a picked Comments when a late answer would have defaulted to Changelog', async () => {
    show({ world: world({ changelog_count: 1 }), downloadStateForWorld: () => 'update' });

    fireEvent.click(screen.getByRole('radio', { name: 'Comments' }));
    await act(async () => {
      answerDetails({ anonymousLikes: false, changelog: changelogOf({ changelog: [entry()] }) } as Details);
    });

    await waitFor(() => expect(changelogTab()).toBeEnabled());
    expect(screen.getByRole('radio', { name: 'Comments' })).toBeChecked();
  });

  it('drops the row Changelog when the details request fails, and leaves a picked Changelog', async () => {
    show({ world: world({ changelog_count: 3 }) });

    fireEvent.click(changelogTab());
    await act(async () => {
      answerDetails(null);
    });

    await waitFor(() => expect(changelogTab()).toBeDisabled());
    expect(changelogTab()).not.toBeChecked();
    expect(screen.queryByTestId('changelog-placeholder')).toBeNull();
  });

  it.each([-1, Number.NaN, '3', null])('ignores a row count of %s as no count', (bad) => {
    show({ world: world({ changelog_count: bad }) });

    expect(changelogTab()).toBeDisabled();
  });
});
