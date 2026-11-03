// Must load before the service singleton, whose constructor opens IndexedDB.
import 'fake-indexeddb/auto';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RemoteWorldDetailsModal } from './RemoteWorldDetailsModal';
import { FeedbackHost } from '@/components/FeedbackHost';
import { type WorldRecord } from '@/components/WorldDetails';
import { closeFeedback, openFeedback } from '@/lib/feedbackOpener';
import { loadFeedbackDraft, saveFeedbackDraft } from '@/lib/feedbackDraft';
import AuthService from '@/services/AuthService';
import FeedbackService from '@/services/FeedbackService';
import WorldStorageService from '@/services/WorldStorageService';
import type { FeedbackDetail, FeedbackLinkTarget } from '@/types';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/useCachedThumbnail', () => ({ useCachedThumbnail: () => ({ src: '' }) }));

// jsdom can't drive a real Lexical selection; the editors are textareas here.
vi.mock('@/components/prompt/PromptField', () => ({
  default: ({ value, onChange, ariaLabel, placeholder }: {
    value: string; onChange: (v: string) => void; ariaLabel?: string; placeholder?: string;
  }) => (
    <textarea aria-label={ariaLabel} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

const SUGGESTION: FeedbackLinkTarget = { kind: 'thread', ref: '7', available: true, number: 7, title: 'Pin a stat to the panel', type: 'suggestion', status: 'planned' };
const QUESTION: FeedbackLinkTarget = { kind: 'thread', ref: '8', available: true, number: 8, title: 'Where do saves live', type: 'question', status: 'open' };
const BUG: FeedbackLinkTarget = { kind: 'thread', ref: '9', available: true, number: 9, title: 'Map stops panning', type: 'bug', status: 'confirmed' };

const world = { id: 'w1', name: 'Sedge Landing', description: '', kind: 'world', author: { id: 'author-1', username: 'wren_hallow' }, tags: [], downloads: 0, comment_count: 1, likes: 0 } as unknown as WorldRecord;

const detailFor = (target: Extract<FeedbackLinkTarget, { kind: 'thread' }>): FeedbackDetail => ({
  thread: {
    id: `uuid-${target.number}`, number: target.number, type: target.type, title: target.title, category: 'interface',
    body: 'Thread body.', status: target.status, reporter: { id: 'u2', username: 'rowan' }, diagnostics: {},
    createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-01T00:00:00.000Z', locked: false,
  },
  comments: [],
} as unknown as FeedbackDetail);

const serve = (...targets: Extract<FeedbackLinkTarget, { kind: 'thread' }>[]) => {
  vi.spyOn(WorldStorageService, 'fetchComments').mockResolvedValue({
    success: true,
    data: [{
      id: 'c1', content: 'See #7, #8 and #9.', targets,
      created_at: '2026-08-01T00:00:00.000Z', edited_at: null,
      author: { id: 'commenter-1', username: 'saltmarsh', role: null },
    }],
    pagination: {}, total: 1,
  });
  vi.spyOn(FeedbackService, 'fetchThread').mockImplementation(async (id) => {
    const found = targets.find((t) => String(t.number) === id);
    if (!found) throw new Error('Not found');
    return detailFor(found);
  });
};

const onOpenChange = vi.fn();

const show = () =>
  render(
    <>
      <RemoteWorldDetailsModal
        open
        onOpenChange={onOpenChange}
        world={world}
        collapsed={false}
        onToggleCollapsed={() => {}}
        isAuthenticated
        openImageViewer={() => {}}
        downloadStateForWorld={() => 'none'}
        downloadProgress={{}}
        onContextualDownload={() => {}}
        currentUser={{ id: 'commenter-1', username: 'saltmarsh', accountType: 'normal' } as unknown as WorldRecord}
      />
      <FeedbackHost />
    </>,
  );

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(AuthService, 'getCurrentUser').mockReturnValue({ id: 'u1', username: 'morgan' } as never);
});

afterEach(() => {
  closeFeedback();
  cleanup();
  vi.restoreAllMocks();
});

describe('a thread chip in a listing comment, in the app', () => {
  it.each([
    ['suggestion', SUGGESTION, /Pin a stat to the panel/],
    ['question', QUESTION, /Where do saves live/],
    ['bug', BUG, /Map stops panning/],
  ])('opens a %s thread in the Feedback dialog on a plain click', async (_name, target, chip) => {
    const user = userEvent.setup();
    serve(SUGGESTION, QUESTION, BUG);
    show();

    // A bug has no address, so its chip is a button.
    await user.click(await screen.findByRole(target.type === 'bug' ? 'button' : 'link', { name: chip }));

    const dialog = await screen.findByRole('dialog', { name: /Send Feedback/ });
    expect(await screen.findByText('Thread body.')).toBeInTheDocument();
    expect(dialog).toHaveTextContent(target.title);
    expect(FeedbackService.fetchThread).toHaveBeenCalledWith(String(target.number));
  });

  it('leaves the listing open on Back and returns focus to the chip', async () => {
    const user = userEvent.setup();
    serve(SUGGESTION);
    show();
    const chip = await screen.findByRole('link', { name: /Pin a stat to the panel/ });

    await user.click(chip);
    await screen.findByText('Thread body.');
    await user.click(screen.getByRole('button', { name: /Back/ }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Send Feedback/ })).not.toBeInTheDocument());
    expect(screen.getByRole('dialog', { name: /Sedge Landing/ })).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
    await waitFor(() => expect(chip).toHaveFocus());
  });

  it('closes only the Feedback dialog on Escape', async () => {
    const user = userEvent.setup();
    serve(SUGGESTION);
    show();

    await user.click(await screen.findByRole('link', { name: /Pin a stat to the panel/ }));
    await screen.findByText('Thread body.');
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Send Feedback/ })).not.toBeInTheDocument());
    expect(screen.getByRole('dialog', { name: /Sedge Landing/ })).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('leaves a modified click to the browser', async () => {
    const user = userEvent.setup();
    serve(SUGGESTION);
    show();
    const chip = await screen.findByRole('link', { name: /Pin a stat to the panel/ });
    const prevented = vi.fn();
    const watch = (event: Event) => { prevented(event.defaultPrevented); event.preventDefault(); };
    window.addEventListener('click', watch);

    await user.keyboard('{Control>}');
    await user.click(chip);
    await user.keyboard('{/Control}');
    window.removeEventListener('click', watch);

    expect(prevented).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole('dialog', { name: /Send Feedback/ })).not.toBeInTheDocument();
  });

  it('keeps an unsent draft through a chip open, and shows it the next time the form opens', async () => {
    const user = userEvent.setup();
    saveFeedbackDraft({ type: 'suggestion', title: 'Half written idea', category: 'interface', body: 'More later' } as never);
    serve(SUGGESTION);
    show();

    await user.click(await screen.findByRole('link', { name: /Pin a stat to the panel/ }));
    await screen.findByText('Thread body.');
    await user.click(screen.getByRole('button', { name: /Back/ }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Send Feedback/ })).not.toBeInTheDocument());

    expect(loadFeedbackDraft()).toMatchObject({ title: 'Half written idea', body: 'More later' });

    openFeedback('suggestion', null);
    expect(await screen.findByDisplayValue('Half written idea')).toBeInTheDocument();
  });
});
