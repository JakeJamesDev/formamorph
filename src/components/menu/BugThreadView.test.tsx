import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BugThreadView } from './BugThreadView';
import BugService from '@/services/BugService';
import AuthService from '@/services/AuthService';
import type { BugComment, BugReport, BugThread } from '@/types';

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

const report = (over: Partial<BugReport> = {}): BugReport => ({
  id: 'b1',
  title: 'Save button does nothing',
  category: 'crash',
  body: 'Pressing save just spins.',
  status: 'open',
  reporter: { id: 'u1', username: 'finder' },
  diagnostics: { version: '2.8.0', platform: 'Browser', system: 'Windows · Chrome' },
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  unread: false,
  ...over,
});

const comment = (over: Partial<BugComment> = {}): BugComment => ({
  id: 'c1',
  body: 'Which version?',
  createdAt: '2026-07-01T01:00:00.000Z',
  editedAt: null,
  author: { id: 'a1', username: 'root-admin', isAdmin: true },
  ...over,
});

const stubThread = (thread: Partial<BugThread> = {}) =>
  vi.spyOn(BugService, 'fetchThread').mockResolvedValue({
    report: thread.report ?? report(),
    comments: thread.comments ?? [],
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

    render(<BugThreadView reportId="b1" onBack={() => {}} />);

    expect(await screen.findByText('Save button does nothing')).toBeTruthy();
    expect(screen.getByText('Looking into it.')).toBeTruthy();
  });

  it('signs a team reply as the team, not by username', async () => {
    // The reporter is answered by Formamorph, not by whichever admin happened to pick it up.
    stubThread({ comments: [comment()] });

    render(<BugThreadView reportId="b1" onBack={() => {}} />);

    expect(await screen.findByText(/Formamorph Team/)).toBeTruthy();
    expect(screen.queryByText(/root-admin/)).toBeNull();
  });

  it('signs the reporter’s own reply with their name', async () => {
    stubThread({ comments: [comment({ author: { id: 'u1', username: 'finder', isAdmin: false } })] });

    render(<BugThreadView reportId="b1" onBack={() => {}} />);
    await screen.findByText('Save button does nothing');

    // The report header names the reporter too, so match the comment's own byline.
    expect(screen.getByText(/^finder ·/)).toBeTruthy();
    expect(screen.queryByText(/Formamorph Team/)).toBeNull();
  });

  it('shows what the reporter filed with it', async () => {
    stubThread();

    render(<BugThreadView reportId="b1" onBack={() => {}} />);

    expect(await screen.findByText('Windows · Chrome')).toBeTruthy();
  });

  it('tells the caller it was read, so the badge outside can be re-read', async () => {
    // Reading clears this thread's share of the count on the server; the badge has to catch up.
    stubThread();
    const onChanged = vi.fn();

    render(<BugThreadView reportId="b1" onBack={() => {}} onChanged={onChanged} />);

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('says so when the thread cannot be loaded', async () => {
    vi.spyOn(BugService, 'fetchThread').mockRejectedValue(new Error('offline'));

    render(<BugThreadView reportId="b1" onBack={() => {}} />);

    expect(await screen.findByText(/could not be loaded/)).toBeTruthy();
  });
});

describe('replying', () => {
  beforeEach(() => { signedInAs('u1'); });

  it('appends the reply without refetching the thread', async () => {
    const fetchThread = stubThread();
    vi.spyOn(BugService, 'comment').mockResolvedValue(comment({ id: 'c2', body: 'Version 2.8.0.' }));

    render(<BugThreadView reportId="b1" onBack={() => {}} />);
    await screen.findByText('Save button does nothing');
    setReply('Version 2.8.0.');
    fireEvent.click(screen.getByRole('button', { name: /Send Reply/ }));

    expect(await screen.findByText('Version 2.8.0.')).toBeTruthy();
    expect(fetchThread).toHaveBeenCalledTimes(1);
  });

  it('will not send an empty reply', async () => {
    stubThread();
    const post = vi.spyOn(BugService, 'comment').mockResolvedValue(comment());

    render(<BugThreadView reportId="b1" onBack={() => {}} />);
    await screen.findByText('Save button does nothing');

    expect(screen.getByRole('button', { name: /Send Reply/ }).hasAttribute('disabled')).toBe(true);
    expect(post).not.toHaveBeenCalled();
  });

  it('clears the box once the reply lands', async () => {
    stubThread();
    vi.spyOn(BugService, 'comment').mockResolvedValue(comment({ id: 'c2', body: 'Sent.' }));

    render(<BugThreadView reportId="b1" onBack={() => {}} />);
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

    render(<BugThreadView reportId="b1" onBack={() => {}} />);
    await screen.findByText('Which version?');

    expect(screen.queryByLabelText('Reply')).toBeNull();
    expect(screen.queryByRole('button', { name: /Send Reply/ })).toBeNull();
    expect(screen.getByText(/Replies are between the reporter and the team/)).toBeTruthy();
  });

  it('still shows the report and its thread', async () => {
    signedInAs('onlooker');
    stubThread({ comments: [comment({ body: 'Looking into it.' })] });

    render(<BugThreadView reportId="b1" onBack={() => {}} />);

    expect(await screen.findByText('Save button does nothing')).toBeTruthy();
    expect(screen.getByText('Looking into it.')).toBeTruthy();
  });

  it('gives the reporter their own box back', async () => {
    signedInAs('u1');
    stubThread();

    render(<BugThreadView reportId="b1" onBack={() => {}} />);
    await screen.findByText('Save button does nothing');

    expect(screen.getByLabelText('Reply')).toBeTruthy();
  });

  it('gives an admin a box on anyone’s', async () => {
    signedInAs('some-admin');
    stubThread();

    render(<BugThreadView reportId="b1" onBack={() => {}} isAdmin />);
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

    render(<BugThreadView reportId="b1" onBack={() => {}} isAdmin />);
    await screen.findByText('Which version?');

    expect(screen.getByRole('button', { name: 'Edit comment' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete comment' })).toBeTruthy();
  });

  it('offers neither on somebody else’s — an admin included', async () => {
    // The server refuses it too; showing the buttons would just be an error waiting to happen.
    signedInAs('someone-else');
    stubThread({ comments: [comment()] });

    render(<BugThreadView reportId="b1" onBack={() => {}} isAdmin />);
    await screen.findByText('Which version?');

    expect(screen.queryByRole('button', { name: 'Edit comment' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete comment' })).toBeNull();
  });

  it('saves a rewrite and shows the new text', async () => {
    signedInAs('a1');
    stubThread({ comments: [comment()] });
    const edit = vi.spyOn(BugService, 'editComment')
      .mockResolvedValue(comment({ body: 'Which app version?', editedAt: '2026-07-02T00:00:00.000Z' }));

    render(<BugThreadView reportId="b1" onBack={() => {}} isAdmin />);
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

    render(<BugThreadView reportId="b1" onBack={() => {}} isAdmin />);
    await screen.findByText('Which version?');

    expect(((await openEditor()) as HTMLTextAreaElement).value).toBe('Which version?');
  });

  it('leaves the comment alone when the edit is canceled', async () => {
    signedInAs('a1');
    stubThread({ comments: [comment()] });
    const edit = vi.spyOn(BugService, 'editComment').mockResolvedValue(comment());

    render(<BugThreadView reportId="b1" onBack={() => {}} isAdmin />);
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
    const edit = vi.spyOn(BugService, 'editComment').mockResolvedValue(comment());

    render(<BugThreadView reportId="b1" onBack={() => {}} isAdmin />);
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
    vi.spyOn(BugService, 'editComment').mockRejectedValue(new Error('offline'));

    render(<BugThreadView reportId="b1" onBack={() => {}} isAdmin />);
    await screen.findByText('Which version?');
    await openEditor();
    setField('Comment text', 'Which app version?');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getByLabelText('Comment text')).toBeTruthy());
  });

  it('marks an edited comment as edited', async () => {
    signedInAs('a1');
    stubThread({ comments: [comment({ editedAt: '2026-07-02T00:00:00.000Z' })] });

    render(<BugThreadView reportId="b1" onBack={() => {}} isAdmin />);

    expect(await screen.findByText(/edited/)).toBeTruthy();
  });

  it('says nothing about editing on an untouched comment', async () => {
    signedInAs('a1');
    stubThread({ comments: [comment()] });

    render(<BugThreadView reportId="b1" onBack={() => {}} isAdmin />);
    await screen.findByText('Which version?');

    expect(screen.queryByText(/edited/)).toBeNull();
  });

  it('deletes only after a confirm, and drops it from the thread', async () => {
    signedInAs('a1');
    stubThread({ comments: [comment(), comment({ id: 'c2', body: 'Still broken.' })] });
    const remove = vi.spyOn(BugService, 'removeComment').mockResolvedValue(undefined);

    render(<BugThreadView reportId="b1" onBack={() => {}} isAdmin />);
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
    vi.spyOn(BugService, 'removeComment').mockRejectedValue(new Error('offline'));

    render(<BugThreadView reportId="b1" onBack={() => {}} isAdmin />);
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

    render(<BugThreadView reportId="b1" onBack={() => {}} />);
    await screen.findByText('Save button does nothing');

    expect(screen.queryByLabelText('Status')).toBeNull();
    expect(screen.queryByLabelText('Delete report')).toBeNull();
  });

  it('are shown to an admin', async () => {
    stubThread();

    render(<BugThreadView reportId="b1" onBack={() => {}} isAdmin />);
    await screen.findByText('Save button does nothing');

    expect(screen.getByLabelText('Status')).toBeTruthy();
    expect(screen.getByLabelText('Delete report')).toBeTruthy();
  });

  it('confirms before deleting, then tells the caller', async () => {
    stubThread();
    const remove = vi.spyOn(BugService, 'remove').mockResolvedValue(undefined);
    const onDeleted = vi.fn();

    render(<BugThreadView reportId="b1" onBack={() => {}} isAdmin onDeleted={onDeleted} />);
    await screen.findByText('Save button does nothing');
    fireEvent.click(screen.getByLabelText('Delete report'));

    expect(await screen.findByText(/whole thread go for good/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith('b1'));
    expect(onDeleted).toHaveBeenCalled();
  });

  it('does not delete when the confirmation is declined', async () => {
    stubThread();
    const remove = vi.spyOn(BugService, 'remove').mockResolvedValue(undefined);

    render(<BugThreadView reportId="b1" onBack={() => {}} isAdmin />);
    await screen.findByText('Save button does nothing');
    fireEvent.click(screen.getByLabelText('Delete report'));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByText(/whole thread go for good/)).toBeNull());
    expect(remove).not.toHaveBeenCalled();
  });
});
