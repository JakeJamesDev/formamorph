// Must load before the service singleton, whose constructor opens IndexedDB.
import 'fake-indexeddb/auto';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { $createParagraphNode, $createTextNode, $getRoot, type LexicalEditor } from 'lexical';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { RemoteWorldDetailsModal } from './RemoteWorldDetailsModal';
import WorldStorageService from '@/services/WorldStorageService';
import FeedbackService from '@/services/FeedbackService';
import { type WorldRecord } from '@/components/WorldDetails';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/useCachedThumbnail', () => ({ useCachedThumbnail: () => ({ src: '' }) }));

// The real PromptField stays: the autocomplete is a Lexical plugin mounted inside it.
const world = {
  id: 'w1', name: 'Sedge Landing', description: 'A drowned coastal town.', kind: 'world',
  author: { id: 'author-1', username: 'wren_hallow' }, tags: [], downloads: 7, comment_count: 1, likes: 3,
} as unknown as WorldRecord;

const own = {
  id: 'c1', content: 'A fine place.', created_at: '2026-08-01T00:00:00.000Z', edited_at: null,
  author: { id: 'me', username: 'me', role: null },
} as unknown as WorldRecord;

const user = { id: 'id-Wren_H', username: 'Wren_H', avatarUrl: null, role: null, participant: false };
const thread = { number: 12, title: 'Dark mode', type: 'suggestion', status: 'open' } as const;

const show = () => {
  vi.spyOn(WorldStorageService, 'fetchComments').mockResolvedValue({
    success: true, data: [own], pagination: {}, total: 1,
  });
  return render(
    <RemoteWorldDetailsModal
      open
      onOpenChange={() => {}}
      world={world}
      collapsed={false}
      onToggleCollapsed={() => {}}
      isAuthenticated
      openImageViewer={() => {}}
      downloadStateForWorld={() => 'none'}
      downloadProgress={{}}
      onContextualDownload={() => {}}
      currentUser={{ id: 'me', username: 'me', accountType: 'normal' } as unknown as WorldRecord}
    />
  );
};

const rows = () => screen.queryByTestId('feedback-suggestions')?.querySelectorAll('button') ?? [];
const field = (name: string) => screen.getByLabelText(name);
/** jsdom gives an empty Lexical editor no selection, so the box starts as one space with the caret before it. */
const seed = (name: string) => {
  const editor = (field(name) as HTMLElement & { __lexicalEditor?: LexicalEditor }).__lexicalEditor;
  editor?.update(() => {
    const paragraph = $createParagraphNode().append($createTextNode(' '));
    $getRoot().clear().append(paragraph);
    paragraph.selectStart();
  });
};
const typeInto = async (name: string, text: string) => {
  const u = userEvent.setup();
  if (!field(name).textContent) seed(name);
  await u.click(field(name));
  await u.keyboard(text);
};
const quiet = () => new Promise((resolve) => setTimeout(resolve, 250));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('listing comment autocomplete', () => {
  it('lists names after @ and a character, and a pick inserts the name and a space', async () => {
    const search = vi.spyOn(FeedbackService, 'searchUsers').mockResolvedValue([user]);
    show();
    await screen.findByText('A fine place.');
    await typeInto('Comment', '@wr');

    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(search).toHaveBeenCalledWith('wr', undefined, expect.any(AbortSignal));
    fireEvent.mouseDown(rows()[0]);
    await waitFor(() => expect(field('Comment').textContent).toBe('@Wren_H  '));
  });

  it('lists threads after # and a character, and a pick inserts #N and a space', async () => {
    const search = vi.spyOn(FeedbackService, 'searchThreads').mockResolvedValue([thread]);
    show();
    await screen.findByText('A fine place.');
    await typeInto('Comment', '#da');

    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(search).toHaveBeenCalledWith('da', null, expect.any(AbortSignal));
    fireEvent.mouseDown(rows()[0]);
    await waitFor(() => expect(field('Comment').textContent).toBe('#12  '));
  });

  it('sends no request and shows no menu for a bare @', async () => {
    const search = vi.spyOn(FeedbackService, 'searchUsers').mockResolvedValue([user]);
    show();
    await screen.findByText('A fine place.');
    await typeInto('Comment', '@');
    await quiet();

    expect(search).not.toHaveBeenCalled();
    expect(rows()).toHaveLength(0);
  });

  it('offers the same list in the edit box', async () => {
    vi.spyOn(FeedbackService, 'searchUsers').mockResolvedValue([user]);
    show();
    fireEvent.click(await screen.findByRole('button', { name: /edit comment/i }));
    await typeInto('Comment text', '@wr');

    await waitFor(() => expect(rows()).toHaveLength(1));
  });

  it('offers none in the listing description', async () => {
    const search = vi.spyOn(FeedbackService, 'searchUsers').mockResolvedValue([user]);
    show();
    await screen.findByText('A fine place.');
    const u = userEvent.setup();
    await u.click(screen.getByText('A drowned coastal town.'));
    await u.keyboard('@wr');
    await quiet();

    expect(search).not.toHaveBeenCalled();
    expect(rows()).toHaveLength(0);
  });
});
