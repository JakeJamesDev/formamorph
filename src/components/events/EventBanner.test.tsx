import { render, screen, fireEvent, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBanner, EventBannerChips } from './EventBanner';
import { useEventBanners } from './useEventBanners';
import { isEventBannerDismissed, markEventBannerDismissed } from '@/lib/eventSeenStore';
import { daysFrom, serverEvent as event } from '@/test/serverEvents';
import type { ServerEvent } from '@/types';

beforeEach(() => localStorage.clear());

/**
 * A host of the two surfaces: the cards where the announcement belongs, the chips in a row it already
 * had. The two slots are marked so a case can say which one a chip ended up in — the point of the split.
 */
function Banners({ events, onOpenEvent }: { events: ServerEvent[]; onOpenEvent?: (event: ServerEvent) => void }) {
  const banners = useEventBanners(events);
  return (
    <div>
      <div data-testid="top-bar">
        <button type="button">Community Creations</button>
        <EventBannerChips banners={banners} onOpenEvent={onOpenEvent} />
      </div>
      <div data-testid="banner-row">
        <EventBanner banners={banners} onOpenEvent={onOpenEvent} />
      </div>
    </div>
  );
}

const topBar = () => screen.getByTestId('top-bar');
const bannerRow = () => screen.getByTestId('banner-row');

describe('EventBanner', () => {
  it('renders nothing when no event is running', () => {
    render(<Banners events={[]} onOpenEvent={vi.fn()} />);

    expect(bannerRow()).toBeEmptyDOMElement();
    expect(within(topBar()).queryByRole('button', { name: /Contest/ })).not.toBeInTheDocument();
  });

  it('announces the running contest with its window, its blurb, and both actions', () => {
    render(<Banners events={[event()]} onOpenEvent={vi.fn()} />);

    expect(screen.getByText('Winter World-Building Contest')).toBeInTheDocument();
    expect(screen.getByText(/Build a world around a single season/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View Entries' })).toBeInTheDocument();
  });

  it('shows the outcome once the results are announced', () => {
    render(<Banners events={[event({ resultsAnnouncedAt: daysFrom(-1), placements: [{ place: 1, worldId: 'w1', worldName: 'The Long Thaw', authorName: 'sedgewright' }] })]} />);

    expect(screen.getByText(/Results announced — The Long Thaw by sedgewright/)).toBeInTheDocument();
  });

  it('takes the player to the entries', () => {
    const onOpenEvent = vi.fn();
    render(<Banners events={[event()]} onOpenEvent={onOpenEvent} />);

    fireEvent.click(screen.getByRole('button', { name: 'View Entries' }));

    expect(onOpenEvent).toHaveBeenCalledWith(expect.objectContaining({ id: 'e1' }));
  });

  it('collapses to a chip naming the contest, and remembers it on this device', () => {
    render(<Banners events={[event()]} onOpenEvent={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
    // The chip names the contest and how long is left, so it stays reachable without the card.
    expect(screen.getByRole('button', { name: /Winter World-Building Contest/ })).toHaveTextContent('12d');
    expect(isEventBannerDismissed('e1', 'start')).toBe(true);
  });

  it('puts the chip in the host row and leaves no banner row behind', () => {
    render(<Banners events={[event()]} onOpenEvent={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    const chip = screen.getByRole('button', { name: /Winter World-Building Contest/ });
    expect(topBar()).toContainElement(chip);
    // The cards surface is the whole cost of an in-flow row; with nothing left to show it renders nothing.
    expect(bannerRow()).toBeEmptyDOMElement();
  });

  it('opens collapsed when this device already dismissed that phase', () => {
    markEventBannerDismissed('e1', 'start');
    render(<Banners events={[event()]} onOpenEvent={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
    expect(within(topBar()).getByRole('button', { name: /Winter World-Building Contest/ })).toBeInTheDocument();
  });

  it('is already collapsed on the very first paint, with no card to flash', () => {
    markEventBannerDismissed('e1', 'start');

    // A server render runs no effects, so whatever this produces is what the first paint shows.
    const first = renderToString(<Banners events={[event()]} onOpenEvent={vi.fn()} />);

    expect(first).not.toContain('Dismiss');
    expect(first).toContain('Winter World-Building Contest');
  });

  it('opens as a card again when the event reaches its ending, however thoroughly it was dismissed', () => {
    markEventBannerDismissed('e1', 'start');
    render(<Banners events={[event({ resultsAnnouncedAt: daysFrom(-1), placements: [{ place: 1, worldId: 'w1', worldName: 'The Long Thaw', authorName: 'sedgewright' }] })]} onOpenEvent={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });

  it('opens the contest from the chip', () => {
    const onOpenEvent = vi.fn();
    markEventBannerDismissed('e1', 'start');
    render(<Banners events={[event()]} onOpenEvent={onOpenEvent} />);

    fireEvent.click(screen.getByRole('button', { name: /Winter World-Building Contest/ }));

    expect(onOpenEvent).toHaveBeenCalledWith(expect.objectContaining({ id: 'e1' }));
  });

  it('renders an unknown type as a plain announcement — generic fields, no entries to view', () => {
    render(<Banners events={[event({ type: 'tournament', title: 'Something New' })]} onOpenEvent={vi.fn()} />);

    expect(screen.getByText('Something New')).toBeInTheDocument();
    expect(screen.getByText(/Build a world around a single season/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View Entries' })).not.toBeInTheDocument();
  });

  it('opens the contest from the card body, so the whole card is the target', () => {
    const onOpenEvent = vi.fn();
    render(<Banners events={[event()]} onOpenEvent={onOpenEvent} />);

    fireEvent.click(screen.getByRole('button', { name: /Winter World-Building Contest/ }));

    expect(onOpenEvent).toHaveBeenCalledWith(expect.objectContaining({ id: 'e1' }));
  });

  it('leaves Dismiss to dismiss — the card body must not swallow the button that refuses it', () => {
    const onOpenEvent = vi.fn();
    render(<Banners events={[event()]} onOpenEvent={onOpenEvent} />);

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(onOpenEvent).not.toHaveBeenCalled();
    expect(isEventBannerDismissed('e1', 'start')).toBe(true);
  });

  it('leaves an announcement standing when its own card body is clicked', () => {
    const onOpenEvent = vi.fn();
    render(<Banners events={[event({ type: 'announcement' })]} onOpenEvent={onOpenEvent} />);

    fireEvent.click(screen.getByRole('button', { name: /Winter World-Building Contest/ }));

    // Nowhere to be sent, so the click is inert rather than a navigation to nothing — and never a
    // second Dismiss.
    expect(onOpenEvent).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });

  it('re-expands an announcement from its chip, back in the banner row it left', () => {
    const onOpenEvent = vi.fn();
    render(<Banners events={[event({ type: 'announcement' })]} onOpenEvent={onOpenEvent} />);

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    fireEvent.click(within(topBar()).getByRole('button', { name: /Winter World-Building Contest/ }));

    expect(onOpenEvent).not.toHaveBeenCalled();
    expect(within(bannerRow()).getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
    expect(within(topBar()).queryByRole('button', { name: /Winter World-Building Contest/ })).not.toBeInTheDocument();
  });
});

describe('when several events run at once', () => {
  const notice = event({ id: 'e2', type: 'announcement', title: 'Server Maintenance' });

  it('announces every one of them rather than hiding all but the first', () => {
    render(<Banners events={[notice, event()]} onOpenEvent={vi.fn()} />);

    expect(screen.getByText('Winter World-Building Contest')).toBeInTheDocument();
    expect(screen.getByText('Server Maintenance')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Dismiss' })).toHaveLength(2);
  });

  it('leads with the contest, whichever order the server listed them in', () => {
    render(<Banners events={[notice, event()]} onOpenEvent={vi.fn()} />);

    const order = [...document.querySelectorAll('*')];
    const at = (label: string) => order.indexOf(screen.getByText(label));
    expect(at('Winter World-Building Contest')).toBeLessThan(at('Server Maintenance'));
  });

  it('collapses each to its own chip, leaving the other standing', () => {
    render(<Banners events={[event(), notice]} onOpenEvent={vi.fn()} />);

    // The contest leads, so its Dismiss is the first of the two.
    fireEvent.click(screen.getAllByRole('button', { name: 'Dismiss' })[0]);

    expect(isEventBannerDismissed('e1', 'start')).toBe(true);
    expect(isEventBannerDismissed('e2', 'start')).toBe(false);
    // One card left, and one chip up in the host row.
    expect(within(bannerRow()).getAllByRole('button', { name: 'Dismiss' })).toHaveLength(1);
    expect(within(bannerRow()).getByText('Server Maintenance')).toBeInTheDocument();
    expect(within(topBar()).getByRole('button', { name: /Winter World-Building Contest/ })).toHaveTextContent('12d');
  });

  it('stands both chips side by side in the host row once both are dismissed', () => {
    render(<Banners events={[event(), notice]} onOpenEvent={vi.fn()} />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Dismiss' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(within(topBar()).getByRole('button', { name: /Winter World-Building Contest/ })).toBeInTheDocument();
    expect(within(topBar()).getByRole('button', { name: /Server Maintenance/ })).toBeInTheDocument();
    expect(bannerRow()).toBeEmptyDOMElement();
  });
});
