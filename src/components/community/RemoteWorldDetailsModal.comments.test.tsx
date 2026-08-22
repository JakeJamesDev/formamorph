// Must load before the service singleton, whose constructor opens IndexedDB.
import 'fake-indexeddb/auto';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RemoteWorldDetailsModal } from './RemoteWorldDetailsModal';
import WorldStorageService from '@/services/WorldStorageService';
import { type WorldRecord } from '@/components/WorldDetails';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/useCachedThumbnail', () => ({ useCachedThumbnail: () => ({ src: '' }) }));

// Rendered as its own text so a test can find a comment body by what it says, and marked so a test can
// tell the renderer apart from a plain paragraph. The listing description goes through this renderer too,
// which is why nothing here queries by the marker alone.
vi.mock('@/components/game/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ text }: { text: string }) => <div data-testid="markdown">{text}</div>,
}));

// jsdom can't drive a real Lexical selection; the editors are stubbed to textareas so they can be filled.
// Keyed on the aria-label rather than one fixed id — the compose box and an open edit box coexist.
vi.mock('@/components/prompt/PromptField', () => ({
  default: ({ value, onChange, ariaLabel, placeholder }: {
    value: string; onChange: (v: string) => void; ariaLabel?: string; placeholder?: string;
  }) => (
    <textarea
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

/**
 * The comment thread on a published listing.
 *
 * Two rules meet on this panel and both have to read from the controls alone: the words stay their
 * author's, so only they get a pencil; but the page belongs to somebody, so its author and the team get
 * a bin. The server decides the same thing again — this only keeps off screen what would be refused.
 */

const toast = vi.mocked(await import('react-toastify')).toast;

const world = (over: Record<string, unknown> = {}): WorldRecord => ({
  id: 'w1',
  name: 'Sedge Landing',
  description: 'A drowned coastal town.',
  kind: 'world',
  author: { id: 'author-1', username: 'wren_hallow' },
  tags: [],
  downloads: 7,
  comment_count: 2,
  likes: 3,
  ...over,
}) as unknown as WorldRecord;

const comment = (over: Record<string, unknown> = {}): WorldRecord => ({
  id: 'c1',
  content: 'A fine place to drown.',
  created_at: '2026-08-01T00:00:00.000Z',
  edited_at: null,
  author: { id: 'commenter-1', username: 'saltmarsh', role: null },
  ...over,
}) as unknown as WorldRecord;

const account = (id: string, accountType = 'normal') =>
  ({ id, username: id, accountType }) as unknown as WorldRecord;

const listComments = (comments: WorldRecord[], pagination: Record<string, unknown> = {}) =>
  vi.spyOn(WorldStorageService, 'fetchComments').mockResolvedValue({
    success: true, data: comments, pagination, total: comments.length,
  });

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
      currentUser={account('commenter-1')}
      {...props}
    />
  );

/** The row of controls on the one comment on screen. */
const pencil = () => screen.queryByRole('button', { name: /edit comment/i });
const bin = () => screen.queryByRole('button', { name: /delete comment/i });

/** The default comment's body, once the thread has loaded. */
const body = () => screen.findByText('A fine place to drown.');

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('reading the thread', () => {
  it('renders a comment through the markdown renderer, not as a plain paragraph', async () => {
    listComments([comment({ content: '**Drowned** and lovely.' })]);

    show();

    expect(await screen.findByText('**Drowned** and lovely.')).toHaveAttribute('data-testid', 'markdown');
  });

  it('says when one has been rewritten, so a reply below it can be read in context', async () => {
    listComments([comment({ edited_at: '2026-08-02T00:00:00.000Z' })]);

    show();

    expect(await screen.findByText(/edited/)).toBeTruthy();
  });

  it('says nothing of the kind about an untouched one', async () => {
    listComments([comment()]);

    show();

    await body();
    expect(screen.queryByText(/edited/)).toBeNull();
  });
});

describe('who gets which control', () => {
  it('gives the commenter both', async () => {
    listComments([comment()]);

    show({ currentUser: account('commenter-1') });

    await body();
    expect(pencil()).toBeTruthy();
    expect(bin()).toBeTruthy();
  });

  it('gives the listing’s author the bin and not the pencil', async () => {
    // Their page, not their words.
    listComments([comment()]);

    show({ currentUser: account('author-1') });

    await body();
    expect(pencil()).toBeNull();
    expect(bin()).toBeTruthy();
  });

  it('gives a moderator the bin over an ordinary account, and never the pencil', async () => {
    listComments([comment()]);

    show({ currentUser: account('mod-1', 'mod') });

    await body();
    expect(pencil()).toBeNull();
    expect(bin()).toBeTruthy();
  });

  it('stops a moderator at another staff account’s comment', async () => {
    listComments([comment({ author: { id: 'admin-1', username: 'root', role: 'admin' } })]);

    show({ currentUser: account('mod-1', 'mod') });

    await screen.findByText('A fine place to drown.');
    expect(bin()).toBeNull();
  });

  it('gives an admin the bin over a moderator’s comment', async () => {
    listComments([comment({ author: { id: 'mod-1', username: 'keeper', role: 'mod' } })]);

    show({ currentUser: account('admin-1', 'admin') });

    await body();
    expect(bin()).toBeTruthy();
  });

  it('gives a passer-by neither', async () => {
    listComments([comment()]);

    show({ currentUser: account('stranger') });

    await body();
    expect(pencil()).toBeNull();
    expect(bin()).toBeNull();
  });

  it('gives a signed-out reader neither, and leaves the thread readable', async () => {
    listComments([comment()]);

    show({ currentUser: null, isAuthenticated: false });

    expect(await body()).toBeTruthy();
    expect(pencil()).toBeNull();
    expect(bin()).toBeNull();
  });
});

describe('rewriting one’s own comment', () => {
  const openEditor = async () => {
    listComments([comment()]);
    show();
    await body();
    fireEvent.click(pencil()!);
  };

  it('opens on the text that is already there', async () => {
    await openEditor();

    expect((screen.getByLabelText('Comment text') as HTMLTextAreaElement).value)
      .toBe('A fine place to drown.');
  });

  it('writes the server’s version back into the thread, edited marker and all', async () => {
    const save = vi.spyOn(WorldStorageService, 'updateComment').mockResolvedValue(
      comment({ content: 'On reflection, a fine place to drown.', edited_at: '2026-08-02T00:00:00.000Z' })
    );
    await openEditor();

    fireEvent.change(screen.getByLabelText('Comment text'), {
      target: { value: 'On reflection, a fine place to drown.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(save).toHaveBeenCalledWith('c1', 'On reflection, a fine place to drown.'));
    expect(await screen.findByText('On reflection, a fine place to drown.')).toBeTruthy();
    expect(screen.getByText(/edited/)).toBeTruthy();
  });

  it('leaves the comment as it was when the save is refused', async () => {
    vi.spyOn(WorldStorageService, 'updateComment').mockRejectedValue(new Error('Not authorized'));
    await openEditor();

    fireEvent.change(screen.getByLabelText('Comment text'), { target: { value: 'Sanitized.' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Not authorized'));
    // The editor stays open over the failed draft rather than discarding it, and the comment behind it
    // is untouched — backing out shows the words that are still stored.
    expect((screen.getByLabelText('Comment text') as HTMLTextAreaElement).value).toBe('Sanitized.');
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.getByText('A fine place to drown.')).toBeTruthy();
  });

  it('closes without writing anything when cancelled', async () => {
    const save = vi.spyOn(WorldStorageService, 'updateComment');
    await openEditor();

    fireEvent.change(screen.getByLabelText('Comment text'), { target: { value: 'Never mind.' } });
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(save).not.toHaveBeenCalled();
    expect(screen.getByText('A fine place to drown.')).toBeTruthy();
  });
});

describe('taking one down', () => {
  const openConfirm = async () => {
    listComments([comment()]);
    show();
    await body();
    fireEvent.click(bin()!);
  };

  it('asks first, so a stray click costs nothing', async () => {
    const remove = vi.spyOn(WorldStorageService, 'deleteComment');
    await openConfirm();

    expect(await screen.findByText(/delete this comment/i)).toBeTruthy();
    expect(remove).not.toHaveBeenCalled();
  });

  it('removes it and takes the count down with it once confirmed', async () => {
    const remove = vi.spyOn(WorldStorageService, 'deleteComment').mockResolvedValue(undefined);
    await openConfirm();

    fireEvent.click(await screen.findByRole('button', { name: /confirm/i }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith('c1'));
    await waitFor(() => expect(screen.queryByText('A fine place to drown.')).toBeNull());
    expect(screen.getByText('Comments (0)')).toBeTruthy();
  });

  it('re-reads the whole window afterwards, so nothing is skipped by the rows shifting up', async () => {
    // Paging by number would ask for the *next* twenty; with one row gone, the comment that moved up
    // into the last slot of what is already on screen would never be shown.
    const fetchComments = listComments([comment()], { next: { page: 2, limit: 20 } });
    vi.spyOn(WorldStorageService, 'deleteComment').mockResolvedValue(undefined);
    show();
    await body();
    fireEvent.click(bin()!);
    fireEvent.click(await screen.findByRole('button', { name: /confirm/i }));
    await waitFor(() => expect(screen.queryByText('A fine place to drown.')).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: /load more/i }));

    await waitFor(() => expect(fetchComments).toHaveBeenCalledTimes(2));
    expect(fetchComments.mock.calls[1]).toEqual(['w1', 1, 40]);
  });

  it('leaves it where it is when the delete is refused', async () => {
    vi.spyOn(WorldStorageService, 'deleteComment').mockRejectedValue(new Error('Not authorized'));
    await openConfirm();

    fireEvent.click(await screen.findByRole('button', { name: /confirm/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Not authorized'));
    expect(screen.getByText('A fine place to drown.')).toBeTruthy();
    expect(screen.getByText('Comments (1)')).toBeTruthy();
  });
});
