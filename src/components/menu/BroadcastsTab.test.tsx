import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BroadcastsTab } from './BroadcastsTab';
import MessageService from '@/services/MessageService';
import type { SentMessage } from '@/types';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

vi.mock('@/components/game/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ text }: { text: string }) => <div data-testid="markdown">{text}</div>,
}));

vi.mock('@/services/AuthService', () => ({
  default: { token: 'test-token', getCurrentUser: () => ({ username: 'root-admin' }) },
}));

const broadcast = (over: Partial<SentMessage> = {}): SentMessage => ({
  id: 'b1',
  subject: 'Server maintenance',
  body: 'Offline briefly.',
  severity: 'info',
  senderAs: 'team',
  senderName: null,
  broadcast: true,
  scope: 'existing',
  createdAt: '2026-07-30 12:00:00',
  editedAt: null,
  recalledAt: null,
  recipient: null,
  readCount: 2,
  eligibleCount: 5,
  ...over,
});

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('listing', () => {
  it('asks only for broadcasts', async () => {
    // Direct messages belong to the Users tab; listing them here would double-report them.
    const fetchSent = vi.spyOn(MessageService, 'fetchSent').mockResolvedValue({ messages: [], total: 0 });

    render(<BroadcastsTab active />);

    await waitFor(() => expect(fetchSent).toHaveBeenCalled());
    expect(fetchSent.mock.calls[0][0]).toMatchObject({ audience: 'broadcast' });
    expect(fetchSent.mock.calls[0][0]?.userId).toBeUndefined();
  });

  it('does not fetch while the tab is hidden', () => {
    const fetchSent = vi.spyOn(MessageService, 'fetchSent').mockResolvedValue({ messages: [], total: 0 });

    render(<BroadcastsTab active={false} />);

    expect(fetchSent).not.toHaveBeenCalled();
  });

  it('shows its own empty state', async () => {
    vi.spyOn(MessageService, 'fetchSent').mockResolvedValue({ messages: [], total: 0 });

    render(<BroadcastsTab active />);

    expect(await screen.findByText('No broadcasts sent yet.')).toBeTruthy();
  });

  it('reports read progress against the eligible audience', async () => {
    vi.spyOn(MessageService, 'fetchSent').mockResolvedValue({ messages: [broadcast()], total: 1 });

    render(<BroadcastsTab active />);

    expect(await screen.findByText('Read by 2 of 5')).toBeTruthy();
  });

  it('marks a pinned broadcast', async () => {
    vi.spyOn(MessageService, 'fetchSent').mockResolvedValue({
      messages: [broadcast({ scope: 'pinned' })],
      total: 1,
    });

    render(<BroadcastsTab active />);

    expect(await screen.findByLabelText('Pinned')).toBeTruthy();
  });
});

describe('composing', () => {
  it('opens a broadcast composer, never a direct one', async () => {
    vi.spyOn(MessageService, 'fetchSent').mockResolvedValue({ messages: [], total: 0 });

    render(<BroadcastsTab active />);
    fireEvent.click(await screen.findByRole('button', { name: /New Broadcast/ }));

    // The broadcast composer is the only one that offers pinning.
    expect(await screen.findByText('Broadcast to All Users')).toBeTruthy();
    expect(screen.getByText('Pinned')).toBeTruthy();
  });
});

describe('recall', () => {
  it('warns that a recall clears every inbox', async () => {
    vi.spyOn(MessageService, 'fetchSent').mockResolvedValue({ messages: [broadcast()], total: 1 });

    render(<BroadcastsTab active />);
    fireEvent.click(await screen.findByRole('button', { name: 'Recall' }));

    expect(await screen.findByText(/disappear from every inbox/)).toBeTruthy();
  });

  it('recalls the broadcast once confirmed', async () => {
    vi.spyOn(MessageService, 'fetchSent').mockResolvedValue({ messages: [broadcast()], total: 1 });
    const recall = vi.spyOn(MessageService, 'recall').mockResolvedValue();

    render(<BroadcastsTab active />);
    fireEvent.click(await screen.findByRole('button', { name: 'Recall' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(recall).toHaveBeenCalledWith('b1'));
  });
});

describe('editing', () => {
  const openEditor = async () => {
    vi.spyOn(MessageService, 'fetchSent').mockResolvedValue({
      messages: [broadcast({ subject: 'Original', body: 'First draft.', scope: 'new' })],
      total: 1,
    });

    render(<BroadcastsTab active />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    return await screen.findByText('Edit Message');
  };

  it('opens the form prefilled with the stored message', async () => {
    await openEditor();

    expect((document.getElementById('messageSubject') as HTMLInputElement).value).toBe('Original');
    expect((document.getElementById('messageBody') as HTMLTextAreaElement).value).toBe('First draft.');
  });

  it('saves through the edit endpoint, not as a new send', async () => {
    // Sending instead would leave the original in place and duplicate it for every reader.
    const edit = vi.spyOn(MessageService, 'edit').mockResolvedValue(broadcast());
    const send = vi.spyOn(MessageService, 'send').mockResolvedValue([]);
    await openEditor();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(edit).toHaveBeenCalled());
    expect(edit.mock.calls[0][0]).toBe('b1');
    expect(send).not.toHaveBeenCalled();
  });

  it('carries the stored scope through unchanged', async () => {
    const edit = vi.spyOn(MessageService, 'edit').mockResolvedValue(broadcast());
    await openEditor();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(edit).toHaveBeenCalled());
    expect(edit.mock.calls[0][1]).toMatchObject({ scope: 'new' });
  });

  it('does not re-notify unless asked', async () => {
    // Most edits are typo fixes; re-badging everyone for one would be noise.
    const edit = vi.spyOn(MessageService, 'edit').mockResolvedValue(broadcast());
    await openEditor();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(edit).toHaveBeenCalled());
    expect(edit.mock.calls[0][1].renotify).toBe(false);
  });

  it('re-notifies when the box is ticked', async () => {
    const edit = vi.spyOn(MessageService, 'edit').mockResolvedValue(broadcast());
    await openEditor();

    fireEvent.click(screen.getByText('Mark unread again'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(edit).toHaveBeenCalled());
    expect(edit.mock.calls[0][1].renotify).toBe(true);
  });

  it('offers no re-notify control when composing a new broadcast', async () => {
    vi.spyOn(MessageService, 'fetchSent').mockResolvedValue({ messages: [], total: 0 });

    render(<BroadcastsTab active />);
    fireEvent.click(await screen.findByRole('button', { name: /New Broadcast/ }));
    await screen.findByText('Broadcast to All Users');

    expect(screen.queryByText('Mark unread again')).toBeNull();
  });

  it('hides both actions on a recalled broadcast', async () => {
    // Recall is final on the server, so offering Edit would only produce a 409.
    vi.spyOn(MessageService, 'fetchSent').mockResolvedValue({
      messages: [broadcast({ recalledAt: '2026-07-31T09:00:00Z' })],
      total: 1,
    });

    render(<BroadcastsTab active />);
    await screen.findByText('Server maintenance');

    // Exact names, not /Recall/: the row's own accessible name ends in "· Recalled", which a loose
    // regex matches — the assertion would pass against the wrong element either way.
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Recall' })).toBeNull();
  });
});
