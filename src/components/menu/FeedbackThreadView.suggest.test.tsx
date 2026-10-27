import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FeedbackThreadView } from './FeedbackThreadView';
import FeedbackService from '@/services/FeedbackService';
import AuthService from '@/services/AuthService';
import { APP_FEEDBACK_CAPABILITIES, WEBSITE_FEEDBACK_CAPABILITIES, type FeedbackCapabilities } from '@/lib/feedbackCapabilities';
import { toastFeedbackNotify } from '@/lib/feedbackToast';
import type { FeedbackThread } from '@/types';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

const thread: FeedbackThread = {
  id: 'uuid-1', number: 1, type: 'suggestion', title: 'Darker map tiles', category: 'interface', body: 'Plain text.',
  status: 'open', reporter: { id: 'u2', username: 'rowan' }, diagnostics: {}, createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z', locked: false, votes: 0, voted: false, unread: false,
};

beforeEach(() => {
  vi.spyOn(AuthService, 'getCurrentUser').mockReturnValue({ id: 'u1', username: 'morgan' });
  // The reader's own comment, so its edit box opens with text: jsdom gives an empty editor no caret.
  vi.spyOn(FeedbackService, 'fetchThread').mockResolvedValue({ thread, comments: [{
    id: 'c1', body: ' my reply', createdAt: '2026-07-01T01:00:00.000Z', editedAt: null, author: { id: 'u1', username: 'morgan' },
  }] });
});

afterEach(() => vi.restoreAllMocks());

/** Type at the head of a comment being edited: jsdom has no layout, so a click puts the caret at the start. */
async function typeInComment(capabilities: FeedbackCapabilities, text: string) {
  render(<FeedbackThreadView threadId="uuid-1" onBack={() => {}} notify={toastFeedbackNotify} capabilities={capabilities} />);
  const u = userEvent.setup();
  await u.click(await screen.findByRole('button', { name: 'Edit comment' }));
  await u.click(await screen.findByLabelText('Comment text'));
  await u.keyboard(text);
}

describe('comment suggestions', () => {
  it('searches only the Votable boards on the website', async () => {
    const search = vi.spyOn(FeedbackService, 'searchThreads').mockResolvedValue([]);
    await typeInComment(WEBSITE_FEEDBACK_CAPABILITIES, '#da');
    await waitFor(() => expect(search).toHaveBeenCalledWith('da', ['suggestion', 'question'], expect.any(AbortSignal)));
  });

  it('searches every board in the app', async () => {
    const search = vi.spyOn(FeedbackService, 'searchThreads').mockResolvedValue([]);
    await typeInComment(APP_FEEDBACK_CAPABILITIES, '#da');
    await waitFor(() => expect(search).toHaveBeenCalledWith('da', null, expect.any(AbortSignal)));
  });

  it('ranks people by the thread the comment is in', async () => {
    const search = vi.spyOn(FeedbackService, 'searchUsers').mockResolvedValue([]);
    await typeInComment(APP_FEEDBACK_CAPABILITIES, '@ro');
    await waitFor(() => expect(search).toHaveBeenCalledWith('ro', 'uuid-1', expect.any(AbortSignal)));
  });
});
