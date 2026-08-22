import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventAckModal } from './EventAckModal';
import MessageService from '@/services/MessageService';
import EventService from '@/services/EventService';
import { isEventAcknowledged, markEventAcknowledged } from '@/lib/eventSeenStore';
import { daysFrom, serverEvent, withoutProse } from '@/test/serverEvents';
import type { ServerEvent } from '@/types';

const server = vi.hoisted(() => ({ detail: {} as Record<string, unknown> }));

vi.mock('@/services/EventService', () => ({
  default: { fetchOne: vi.fn(async (id: string) => server.detail[id]) },
}));

const event = (over: Partial<ServerEvent> = {}): ServerEvent =>
  serverEvent({ body: 'Enter by publishing a world with the contest switch on.', ...over });


beforeEach(() => {
  localStorage.clear();
  server.detail = {};
  vi.mocked(EventService.fetchOne).mockClear();
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

  it('reads the body back out of the server when the row came without one', async () => {
    // A contest waiting on results comes from the archive feed, which is served without its prose — the
    // poster is one of only two surfaces that show any, so it fetches the one event it is about.
    const full = event({ body: 'The contest is closed. Judging has begun.' });
    server.detail = { e1: full };

    render(<EventAckModal events={[withoutProse(full)]} isAuthenticated={false} />);

    expect(await screen.findByText(/Judging has begun/)).toBeInTheDocument();
    expect(EventService.fetchOne).toHaveBeenCalledWith('e1');
  });

  it('asks for nothing further when the row already carries its body', () => {
    render(<EventAckModal events={[event()]} isAuthenticated={false} />);

    expect(screen.getByText(/Enter by publishing a world/)).toBeInTheDocument();
    expect(EventService.fetchOne).not.toHaveBeenCalled();
  });

  it('waits for the body rather than offering a Got It that would bury it', async () => {
    // Acknowledging is once and for good, so a poster answered in the moment before its body arrived is
    // a body nobody ever sees. Nothing is shown until the read settles.
    let arrive: (full: ServerEvent) => void = () => {};
    vi.mocked(EventService.fetchOne).mockReturnValueOnce(new Promise((resolve) => { arrive = resolve; }));
    const full = event({ body: 'The contest is closed. Judging has begun.' });

    render(<EventAckModal events={[withoutProse(full)]} isAuthenticated={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    arrive(full);

    expect(await screen.findByText(/Judging has begun/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Got It' })).toBeInTheDocument();
  });

  it('posts it anyway when the body cannot be read, so the poster is never one nobody can dismiss', async () => {
    vi.mocked(EventService.fetchOne).mockRejectedValueOnce(new Error('offline'));

    render(<EventAckModal events={[withoutProse(event())]} isAuthenticated={false} />);

    expect(await screen.findByText('Winter World-Building Contest')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Got It' })).toBeInTheDocument();
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

  it('posts the ending separately, naming first place and marking that broadcast read', async () => {
    const markRead = vi.spyOn(MessageService, 'markRead').mockResolvedValue();
    markEventAcknowledged('e1', 'start');
    const ended = event({
      resultsAnnouncedAt: daysFrom(-1), placements: [{ place: 1, worldId: 'w1', worldName: 'The Long Thaw', authorName: 'sedgewright' }], winnerMessageId: 'm-results',
    });

    render(<EventAckModal events={[ended]} isAuthenticated />);

    expect(screen.getByText('Results Announced')).toBeInTheDocument();
    expect(screen.getByText(/The Long Thaw/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Got It' }));
    await waitFor(() => expect(markRead).toHaveBeenCalledWith('m-results'));
  });

  it('posts that judging has begun for a contest closed with its results still to come', async () => {
    const markRead = vi.spyOn(MessageService, 'markRead').mockResolvedValue();
    // The one a player who launched the app after the deadline gets: closed, undecided, unacknowledged.
    const closed = event({ startsAt: daysFrom(-20), endsAt: daysFrom(-1), endMessageId: 'm-end' });

    render(<EventAckModal events={[closed]} isAuthenticated onOpenEvent={vi.fn()} />);

    expect(screen.getByText('This Event Has Ended')).toBeInTheDocument();
    // Not "See The Results": there are none yet, and the entries are what there is to look at.
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

describe('the poster waiting its turn', () => {
  it('holds while the intro animation still has the screen', () => {
    render(<EventAckModal events={[event()]} isAuthenticated held />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('posts as soon as the hold lifts, with nothing acknowledged in the meantime', () => {
    const { rerender } = render(<EventAckModal events={[event()]} isAuthenticated held />);
    expect(isEventAcknowledged('e1', 'start')).toBe(false);

    rerender(<EventAckModal events={[event()]} isAuthenticated />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('posts immediately when there is no intro to wait for', () => {
    render(<EventAckModal events={[event()]} isAuthenticated />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('what the organizer styled', () => {
  const band = () => screen.getByRole('dialog').querySelector('.text-display')?.parentElement as HTMLElement;

  it('keeps the app default when the event carries no styling', () => {
    render(<EventAckModal events={[event()]} isAuthenticated />);

    expect(band().className).toContain('bg-info');
    expect(band().style.backgroundColor).toBe('');
  });

  it('keeps the app default on a server that has never heard of the styling fields', () => {
    // The whole point of tolerating their absence: a client update must not break against a lagging deploy.
    const legacy = event();
    delete (legacy as Partial<ServerEvent>).posterColor;
    delete (legacy as Partial<ServerEvent>).posterImageUrl;

    render(<EventAckModal events={[legacy]} isAuthenticated />);

    expect(band().className).toContain('bg-info');
  });

  it('paints the band in the organizer color, with text that holds against it', () => {
    render(<EventAckModal events={[event({ posterColor: '#fef08a' })]} isAuthenticated />);

    expect(band().style.backgroundColor).toBe('rgb(254, 240, 138)');
    // Pale yellow: the fixed white would have been white-on-white.
    expect(band().style.color).toBe('rgb(28, 25, 23)');
    expect(band().className).not.toContain('bg-info');
  });

  it('leads with the organizer artwork under a wash', () => {
    render(<EventAckModal events={[event({ posterImageUrl: '/api/event-posters/a.webp' })]} isAuthenticated />);

    const art = screen.getByTestId('poster-band-image');
    expect(art.style.backgroundImage).toContain('/api/event-posters/a.webp');
  });

  it('keeps the text light over artwork chosen without a color', () => {
    // Nothing paints the band, so without this the title inherits the panel's own dark text and lands
    // on a dark wash.
    render(<EventAckModal events={[event({ posterImageUrl: '/api/event-posters/a.webp' })]} isAuthenticated />);

    expect(band().style.color).toBe('rgb(255, 255, 255)');
    expect(band().className).not.toContain('bg-info');
  });

  it('styles the ending the same way it styled the opening', () => {
    markEventAcknowledged('e1', 'start');
    const ended = event({
      posterColor: '#1e3a8a', resultsAnnouncedAt: daysFrom(-1), placements: [{ place: 1, worldId: 'w1', worldName: 'The Long Thaw', authorName: 'sedgewright' }],
    });

    render(<EventAckModal events={[ended]} isAuthenticated />);

    expect(screen.getByText('Results Announced')).toBeInTheDocument();
    expect(band().style.backgroundColor).toBe('rgb(30, 58, 138)');
  });

  it('reads the body as markdown rather than as the symbols it was typed with', () => {
    render(<EventAckModal events={[event({ body: 'Build **something strange**.' })]} isAuthenticated />);

    // Streamdown renders emphasis as a tagged span rather than a `<strong>`.
    expect(screen.getByText('something strange')).toHaveAttribute('data-streamdown', 'strong');
  });
});
