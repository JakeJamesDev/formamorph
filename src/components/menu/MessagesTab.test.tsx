import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MessagesTab } from './MessagesTab';
import MessageService from '@/services/MessageService';
import type { InboxMessage } from '@/types';

// Streamdown pulls in ESM-only syntax highlighting that jsdom has no use for; the tab only needs to prove
// it hands the body through.
vi.mock('@/components/game/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ text }: { text: string }) => <div data-testid="markdown">{text}</div>,
}));

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

const message = (over: Partial<InboxMessage> = {}): InboxMessage => ({
  id: 'm1',
  subject: 'A notice',
  body: 'The **body**.',
  severity: 'info',
  senderAs: 'team',
  senderName: null,
  broadcast: false,
  scope: 'existing',
  createdAt: '2026-07-30 12:00:00',
  editedAt: null,
  readAt: null,
  ...over,
});

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const stubInbox = (messages: InboxMessage[]) =>
  vi.spyOn(MessageService, 'fetchInbox').mockResolvedValue({
    messages,
    total: messages.length,
    unread: messages.filter((m) => !m.readAt).length,
  });

describe('loading', () => {
  it('does not fetch while inactive', () => {
    const fetchInbox = stubInbox([]);

    render(<MessagesTab active={false} />);

    expect(fetchInbox).not.toHaveBeenCalled();
  });

  it('shows the empty state when there is nothing to read', async () => {
    stubInbox([]);

    render(<MessagesTab active />);

    expect(await screen.findByText('No messages.')).toBeTruthy();
  });

  it('reports the unread count to its parent on load', async () => {
    stubInbox([message(), message({ id: 'm2', readAt: '2026-07-30T13:00:00Z' })]);
    const onUnreadChange = vi.fn();

    render(<MessagesTab active onUnreadChange={onUnreadChange} />);

    await waitFor(() => expect(onUnreadChange).toHaveBeenCalledWith(1));
  });

  it('shows the failure inline rather than as a toast', async () => {
    // The community server being unreachable is the common case; a toast would fire on every open.
    vi.spyOn(MessageService, 'fetchInbox').mockRejectedValue(new Error('Server unreachable'));

    render(<MessagesTab active />);

    expect(await screen.findByText('Server unreachable')).toBeTruthy();
  });
});

describe('reading a message', () => {
  it('marks it read on first open and drops the unread count', async () => {
    stubInbox([message()]);
    const markRead = vi.spyOn(MessageService, 'markRead').mockResolvedValue();
    const onUnreadChange = vi.fn();

    render(<MessagesTab active onUnreadChange={onUnreadChange} />);
    fireEvent.click(await screen.findByText('A notice'));

    await waitFor(() => expect(markRead).toHaveBeenCalledWith('m1'));
    await waitFor(() => expect(onUnreadChange).toHaveBeenLastCalledWith(0));
  });

  it('does not re-mark an already-read message', async () => {
    stubInbox([message({ readAt: '2026-07-30T13:00:00Z' })]);
    const markRead = vi.spyOn(MessageService, 'markRead').mockResolvedValue();

    render(<MessagesTab active />);
    fireEvent.click(await screen.findByText('A notice'));

    await waitFor(() => expect(screen.getByTestId('markdown')).toBeTruthy());
    expect(markRead).not.toHaveBeenCalled();
  });

  it('reveals the body only once opened', async () => {
    stubInbox([message()]);
    vi.spyOn(MessageService, 'markRead').mockResolvedValue();

    render(<MessagesTab active />);
    await screen.findByText('A notice');
    expect(screen.queryByTestId('markdown')).toBeNull();

    fireEvent.click(screen.getByText('A notice'));
    expect(await screen.findByTestId('markdown')).toBeTruthy();
  });

  it('leaves the message unread when the server rejects the mark', async () => {
    // Otherwise the badge clears locally while the server still counts it, and a reload resurrects it.
    stubInbox([message()]);
    vi.spyOn(MessageService, 'markRead').mockRejectedValue(new Error('nope'));
    const onUnreadChange = vi.fn();

    render(<MessagesTab active onUnreadChange={onUnreadChange} />);
    fireEvent.click(await screen.findByText('A notice'));

    await waitFor(() => expect(console.error).toHaveBeenCalled());
    expect(onUnreadChange).not.toHaveBeenCalledWith(0);
  });
});

describe('sender attribution', () => {
  it('shows the generic signature for a team message', async () => {
    stubInbox([message({ senderAs: 'team', senderName: null })]);

    render(<MessagesTab active />);

    expect(await screen.findByText('Formamorph Team')).toBeTruthy();
  });

  it('names the admin when the message is signed that way', async () => {
    stubInbox([message({ senderAs: 'username', senderName: 'root-admin' })]);

    render(<MessagesTab active />);

    expect(await screen.findByText('root-admin')).toBeTruthy();
  });
});

describe('dismissal', () => {
  it('removes the message and updates the count', async () => {
    stubInbox([message()]);
    const dismiss = vi.spyOn(MessageService, 'dismiss').mockResolvedValue();
    const onUnreadChange = vi.fn();

    render(<MessagesTab active onUnreadChange={onUnreadChange} />);
    fireEvent.click(await screen.findByLabelText('Dismiss A notice'));

    await waitFor(() => expect(dismiss).toHaveBeenCalledWith('m1'));
    await waitFor(() => expect(screen.queryByText('A notice')).toBeNull());
    expect(onUnreadChange).toHaveBeenLastCalledWith(0);
  });

  it('keeps the message listed when the server rejects the dismissal', async () => {
    stubInbox([message()]);
    vi.spyOn(MessageService, 'dismiss').mockRejectedValue(new Error('nope'));

    render(<MessagesTab active />);
    fireEvent.click(await screen.findByLabelText('Dismiss A notice'));

    await waitFor(() => expect(screen.getByText('A notice')).toBeTruthy());
  });
});

describe('pinned messages', () => {
  it('offers no dismiss button', async () => {
    // The server refuses the dismiss; showing a control that always fails would read as broken.
    stubInbox([message({ scope: 'pinned' })]);

    render(<MessagesTab active />);
    await screen.findByText('A notice');

    expect(screen.queryByLabelText('Dismiss A notice')).toBeNull();
  });

  it('marks itself as kept by an administrator', async () => {
    stubInbox([message({ scope: 'pinned' })]);

    render(<MessagesTab active />);

    expect(await screen.findByLabelText('Pinned by an administrator')).toBeTruthy();
  });

  it('still lets the reader open and clear the unread badge', async () => {
    // Permanent must not mean a badge that never goes away.
    stubInbox([message({ scope: 'pinned' })]);
    const markRead = vi.spyOn(MessageService, 'markRead').mockResolvedValue();
    const onUnreadChange = vi.fn();

    render(<MessagesTab active onUnreadChange={onUnreadChange} />);
    fireEvent.click(await screen.findByText('A notice'));

    await waitFor(() => expect(markRead).toHaveBeenCalledWith('m1'));
    await waitFor(() => expect(onUnreadChange).toHaveBeenLastCalledWith(0));
  });

  it('keeps the dismiss button on an unpinned message', async () => {
    stubInbox([message({ scope: 'new' })]);

    render(<MessagesTab active />);

    expect(await screen.findByLabelText('Dismiss A notice')).toBeTruthy();
  });
});

describe('edited messages', () => {
  it('says when it was rewritten', async () => {
    // A reader may have read the earlier text, so the change has to be visible.
    stubInbox([message({ editedAt: '2026-07-31 09:00:00' })]);

    render(<MessagesTab active />);

    expect(await screen.findByText(/Edited/)).toBeTruthy();
  });

  it('says nothing on a message that was never edited', async () => {
    stubInbox([message({ editedAt: null })]);

    render(<MessagesTab active />);
    await screen.findByText('A notice');

    expect(screen.queryByText(/Edited/)).toBeNull();
  });
});
