import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FeedbackThreadView } from './FeedbackThreadView';
import FeedbackService from '@/services/FeedbackService';
import AuthService from '@/services/AuthService';
import type { FeedbackComment, FeedbackDetail, FeedbackThread } from '@/types';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

vi.mock('@/components/game/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ text }: { text: string }) => <div>{text}</div>,
}));

// jsdom can't drive a real Lexical selection; the editors are stubbed to textareas so they can be filled.
// Keyed on the aria-label rather than one fixed id — the reply box and an open edit box coexist.
vi.mock('@/components/prompt/PromptField', () => ({
  default: ({ value, onChange, ariaLabel }: { value: string; onChange: (v: string) => void; ariaLabel?: string }) => (
    <textarea aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

const report = (over: Partial<FeedbackThread> = {}): FeedbackThread => ({
  id: 'b1',
  type: 'bug',
  title: 'Save button does nothing',
  category: 'crash',
  body: 'Pressing save just spins.',
  status: 'open',
  reporter: { id: 'u1', username: 'finder' },
  diagnostics: { version: '2.8.0', platform: 'Browser', system: 'Windows · Chrome' },
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  locked: false,
  votes: 0,
  voted: false,
  unread: false,
  ...over,
});

const comment = (over: Partial<FeedbackComment> = {}): FeedbackComment => ({
  id: 'c1',
  body: 'Which version?',
  createdAt: '2026-07-01T01:00:00.000Z',
  editedAt: null,
  author: { id: 'a1', username: 'root-admin', role: 'admin' },
  ...over,
});

const stubThread = (detail: Partial<FeedbackDetail> = {}) =>
  vi.spyOn(FeedbackService, 'fetchThread').mockResolvedValue({
    thread: detail.thread ?? report(),
    comments: detail.comments ?? [],
  });

const setField = (label: string, value: string) => {
  const el = screen.getByLabelText(label) as HTMLTextAreaElement;
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
};

const setReply = (value: string) => setField('Reply', value);

/** Sign in as `id`, so the view can tell whose report and whose comments these are. */
const signedInAs = (id: string) =>
  vi.spyOn(AuthService, 'getCurrentUser').mockReturnValue({ id, username: 'root-admin' });

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the thread', () => {
  it('shows the report and its replies', async () => {
    stubThread({ comments: [comment({ body: 'Looking into it.' })] });

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} />);

    expect(await screen.findByText('Save button does nothing')).toBeTruthy();
    expect(screen.getByText('Looking into it.')).toBeTruthy();
  });

  it('signs a staff reply with their name and a badge, not as the team', async () => {
    // "Formamorph Team" in place of a username hid who was actually speaking, and was derived from the
    // account's *current* type — so a demotion rewrote every reply somebody had ever left.
    stubThread({ comments: [comment()] });

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} />);

    expect(await screen.findByText(/root-admin/)).toBeTruthy();
    expect(screen.getByText('Admin')).toBeTruthy();
    expect(screen.queryByText(/Formamorph Team/)).toBeNull();
  });

  it('badges each staff role apart', async () => {
    stubThread({
      comments: [
        comment({ id: 'c1', author: { id: 'a1', username: 'a-mod', role: 'mod' } }),
        comment({ id: 'c2', author: { id: 'a2', username: 'a-dev', role: 'dev' } }),
      ],
    });

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} />);

    expect(await screen.findByText('Mod')).toBeTruthy();
    expect(screen.getByText('Dev')).toBeTruthy();
  });

  it('signs the reporter’s own reply with their name and no badge', async () => {
    stubThread({ comments: [comment({ author: { id: 'u1', username: 'finder', role: null } })] });

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} />);
    await screen.findByText('Save button does nothing');

    // The report header names the reporter too, and both are now clickable, so there are two.
    expect(screen.getAllByRole('button', { name: "View finder's profile" }).length).toBe(2);
    expect(screen.queryByText('Admin')).toBeNull();
    expect(screen.queryByText('Mod')).toBeNull();
  });

  it('shows what the reporter filed with it', async () => {
    stubThread();

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} />);

    expect(await screen.findByText('Windows · Chrome')).toBeTruthy();
  });

  it('tells the caller it was read, so the badge outside can be re-read', async () => {
    // Reading clears this thread's share of the count on the server; the badge has to catch up.
    stubThread();
    const onChanged = vi.fn();

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} onChanged={onChanged} />);

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('says so when the thread cannot be loaded', async () => {
    vi.spyOn(FeedbackService, 'fetchThread').mockRejectedValue(new Error('offline'));

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} />);

    expect(await screen.findByText(/could not be loaded/)).toBeTruthy();
  });
});

describe('replying', () => {
  beforeEach(() => { signedInAs('u1'); });

  it('appends the reply without refetching the thread', async () => {
    const fetchThread = stubThread();
    vi.spyOn(FeedbackService, 'comment').mockResolvedValue(comment({ id: 'c2', body: 'Version 2.8.0.' }));

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} />);
    await screen.findByText('Save button does nothing');
    setReply('Version 2.8.0.');
    fireEvent.click(screen.getByRole('button', { name: /Send Reply/ }));

    expect(await screen.findByText('Version 2.8.0.')).toBeTruthy();
    expect(fetchThread).toHaveBeenCalledTimes(1);
  });

  it('will not send an empty reply', async () => {
    stubThread();
    const post = vi.spyOn(FeedbackService, 'comment').mockResolvedValue(comment());

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} />);
    await screen.findByText('Save button does nothing');

    expect(screen.getByRole('button', { name: /Send Reply/ }).hasAttribute('disabled')).toBe(true);
    expect(post).not.toHaveBeenCalled();
  });

  it('clears the box once the reply lands', async () => {
    stubThread();
    vi.spyOn(FeedbackService, 'comment').mockResolvedValue(comment({ id: 'c2', body: 'Sent.' }));

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} />);
    await screen.findByText('Save button does nothing');
    setReply('Sent.');
    fireEvent.click(screen.getByRole('button', { name: /Send Reply/ }));

    await waitFor(() =>
      expect((screen.getByLabelText('Reply') as HTMLTextAreaElement).value).toBe(''));
  });
});

describe('reading somebody else’s report', () => {
  it('offers no reply box', async () => {
    // The queue is public to read; the conversation stays between the reporter and the team, and the
    // server refuses the post — an empty box would just be an error waiting to happen.
    signedInAs('onlooker');
    stubThread({ comments: [comment()] });

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} />);
    await screen.findByText('Which version?');

    expect(screen.queryByLabelText('Reply')).toBeNull();
    expect(screen.queryByRole('button', { name: /Send Reply/ })).toBeNull();
    expect(screen.getByText(/Replies are between the reporter and the team/)).toBeTruthy();
  });

  it('still shows the report and its thread', async () => {
    signedInAs('onlooker');
    stubThread({ comments: [comment({ body: 'Looking into it.' })] });

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} />);

    expect(await screen.findByText('Save button does nothing')).toBeTruthy();
    expect(screen.getByText('Looking into it.')).toBeTruthy();
  });

  it('gives the reporter their own box back', async () => {
    signedInAs('u1');
    stubThread();

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} />);
    await screen.findByText('Save button does nothing');

    expect(screen.getByLabelText('Reply')).toBeTruthy();
  });

  it('gives an admin a box on anyone’s', async () => {
    signedInAs('some-admin');
    stubThread();

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} isAdmin />);
    await screen.findByText('Save button does nothing');

    expect(screen.getByLabelText('Reply')).toBeTruthy();
  });
});

describe('changing your own comment', () => {
  const openEditor = async () => {
    fireEvent.click(await screen.findByRole('button', { name: 'Edit comment' }));
    return screen.findByLabelText('Comment text');
  };

  it('offers edit and delete on the reader’s own comment', async () => {
    signedInAs('a1');
    stubThread({ comments: [comment()] });

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} isAdmin />);
    await screen.findByText('Which version?');

    expect(screen.getByRole('button', { name: 'Edit comment' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete comment' })).toBeTruthy();
  });

  it('never offers to edit somebody else’s — an admin included', async () => {
    // Moderation stops short of rewriting what somebody said, and the server refuses it too.
    signedInAs('someone-else');
    stubThread({ comments: [comment()] });

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} isAdmin />);
    await screen.findByText('Which version?');

    expect(screen.queryByRole('button', { name: 'Edit comment' })).toBeNull();
  });

  it('offers an admin the delete on somebody else’s', async () => {
    // The only lever there is when an open thread goes bad.
    signedInAs('someone-else');
    stubThread({ comments: [comment()] });

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} isAdmin />);
    await screen.findByText('Which version?');

    expect(screen.getByRole('button', { name: 'Delete comment' })).toBeTruthy();
  });

  it('offers an ordinary account neither', async () => {
    signedInAs('someone-else');
    stubThread({ comments: [comment()] });

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} />);
    await screen.findByText('Which version?');

    expect(screen.queryByRole('button', { name: 'Edit comment' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete comment' })).toBeNull();
  });

  it('saves a rewrite and shows the new text', async () => {
    signedInAs('a1');
    stubThread({ comments: [comment()] });
    const edit = vi.spyOn(FeedbackService, 'editComment')
      .mockResolvedValue(comment({ body: 'Which app version?', editedAt: '2026-07-02T00:00:00.000Z' }));

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} isAdmin />);
    await screen.findByText('Which version?');
    await openEditor();
    setField('Comment text', 'Which app version?');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(edit).toHaveBeenCalledWith('b1', 'c1', 'Which app version?'));
    expect(await screen.findByText('Which app version?')).toBeTruthy();
    expect(screen.queryByLabelText('Comment text')).toBeNull();
  });

  it('opens the editor on the text as it stands', async () => {
    signedInAs('a1');
    stubThread({ comments: [comment()] });

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} isAdmin />);
    await screen.findByText('Which version?');

    expect(((await openEditor()) as HTMLTextAreaElement).value).toBe('Which version?');
  });

  it('leaves the comment alone when the edit is canceled', async () => {
    signedInAs('a1');
    stubThread({ comments: [comment()] });
    const edit = vi.spyOn(FeedbackService, 'editComment').mockResolvedValue(comment());

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} isAdmin />);
    await screen.findByText('Which version?');
    await openEditor();
    setField('Comment text', 'Never mind.');
    fireEvent.click(screen.getByRole('button', { name: /Cancel/ }));

    expect(edit).not.toHaveBeenCalled();
    expect(screen.getByText('Which version?')).toBeTruthy();
  });

  it('cannot save an empty rewrite', async () => {
    // Blanking the box is not a delete — that has its own button and its own confirm. Save goes disabled
    // rather than sending; `saveEdit`'s own empty check is the backstop behind that.
    signedInAs('a1');
    stubThread({ comments: [comment()] });
    const edit = vi.spyOn(FeedbackService, 'editComment').mockResolvedValue(comment());

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} isAdmin />);
    await screen.findByText('Which version?');
    await openEditor();
    setField('Comment text', '   ');

    expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(edit).not.toHaveBeenCalled();
  });

  it('keeps the editor open when the save fails', async () => {
    // Closing would throw away what they typed with nothing saved.
    signedInAs('a1');
    stubThread({ comments: [comment()] });
    vi.spyOn(FeedbackService, 'editComment').mockRejectedValue(new Error('offline'));

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} isAdmin />);
    await screen.findByText('Which version?');
    await openEditor();
    setField('Comment text', 'Which app version?');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getByLabelText('Comment text')).toBeTruthy());
  });

  it('marks an edited comment as edited', async () => {
    signedInAs('a1');
    stubThread({ comments: [comment({ editedAt: '2026-07-02T00:00:00.000Z' })] });

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} isAdmin />);

    expect(await screen.findByText(/edited/)).toBeTruthy();
  });

  it('says nothing about editing on an untouched comment', async () => {
    signedInAs('a1');
    stubThread({ comments: [comment()] });

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} isAdmin />);
    await screen.findByText('Which version?');

    expect(screen.queryByText(/edited/)).toBeNull();
  });

  it('deletes only after a confirm, and drops it from the thread', async () => {
    signedInAs('a1');
    stubThread({ comments: [comment(), comment({ id: 'c2', body: 'Still broken.' })] });
    const remove = vi.spyOn(FeedbackService, 'removeComment').mockResolvedValue(undefined);

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} isAdmin />);
    await screen.findByText('Which version?');
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete comment' })[0]);

    expect(remove).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith('b1', 'c1'));
    await waitFor(() => expect(screen.queryByText('Which version?')).toBeNull());
    expect(screen.getByText('Still broken.')).toBeTruthy();
  });

  it('keeps the comment when the delete fails', async () => {
    signedInAs('a1');
    stubThread({ comments: [comment()] });
    vi.spyOn(FeedbackService, 'removeComment').mockRejectedValue(new Error('offline'));

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} isAdmin />);
    await screen.findByText('Which version?');
    fireEvent.click(screen.getByRole('button', { name: 'Delete comment' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(screen.getByText('Which version?')).toBeTruthy());
  });
});

describe('triage controls', () => {
  it('are hidden from the reporter', async () => {
    // Moving a report through triage is the team's call, not the reporter's.
    stubThread();

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} />);
    await screen.findByText('Save button does nothing');

    expect(screen.queryByLabelText('Status')).toBeNull();
    expect(screen.queryByLabelText('Delete thread')).toBeNull();
  });

  it('stay hidden for an admin reading from their own profile', async () => {
    // They can answer it there; moving it through triage is a queue action, so it lives in the panel.
    signedInAs('some-admin');
    stubThread();

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} isAdmin />);
    await screen.findByText('Save button does nothing');

    expect(screen.queryByLabelText('Status')).toBeNull();
    expect(screen.queryByLabelText('Delete thread')).toBeNull();
    // The reply box is the point of passing isAdmin there.
    expect(screen.getByLabelText('Reply')).toBeTruthy();
  });

  it('are shown to an admin', async () => {
    stubThread();

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} isAdmin showTriage />);
    await screen.findByText('Save button does nothing');

    expect(screen.getByLabelText('Status')).toBeTruthy();
    expect(screen.getByLabelText('Delete thread')).toBeTruthy();
  });

  it('confirms before deleting, then tells the caller', async () => {
    stubThread();
    const remove = vi.spyOn(FeedbackService, 'remove').mockResolvedValue(undefined);
    const onDeleted = vi.fn();

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} isAdmin showTriage onDeleted={onDeleted} />);
    await screen.findByText('Save button does nothing');
    fireEvent.click(screen.getByLabelText('Delete thread'));

    expect(await screen.findByText(/whole thread go for good/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith('b1'));
    expect(onDeleted).toHaveBeenCalled();
  });

  it('does not delete when the confirmation is declined', async () => {
    stubThread();
    const remove = vi.spyOn(FeedbackService, 'remove').mockResolvedValue(undefined);

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} isAdmin showTriage />);
    await screen.findByText('Save button does nothing');
    fireEvent.click(screen.getByLabelText('Delete thread'));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByText(/whole thread go for good/)).toBeNull());
    expect(remove).not.toHaveBeenCalled();
  });
});

describe('a suggestion thread', () => {
  const suggestion = (over: Partial<FeedbackThread> = {}) =>
    report({ type: 'suggestion', category: 'gameplay', title: 'Let me rename a save', ...over });

  it('lets anyone signed in reply', async () => {
    // Unlike a bug: "I'd want this too, but for characters" is the point of a suggestion board.
    signedInAs('passer-by');
    stubThread({ thread: suggestion() });

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} />);
    await screen.findByText('Let me rename a save');

    expect(screen.getByLabelText('Reply')).toBeTruthy();
  });

  it('offers a vote, and says whether it is the reader’s', async () => {
    signedInAs('passer-by');
    stubThread({ thread: suggestion({ votes: 4, voted: true }) });

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} />);

    const button = await screen.findByRole('button', { name: /Voted/ });
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.textContent).toContain('4');
  });

  it('sends the vote and updates the count', async () => {
    signedInAs('passer-by');
    stubThread({ thread: suggestion({ votes: 4, voted: false }) });
    const setVote = vi.spyOn(FeedbackService, 'setVote')
      .mockResolvedValue(suggestion({ votes: 5, voted: true }));

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: /Vote/ }));

    await waitFor(() => expect(setVote).toHaveBeenCalledWith('b1', true));
    expect(await screen.findByRole('button', { name: /Voted · 5/ })).toBeTruthy();
  });

  it('offers no vote on a bug', async () => {
    signedInAs('u1');
    stubThread();

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} />);
    await screen.findByText('Save button does nothing');

    expect(screen.queryByRole('button', { name: /Vote/ })).toBeNull();
  });
});

describe('a locked thread', () => {
  const locked = (over: Partial<FeedbackThread> = {}) =>
    report({ type: 'suggestion', category: 'gameplay', locked: true, ...over });

  it('takes the reply box away and says why', async () => {
    signedInAs('passer-by');
    stubThread({ thread: locked() });

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} />);
    await screen.findByText('Save button does nothing');

    expect(screen.queryByLabelText('Reply')).toBeNull();
    expect(screen.getByText(/has been locked/)).toBeTruthy();
  });

  it('leaves an admin able to reply', async () => {
    // Locking is a moderation tool, so it never locks out the moderators.
    signedInAs('some-admin');
    stubThread({ thread: locked() });

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} isAdmin />);
    await screen.findByText('Save button does nothing');

    expect(screen.getByLabelText('Reply')).toBeTruthy();
  });

  it('stops its author editing their own comment', async () => {
    signedInAs('a1');
    stubThread({ thread: locked(), comments: [comment()] });

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} />);
    await screen.findByText('Which version?');

    expect(screen.queryByRole('button', { name: 'Edit comment' })).toBeNull();
  });

  it('still lets a vote through', async () => {
    // Closing a discussion doesn't make the idea less wanted.
    signedInAs('passer-by');
    stubThread({ thread: locked({ votes: 2 }) });

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} />);

    expect(await screen.findByRole('button', { name: /Vote/ })).toBeTruthy();
  });

  it('says so on the thread', async () => {
    signedInAs('passer-by');
    stubThread({ thread: locked() });

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} />);

    expect(await screen.findByText('Locked')).toBeTruthy();
  });
});

describe('the lock control', () => {
  it('is offered with the rest of triage', async () => {
    signedInAs('some-admin');
    stubThread();

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} isAdmin showTriage />);

    expect(await screen.findByLabelText('Lock thread')).toBeTruthy();
  });

  it('is absent without triage', async () => {
    signedInAs('some-admin');
    stubThread();

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} isAdmin />);
    await screen.findByText('Save button does nothing');

    expect(screen.queryByLabelText('Lock thread')).toBeNull();
  });

  it('locks, then offers to unlock', async () => {
    signedInAs('some-admin');
    stubThread();
    const setLocked = vi.spyOn(FeedbackService, 'setLocked')
      .mockResolvedValue(report({ locked: true }));

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} isAdmin showTriage />);
    fireEvent.click(await screen.findByLabelText('Lock thread'));

    await waitFor(() => expect(setLocked).toHaveBeenCalledWith('b1', true));
    expect(await screen.findByLabelText('Unlock thread')).toBeTruthy();
  });

  it('offers the statuses of the branch it is on', async () => {
    // A suggestion cannot be 'confirmed' and a bug cannot be 'planned'; the server refuses either.
    signedInAs('some-admin');
    stubThread({ thread: report({ type: 'suggestion', category: 'gameplay', title: 'Let me rename a save', status: 'considering' }) });

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} isAdmin showTriage />);
    await screen.findByText('Let me rename a save');

    // The status badge and the closed Select both render the label; the Select is the one under test.
    expect(screen.getByLabelText('Status').textContent).toContain('Considering');
  });
});

describe('editing the report itself', () => {
  it('offers the reporter an edit control on their own', async () => {
    const AuthService = (await import('@/services/AuthService')).default;
    vi.spyOn(AuthService, 'getCurrentUser').mockReturnValue({ id: 'u1', username: 'finder', accountType: 'normal' });
    stubThread({ thread: report({ reporter: { id: 'u1', username: 'finder' } }) });

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} />);

    expect(await screen.findByLabelText('Edit this report')).toBeTruthy();
  });

  it('offers nothing to a passing reader', async () => {
    // The case that isolates the check: on their own report the control is there for a different reason.
    const AuthService = (await import('@/services/AuthService')).default;
    vi.spyOn(AuthService, 'getCurrentUser').mockReturnValue({ id: 'u9', username: 'stranger', accountType: 'normal' });
    stubThread({ thread: report({ reporter: { id: 'u1', username: 'finder' } }) });

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} />);
    await screen.findByText('Save button does nothing');

    expect(screen.queryByLabelText('Edit this report')).toBeNull();
  });

  it('offers it to the team on a bug', async () => {
    const AuthService = (await import('@/services/AuthService')).default;
    vi.spyOn(AuthService, 'getCurrentUser').mockReturnValue({ id: 'm1', username: 'a-mod', accountType: 'mod' });
    stubThread({ thread: report({ type: 'bug', reporter: { id: 'u1', username: 'finder' } }) });

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} />);

    expect(await screen.findByLabelText('Edit this report')).toBeTruthy();
  });

  it('says when a report has been rewritten', async () => {
    // Somebody may already have read the earlier wording.
    stubThread({ thread: report({ editedAt: '2026-08-02T00:00:00.000Z' }) });

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} />);
    await screen.findByText('Save button does nothing');

    expect(screen.getAllByText(/edited/).length).toBeGreaterThan(0);
  });

  it('says nothing on one that has not been', async () => {
    stubThread();

    render(<FeedbackThreadView threadId="b1" onBack={() => {}} />);
    await screen.findByText('Save button does nothing');

    expect(screen.queryByText(/· edited/)).toBeNull();
  });
});
