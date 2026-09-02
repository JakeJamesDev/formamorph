// Must load before the service singleton, whose constructor opens IndexedDB.
import 'fake-indexeddb/auto';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RemoteWorldDetailsModal } from './RemoteWorldDetailsModal';
import WorldStorageService from '@/services/WorldStorageService';
import { type WorldRecord } from '@/components/WorldDetails';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/useCachedThumbnail', () => ({ useCachedThumbnail: () => ({ src: '' }) }));
vi.mock('@/components/game/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ text }: { text: string }) => <div>{text}</div>,
}));
vi.mock('@/components/prompt/PromptField', () => ({ default: () => null }));

/** Records what the likers list was opened with, so the gate can be tested without its whole body. */
const likersProps = vi.hoisted(() => ({ last: null as Record<string, unknown> | null }));

vi.mock('@/components/community/LikersDialog', () => ({
  LikersDialog: (props: Record<string, unknown>) => {
    likersProps.last = props;
    return props.open ? <div data-testid="likers" /> : null;
  },
}));

const world = (over: Record<string, unknown> = {}): WorldRecord => ({
  id: 'w1',
  _id: 'w1',
  name: 'Sedge Landing',
  description: 'A drowned coastal town.',
  kind: 'world',
  author: { id: 'author-1', username: 'wren_hallow' },
  tags: [],
  downloads: 7,
  comment_count: 0,
  likes: 3,
  ...over,
}) as unknown as WorldRecord;

const account = (id: string, accountType = 'normal') =>
  ({ id, username: id, accountType }) as unknown as WorldRecord;

const show = (props: Record<string, unknown> = {}) =>
  render(
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
      currentUser={account('reader-1')}
      onLike={async () => {}}
      {...props}
    />
  );

/** The one control that says a likers list exists. Absent for everybody but staff. */
const likersButton = () => screen.queryByRole('button', { name: /Show who liked this/ });

beforeEach(() => {
  likersProps.last = null;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(WorldStorageService, 'fetchComments').mockResolvedValue({
    success: true, data: [], pagination: {}, total: 0,
  });
  vi.spyOn(WorldStorageService, 'fetchChangelog').mockResolvedValue(null);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('who is told the likers exist', () => {
  it('says nothing to an ordinary signed-in reader', async () => {
    show();

    await screen.findByText('Sedge Landing');
    expect(likersButton()).toBeNull();
    // The heart is still theirs to press; only the way into the list is missing.
    expect(screen.getByRole('button', { name: /Like — 3 likes/ })).toBeTruthy();
  });

  it('says nothing to the listing’s own author', async () => {
    show({ currentUser: account('author-1') });

    await screen.findByText('Sedge Landing');
    expect(likersButton()).toBeNull();
  });

  it('says nothing to a signed-out visitor', async () => {
    show({ currentUser: null, isAuthenticated: false });

    await screen.findByText('Sedge Landing');
    expect(likersButton()).toBeNull();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('offers it to a moderator, naming what it opens', async () => {
    show({ currentUser: account('m1', 'mod') });

    expect(await screen.findByRole('button', { name: 'Show who liked this — 3 likes' })).toBeTruthy();
  });

  it('offers it to an admin on a quarantined listing, so hiding it does not hide the evidence', async () => {
    show({
      currentUser: account('a1', 'admin'),
      world: world({ quarantined_at: '2026-08-01 00:00:00', quarantine_expires_at: '2126-08-08 00:00:00' }),
    });

    expect(await screen.findByRole('button', { name: /Show who liked this/ })).toBeTruthy();
  });
});

describe('opening the likers list', () => {
  it('opens it on this listing, and hands a removal’s new count back to the parent', async () => {
    const onLikesChanged = vi.fn();

    show({ currentUser: account('a1', 'admin'), onLikesChanged });

    fireEvent.click(await screen.findByRole('button', { name: /Show who liked this/ }));

    await waitFor(() => expect(screen.getByTestId('likers')).toBeTruthy());
    expect(likersProps.last?.listingId).toBe('w1');
    expect(likersProps.last?.listingName).toBe('Sedge Landing');

    (likersProps.last?.onLikesChanged as (likes: number) => void)(2);
    expect(onLikesChanged).toHaveBeenCalledWith(expect.objectContaining({ id: 'w1' }), 2);
  });

  it('does not mount the list for a reader who was never offered it', async () => {
    show();

    await screen.findByText('Sedge Landing');
    expect(likersProps.last).toBeNull();
  });
});

describe('the list does not follow the reader to the next listing', () => {
  it('closes when the details modal closes, so the next listing opens without it', async () => {
    const { rerender } = show({ currentUser: account('a1', 'admin') });

    fireEvent.click(await screen.findByRole('button', { name: /Show who liked this/ }));
    await waitFor(() => expect(screen.getByTestId('likers')).toBeTruthy());

    const props = {
      onOpenChange: () => {},
      collapsed: false,
      onToggleCollapsed: () => {},
      isAuthenticated: true,
      openImageViewer: () => {},
      downloadStateForWorld: () => 'none' as const,
      downloadProgress: {},
      onContextualDownload: () => {},
      currentUser: account('a1', 'admin'),
      onLike: async () => {},
    };

    // Closed, then reopened on a different listing — the way a reader moves through the catalog.
    rerender(<RemoteWorldDetailsModal open={false} world={world()} {...props} />);
    rerender(<RemoteWorldDetailsModal open world={world({ id: 'w2', _id: 'w2', name: 'Harrow Court' })} {...props} />);

    await screen.findByText('Harrow Court');
    expect(screen.queryByTestId('likers')).toBeNull();
  });

  it('closes when the reader is moved straight to another listing', async () => {
    const { rerender } = show({ currentUser: account('a1', 'admin') });

    fireEvent.click(await screen.findByRole('button', { name: /Show who liked this/ }));
    await waitFor(() => expect(screen.getByTestId('likers')).toBeTruthy());

    rerender(
      <RemoteWorldDetailsModal
        open
        onOpenChange={() => {}}
        world={world({ id: 'w2', _id: 'w2', name: 'Harrow Court' })}
        collapsed={false}
        onToggleCollapsed={() => {}}
        isAuthenticated
        openImageViewer={() => {}}
        downloadStateForWorld={() => 'none'}
        downloadProgress={{}}
        onContextualDownload={() => {}}
        currentUser={account('a1', 'admin')}
        onLike={async () => {}}
      />
    );

    await screen.findByText('Harrow Court');
    expect(screen.queryByTestId('likers')).toBeNull();
  });
});
