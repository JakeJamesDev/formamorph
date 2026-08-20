import { render, screen, fireEvent } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBanner } from './EventBanner';
import { isEventBannerDismissed, markEventBannerDismissed } from '@/lib/eventSeenStore';
import type { ServerEvent } from '@/types';

const day = 86_400_000;
const at = (offsetDays: number) => new Date(Date.now() + offsetDays * day).toISOString();

const event = (over: Partial<ServerEvent> = {}): ServerEvent => ({
  id: 'e1',
  type: 'contest',
  title: 'Winter World-Building Contest',
  bannerText: 'Build a world around a single season.',
  body: 'The long version.',
  rulesText: 'One entry per creator.',
  startsAt: at(-4),
  endsAt: at(12),
  cancelledAt: null,
  startMessageId: 'm-start',
  endMessageId: null,
  winnerMessageId: null,
  winnerWorldId: null,
  winnerName: null,
  winnerAuthorName: null,
  ...over,
});

beforeEach(() => localStorage.clear());

describe('EventBanner', () => {
  it('renders nothing when no event is running', () => {
    const { container } = render(<EventBanner events={[]} onOpenEvent={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('announces the running contest with its window, its blurb, and both actions', () => {
    render(<EventBanner events={[event()]} onOpenEvent={vi.fn()} />);

    expect(screen.getByText('Winter World-Building Contest')).toBeInTheDocument();
    expect(screen.getByText(/Build a world around a single season/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View Entries' })).toBeInTheDocument();
  });

  it('shows the outcome once a winner has been named', () => {
    render(<EventBanner events={[event({ winnerName: 'The Long Thaw', winnerAuthorName: 'sedgewright' })]} />);

    expect(screen.getByText(/Winner announced — The Long Thaw by sedgewright/)).toBeInTheDocument();
  });

  it('takes the player to the entries', () => {
    const onOpenEvent = vi.fn();
    render(<EventBanner events={[event()]} onOpenEvent={onOpenEvent} />);

    fireEvent.click(screen.getByRole('button', { name: 'View Entries' }));

    expect(onOpenEvent).toHaveBeenCalledWith(expect.objectContaining({ id: 'e1' }));
  });

  it('collapses to a chip naming the contest, and remembers it on this device', () => {
    render(<EventBanner events={[event()]} onOpenEvent={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
    // The chip names the contest and how long is left, so it stays reachable without the card.
    expect(screen.getByRole('button', { name: /Winter World-Building Contest/ })).toHaveTextContent('12d');
    expect(isEventBannerDismissed('e1', 'start')).toBe(true);
  });

  it('opens collapsed when this device already dismissed that phase', () => {
    markEventBannerDismissed('e1', 'start');
    render(<EventBanner events={[event()]} onOpenEvent={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Winter World-Building Contest/ })).toBeInTheDocument();
  });

  it('is already collapsed on the very first paint, with no card to flash', () => {
    markEventBannerDismissed('e1', 'start');

    // A server render runs no effects, so whatever this produces is what the first paint shows.
    const first = renderToString(<EventBanner events={[event()]} onOpenEvent={vi.fn()} />);

    expect(first).not.toContain('Dismiss');
    expect(first).toContain('Winter World-Building Contest');
  });

  it('opens as a card again when the event reaches its ending, however thoroughly it was dismissed', () => {
    markEventBannerDismissed('e1', 'start');
    render(<EventBanner events={[event({ winnerName: 'The Long Thaw' })]} onOpenEvent={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });

  it('opens the contest from the chip', () => {
    const onOpenEvent = vi.fn();
    markEventBannerDismissed('e1', 'start');
    render(<EventBanner events={[event()]} onOpenEvent={onOpenEvent} />);

    fireEvent.click(screen.getByRole('button', { name: /Winter World-Building Contest/ }));

    expect(onOpenEvent).toHaveBeenCalledWith(expect.objectContaining({ id: 'e1' }));
  });

  it('renders an unknown type as a plain announcement — generic fields, no entries to view', () => {
    render(<EventBanner events={[event({ type: 'tournament', title: 'Something New' })]} onOpenEvent={vi.fn()} />);

    expect(screen.getByText('Something New')).toBeInTheDocument();
    expect(screen.getByText(/Build a world around a single season/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View Entries' })).not.toBeInTheDocument();
  });

  it('re-opens an announcement from its chip, which has nowhere else to go', () => {
    const onOpenEvent = vi.fn();
    render(<EventBanner events={[event({ type: 'announcement' })]} onOpenEvent={onOpenEvent} />);

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    fireEvent.click(screen.getByRole('button', { name: /Winter World-Building Contest/ }));

    expect(onOpenEvent).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });
});
