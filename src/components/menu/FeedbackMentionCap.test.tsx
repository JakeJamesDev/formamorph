import type { ReactElement } from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { toast } from 'react-toastify';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FeedbackDialog } from './FeedbackDialog';
import { FeedbackEditDialog } from './FeedbackEditDialog';
import { FeedbackThreadView } from './FeedbackThreadView';
import FeedbackService from '@/services/FeedbackService';
import AuthService from '@/services/AuthService';
import { toastFeedbackNotify } from '@/lib/feedbackToast';
import type { FeedbackComment, FeedbackThread } from '@/types';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

// jsdom can't drive a real Lexical selection; the editors are textareas here.
vi.mock('@/components/prompt/PromptField', () => ({
  default: ({ value, onChange, ariaLabel }: { value: string; onChange: (v: string) => void; ariaLabel?: string }) => (
    <textarea id="feedbackBody" aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

const CAP = 'A post can mention at most 5 players.';
const TEXT = '@aaa @bbb @ccc @ddd @eee @fff';

const thread: FeedbackThread = {
  id: 't1', number: 4, type: 'suggestion', title: 'Pin a stat', category: 'interface', body: 'Pin it.', status: 'open',
  reporter: { id: 'u1', username: 'morgan' }, diagnostics: {}, createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z', locked: false, votes: 0, voted: false, unread: false,
};
const mine: FeedbackComment = {
  id: 'c1', body: 'First.', createdAt: '2026-07-01T01:00:00.000Z', editedAt: null, author: { id: 'u1', username: 'morgan' },
};

const setValue = (el: HTMLElement, value: string) => {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
};

/** The server's refusal, through the real service, so the message travels the way it does in the app. */
const refuseWrites = () => vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
  new Response(JSON.stringify({ error: CAP }), { status: 400 }),
));

/** What the reader sees in the error toast. */
const toastedText = async () => {
  await waitFor(() => expect(toast.error).toHaveBeenCalled());
  const node = vi.mocked(toast.error).mock.calls.at(-1)?.[0] as ReactElement;
  return render(node).container.textContent;
};

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(AuthService, 'getCurrentUser').mockReturnValue({ id: 'u1', username: 'morgan' });
  vi.spyOn(FeedbackService, 'fetchThread').mockResolvedValue({ thread, comments: [mine] });
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('a post refused for the mention cap', () => {
  it('shows the server message on a reply and keeps the typed text', async () => {
    refuseWrites();
    render(<FeedbackThreadView notify={toastFeedbackNotify} threadId="t1" onBack={() => {}} />);
    await screen.findByText('Pin it.');

    setValue(screen.getByLabelText('Reply'), TEXT);
    fireEvent.click(screen.getByRole('button', { name: /Send Reply/ }));

    expect(await toastedText()).toContain(CAP);
    expect((screen.getByLabelText('Reply') as HTMLTextAreaElement).value).toBe(TEXT);
  });

  it('shows the server message on a rewritten comment and keeps the typed text', async () => {
    refuseWrites();
    render(<FeedbackThreadView notify={toastFeedbackNotify} threadId="t1" onBack={() => {}} />);
    await screen.findByText('First.');

    fireEvent.click(await screen.findByRole('button', { name: 'Edit comment' }));
    setValue(await screen.findByLabelText('Comment text'), TEXT);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await toastedText()).toContain(CAP);
    expect((screen.getByLabelText('Comment text') as HTMLTextAreaElement).value).toBe(TEXT);
  });

  it('shows the server message on a new thread and keeps the typed text', async () => {
    refuseWrites();
    render(<FeedbackDialog notify={toastFeedbackNotify} open onOpenChange={() => {}} initialType="suggestion" />);

    setValue(document.getElementById('feedbackTitle')!, 'Pin a stat');
    setValue(document.getElementById('feedbackBody')!, TEXT);
    fireEvent.click(screen.getByRole('button', { name: /Send Suggestion/ }));

    expect(await toastedText()).toContain(CAP);
    expect((document.getElementById('feedbackBody') as HTMLTextAreaElement).value).toBe(TEXT);
  });

  it('shows the server message on a rewritten thread and keeps the typed text', async () => {
    refuseWrites();
    render(
      <FeedbackEditDialog
        notify={toastFeedbackNotify} open onOpenChange={() => {}} thread={thread} mayEditProse mayRefile={false} threadSearchTypes={null}
        onSaved={() => {}}
      />,
    );

    setValue(screen.getByLabelText('Description'), TEXT);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await toastedText()).toContain(CAP);
    expect((screen.getByLabelText('Description') as HTMLTextAreaElement).value).toBe(TEXT);
  });
});
