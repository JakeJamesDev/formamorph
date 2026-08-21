import { render, screen, fireEvent } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBanner } from './EventBanner';
import { isEventBannerDismissed, markEventBannerDismissed } from '@/lib/eventSeenStore';
import { serverEvent as event } from '@/test/serverEvents';

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

  it('opens the contest from the card body, so the whole card is the target', () => {
    const onOpenEvent = vi.fn();
    render(<EventBanner events={[event()]} onOpenEvent={onOpenEvent} />);

    fireEvent.click(screen.getByRole('button', { name: /Winter World-Building Contest/ }));

    expect(onOpenEvent).toHaveBeenCalledWith(expect.objectContaining({ id: 'e1' }));
  });

  it('leaves Dismiss to dismiss — the card body must not swallow the button that refuses it', () => {
    const onOpenEvent = vi.fn();
    render(<EventBanner events={[event()]} onOpenEvent={onOpenEvent} />);

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(onOpenEvent).not.toHaveBeenCalled();
    expect(isEventBannerDismissed('e1', 'start')).toBe(true);
  });

  it('re-opens an announcement from its own card body', () => {
    const onOpenEvent = vi.fn();
    render(<EventBanner events={[event({ type: 'announcement' })]} onOpenEvent={onOpenEvent} />);

    fireEvent.click(screen.getByRole('button', { name: /Winter World-Building Contest/ }));

    // Nowhere to be sent, so the click is inert rather than a navigation to nothing.
    expect(onOpenEvent).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
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

describe('when several events run at once', () => {
  const notice = event({ id: 'e2', type: 'announcement', title: 'Server Maintenance' });

  it('announces every one of them rather than hiding all but the first', () => {
    render(<EventBanner events={[notice, event()]} onOpenEvent={vi.fn()} />);

    expect(screen.getByText('Winter World-Building Contest')).toBeInTheDocument();
    expect(screen.getByText('Server Maintenance')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Dismiss' })).toHaveLength(2);
  });

  it('leads with the contest, whichever order the server listed them in', () => {
    render(<EventBanner events={[notice, event()]} onOpenEvent={vi.fn()} />);

    const order = [...document.querySelectorAll('*')];
    const at = (label: string) => order.indexOf(screen.getByText(label));
    expect(at('Winter World-Building Contest')).toBeLessThan(at('Server Maintenance'));
  });

  it('collapses each to its own chip, leaving the other standing', () => {
    render(<EventBanner events={[event(), notice]} onOpenEvent={vi.fn()} />);

    // The contest leads, so its Dismiss is the first of the two.
    fireEvent.click(screen.getAllByRole('button', { name: 'Dismiss' })[0]);

    expect(isEventBannerDismissed('e1', 'start')).toBe(true);
    expect(isEventBannerDismissed('e2', 'start')).toBe(false);
    // One card left, and one chip beside it.
    expect(screen.getAllByRole('button', { name: 'Dismiss' })).toHaveLength(1);
    expect(screen.getByText('Server Maintenance')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Winter World-Building Contest/ })).toHaveTextContent('12d');
  });
});
