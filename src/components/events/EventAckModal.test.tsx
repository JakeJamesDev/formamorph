import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventAckModal } from './EventAckModal';
import MessageService from '@/services/MessageService';
import { isEventAcknowledged, markEventAcknowledged } from '@/lib/eventSeenStore';
import { daysFrom, serverEvent } from '@/test/serverEvents';
import type { ServerEvent } from '@/types';

const event = (over: Partial<ServerEvent> = {}): ServerEvent =>
  serverEvent({ body: 'Enter by publishing a world with the contest switch on.', ...over });

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe('EventAckModal', () => {
  it('renders nothing when nothing is running', () => {
    render(<EventAckModal events={[]} isAuthenticated />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('posts what just started, with its window and body', () => {
    render(<EventAckModal events={[event()]} isAuthenticated={false} />);

    expect(screen.getByText('A Contest Has Started')).toBeInTheDocument();
    expect(screen.getByText('Winter World-Building Contest')).toBeInTheDocument();
    expect(screen.getByText(/Enter by publishing a world/)).toBeInTheDocument();
  });

  it('closes only by being acknowledged — no Escape, no X to scroll past it with', () => {
    render(<EventAckModal events={[event()]} isAuthenticated={false} />);
    const dialog = screen.getByRole('dialog');

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Got It' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('remembers the acknowledgment on this device, keyed to the phase', () => {
    render(<EventAckModal events={[event()]} isAuthenticated={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Got It' }));

    expect(isEventAcknowledged('e1', 'start')).toBe(true);
    expect(isEventAcknowledged('e1', 'end')).toBe(false);
  });

  it('does not re-post a phase this device already acknowledged', () => {
    markEventAcknowledged('e1', 'start');
    render(<EventAckModal events={[event()]} isAuthenticated />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('marks the linked broadcast read when signed in, so the inbox badge agrees', async () => {
    const markRead = vi.spyOn(MessageService, 'markRead').mockResolvedValue();
    render(<EventAckModal events={[event()]} isAuthenticated />);

    fireEvent.click(screen.getByRole('button', { name: 'Got It' }));

    await waitFor(() => expect(markRead).toHaveBeenCalledWith('m-start'));
  });

  it('acknowledges signed out without reaching the server', () => {
    const markRead = vi.spyOn(MessageService, 'markRead').mockResolvedValue();
    render(<EventAckModal events={[event()]} isAuthenticated={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Got It' }));

    expect(markRead).not.toHaveBeenCalled();
    expect(isEventAcknowledged('e1', 'start')).toBe(true);
  });

  it('still acknowledges when marking the broadcast read fails', async () => {
    const markRead = vi.spyOn(MessageService, 'markRead').mockRejectedValue(new Error('offline'));
    render(<EventAckModal events={[event()]} isAuthenticated />);

    fireEvent.click(screen.getByRole('button', { name: 'Got It' }));

    await waitFor(() => expect(markRead).toHaveBeenCalled());
    expect(isEventAcknowledged('e1', 'start')).toBe(true);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('posts the ending separately, naming the winner and marking that broadcast read', async () => {
    const markRead = vi.spyOn(MessageService, 'markRead').mockResolvedValue();
    markEventAcknowledged('e1', 'start');
    const ended = event({ winnerName: 'The Long Thaw', winnerAuthorName: 'sedgewright', winnerMessageId: 'm-win' });

    render(<EventAckModal events={[ended]} isAuthenticated />);

    expect(screen.getByText('Winner Announced')).toBeInTheDocument();
    expect(screen.getByText(/The Long Thaw/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Got It' }));
    await waitFor(() => expect(markRead).toHaveBeenCalledWith('m-win'));
  });

  it('posts that judging has begun for a contest closed with no winner yet', async () => {
    const markRead = vi.spyOn(MessageService, 'markRead').mockResolvedValue();
    // The one a player who launched the app after the deadline gets: closed, undecided, unacknowledged.
    const closed = event({ startsAt: daysFrom(-20), endsAt: daysFrom(-1), endMessageId: 'm-end' });

    render(<EventAckModal events={[closed]} isAuthenticated onOpenEvent={vi.fn()} />);

    expect(screen.getByText('This Event Has Ended')).toBeInTheDocument();
    // Not "See The Winner": there isn't one yet, and the entries are what there is to look at.
    expect(screen.getByRole('button', { name: 'View Entries' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Got It' }));
    await waitFor(() => expect(markRead).toHaveBeenCalledWith('m-end'));
  });

  it('stays acknowledged for a judging contest already answered on this device', () => {
    markEventAcknowledged('e1', 'end');
    const closed = event({ startsAt: daysFrom(-20), endsAt: daysFrom(-1) });

    render(<EventAckModal events={[closed]} isAuthenticated />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('takes the player to the entries, acknowledging on the way', () => {
    const onOpenEvent = vi.fn();
    render(<EventAckModal events={[event()]} isAuthenticated={false} onOpenEvent={onOpenEvent} />);

    fireEvent.click(screen.getByRole('button', { name: 'View Entries' }));

    expect(onOpenEvent).toHaveBeenCalledWith(expect.objectContaining({ id: 'e1' }));
    expect(isEventAcknowledged('e1', 'start')).toBe(true);
  });

  it('shows the next unacknowledged event once the first is answered', () => {
    const second = event({ id: 'e2', type: 'announcement', title: 'Server Maintenance' });
    render(<EventAckModal events={[event(), second]} isAuthenticated={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Got It' }));

    expect(screen.getByText('An Announcement')).toBeInTheDocument();
    expect(screen.getByText('Server Maintenance')).toBeInTheDocument();
  });

  it('renders an unknown type as a plain announcement, with nowhere to be sent', () => {
    render(<EventAckModal events={[event({ type: 'tournament' })]} isAuthenticated={false} onOpenEvent={vi.fn()} />);

    expect(screen.getByText('An Announcement')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View Entries' })).not.toBeInTheDocument();
  });
});
