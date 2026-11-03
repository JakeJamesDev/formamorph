// Must load before the service singleton, whose constructor opens IndexedDB.
import 'fake-indexeddb/auto';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { $createParagraphNode, $createTextNode, $getRoot, type LexicalEditor } from 'lexical';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RemoteWorldDetailsModal } from './RemoteWorldDetailsModal';
import { FeedbackHost } from '@/components/FeedbackHost';
import { closeFeedback } from '@/lib/feedbackOpener';
import FeedbackService from '@/services/FeedbackService';
import WorldStorageService from '@/services/WorldStorageService';
import { type WorldRecord } from '@/components/WorldDetails';
import type { FeedbackLinkTarget } from '@/types';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/useCachedThumbnail', () => ({ useCachedThumbnail: () => ({ src: '' }) }));

const world = {
  id: 'w1', name: 'Sedge Landing', description: 'A drowned coastal town.', kind: 'world',
  author: { id: 'author-1', username: 'wren_hallow' }, tags: [], downloads: 7, comment_count: 1, likes: 3,
} as unknown as WorldRecord;

const own = {
  id: 'c1', content: 'Ask @wren.', created_at: '2026-08-01T00:00:00.000Z', edited_at: null,
  author: { id: 'me', username: 'me', role: null },
} as unknown as WorldRecord;

const WREN: FeedbackLinkTarget = { kind: 'user', ref: 'wren', available: true, id: 'u3', username: 'wren', avatarUrl: null };
const BUG: FeedbackLinkTarget = { kind: 'thread', ref: '9', available: true, number: 9, title: 'Map stops panning', type: 'bug', status: 'confirmed' };
const LISTING: FeedbackLinkTarget = { kind: 'listing', ref: 'world/w2', available: true, listingKind: 'world', id: 'w2', title: 'Brinewell', thumbnailUrl: '' };

const show = (props: Record<string, unknown> = {}) => {
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
      {...props}
    />,
  );
};

function fill(name: string, text: string) {
  act(() => {
    (screen.getByLabelText(name) as HTMLElement & { __lexicalEditor?: LexicalEditor }).__lexicalEditor?.update(() => {
      $getRoot().clear().append($createParagraphNode().append($createTextNode(text)));
    }, { discrete: true });
  });
}

const pane = () => screen.getByTestId('prompt-preview');

afterEach(() => {
  closeFeedback();
  cleanup();
  vi.restoreAllMocks();
});

describe('Preview in the listing comment box', () => {
  it('draws chips after the resolve', async () => {
    const resolve = vi.spyOn(FeedbackService, 'resolveLinks').mockResolvedValue([WREN]);
    show();
    await screen.findByLabelText('Comment');
    fill('Comment', 'Hello @wren');

    await userEvent.setup().click(screen.getAllByRole('tab', { name: 'Preview' })[0]);

    expect(await within(pane()).findByRole('link', { name: /wren/ })).toBeInTheDocument();
    expect(resolve).toHaveBeenCalledWith('Hello @wren', expect.any(AbortSignal));
  });

  it('draws chips in the comment edit box', async () => {
    const resolve = vi.spyOn(FeedbackService, 'resolveLinks').mockResolvedValue([WREN]);
    show();
    fireEvent.click(await screen.findByRole('button', { name: /edit comment/i }));
    await screen.findByLabelText('Comment text');

    // The new comment box comes first, then the edit box.
    await userEvent.setup().click(screen.getAllByRole('tab', { name: 'Preview' })[1]);

    expect(await within(pane()).findByRole('link', { name: /wren/ })).toBeInTheDocument();
    expect(resolve).toHaveBeenCalledWith('Ask @wren.', expect.any(AbortSignal));
  });

  it('opens a thread chip in the Feedback dialog, above the box', async () => {
    vi.spyOn(FeedbackService, 'resolveLinks').mockResolvedValue([BUG]);
    const fetchThread = vi.spyOn(FeedbackService, 'fetchThread').mockRejectedValue(new Error('Not found'));
    show();
    render(<FeedbackHost />);
    await screen.findByLabelText('Comment');
    fill('Comment', 'See #9');
    await userEvent.setup().click(screen.getAllByRole('tab', { name: 'Preview' })[0]);

    fireEvent.click(await within(pane()).findByRole('button', { name: /Map stops panning/ }));

    expect(await screen.findByRole('dialog', { name: /Send Feedback/ })).toBeInTheDocument();
    expect(fetchThread).toHaveBeenCalledWith('9');
    expect(pane()).toHaveTextContent('Map stops panning');
  });

  it('opens a listing chip beside the page rather than swapping the listing under the draft', async () => {
    vi.spyOn(FeedbackService, 'resolveLinks').mockResolvedValue([LISTING]);
    const onOpenListing = vi.fn();
    show({ onOpenListing });
    await screen.findByLabelText('Comment');
    fill('Comment', 'See https://formamorph.ai/community/world/w2');
    await userEvent.setup().click(screen.getAllByRole('tab', { name: 'Preview' })[0]);

    const chip = await within(pane()).findByRole('link', { name: /Brinewell/ });
    expect(chip).toHaveAttribute('target', '_blank');
    fireEvent.click(chip);

    expect(onOpenListing).not.toHaveBeenCalled();
  });
});
