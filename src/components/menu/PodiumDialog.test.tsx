import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { toast } from 'react-toastify';
import { PodiumDialog } from './PodiumDialog';
import EventService from '@/services/EventService';
import WorldStorageService from '@/services/WorldStorageService';
import { serverEvent } from '@/test/serverEvents';
import type { ServerEvent } from '@/types';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

vi.mock('@/services/AuthService', () => ({
  default: {
    token: 't',
    API_URL: 'http://localhost/api',
    isAuthenticated: () => true,
    getCurrentUser: () => ({ id: 'judge', username: 'an-admin', accountType: 'admin' }),
  },
}));

// The cache reads IndexedDB before showing anything; the entries this file is about are named, not seen.
vi.mock('@/lib/useCachedThumbnail', () => ({
  CachedThumbnail: () => <img alt="" />,
}));

const contest: ServerEvent = serverEvent({
  id: 'c1',
  title: 'Summer Isles Contest',
  startsAt: '2026-07-01T12:00:00.000Z',
  endsAt: '2026-08-01T12:00:00.000Z',
  endMessageId: 'm2',
});

const listing = (over: Record<string, unknown> = {}) => ({
  _id: 'w1',
  name: 'Pearl of the Undertow',
  author: { id: 'u2', username: 'mirelle' },
  likes: 41,
  contest_event_id: 'c1',
  ...over,
});

/** Three placeable entries, in the order the tests name them. */
const three = () => [
  listing(),
  listing({ _id: 'w2', name: 'Ninth Wave Shoals', author: { id: 'u3', username: 'corrin' } }),
  listing({ _id: 'w3', name: 'Salt-Bright Reaches', author: { id: 'u4', username: 'ashgrove' } }),
];

const catalog = (worlds: Record<string, unknown>[]) => {
  vi.spyOn(WorldStorageService, 'fetchRemoteWorlds')
    .mockResolvedValue({ success: true, data: worlds, pagination: undefined, total: worlds.length });
};

const entry = (name: string) =>
  within(screen.getByRole('group', { name: 'Entries' })).getByRole('button', { name: new RegExp(name) });

/** The podium rows above the grid, top down. */
const rows = () => within(screen.getByLabelText('Podium')).getAllByRole('listitem');

/**
 * The podium as it reads, top down: one `1st Place / Pearl of the Undertow` per row.
 *
 * An empty podium is one row carrying the line that says how to start one, and no clear button — so it
 * reads as no places staged rather than as a row with nothing in it.
 */
const staged = (): string[] => rows()
  .filter((row) => within(row).queryByRole('button', { name: /^Clear / }))
  .map((row) => {
    const place = within(row).getByText(/^\d(?:st|nd|rd) Place$/).textContent;
    const name = within(row).getByRole('button', { name: /^Clear / })
      .getAttribute('aria-label')?.replace('Clear ', '');
    return `${place} / ${name}`;
  });

/** The Tie With Above checkbox on the row holding this world. Radix renders it as a button. */
const tie = (name: string) =>
  screen.getByRole('checkbox', { name: `Tie With Above: ${name}` }) as HTMLButtonElement;

const saveButton = () => screen.getByRole('button', { name: /Announce Results|Save Podium/ }) as HTMLButtonElement;

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the gallery', () => {
  it('shows the contest entries and nothing else in the catalog', async () => {
    catalog([listing(), listing({ _id: 'w2', name: 'Not Entered', contest_event_id: null })]);

    render(<PodiumDialog open onOpenChange={() => {}} contest={contest} />);

    expect(await screen.findByText('Pearl of the Undertow')).toBeTruthy();
    expect(screen.queryByText('Not Entered')).toBeNull();
  });

  it('says so when nothing was entered', async () => {
    catalog([]);

    render(<PodiumDialog open onOpenChange={() => {}} contest={contest} />);

    expect(await screen.findByText('Nothing was entered into this contest.')).toBeTruthy();
  });

  it('opens with an empty podium and says how to start one', async () => {
    catalog(three());

    render(<PodiumDialog open onOpenChange={() => {}} contest={contest} />);
    await screen.findByText('Pearl of the Undertow');

    expect(staged()).toEqual([]);
    expect(screen.getByText('Click an entry to start the podium')).toBeTruthy();
  });
});

describe('the entries nobody may place', () => {
  it('keeps the judge from their own, wearing the reason rather than vanishing', async () => {
    catalog([listing({ _id: 'mine', name: 'Salt-Bright Reaches', author: { id: 'judge', username: 'an-admin' } })]);

    render(<PodiumDialog open onOpenChange={() => {}} contest={contest} />);
    await screen.findByText('Salt-Bright Reaches');

    expect(screen.getByText('Your entry')).toBeTruthy();
    expect((entry('Salt-Bright Reaches') as HTMLButtonElement).disabled).toBe(true);
  });

  it('keeps a quarantined entry out of the running for the same reason the catalog hides it', async () => {
    catalog([listing({ _id: 'q1', name: 'Ninth Wave Shoals', quarantined_at: '2026-07-20 12:00:00' })]);

    render(<PodiumDialog open onOpenChange={() => {}} contest={contest} />);
    await screen.findByText('Ninth Wave Shoals');

    expect(screen.getByText('Quarantined')).toBeTruthy();
    expect((entry('Ninth Wave Shoals') as HTMLButtonElement).disabled).toBe(true);
  });

  it('stages nothing when a blocked entry is clicked', async () => {
    const announce = vi.spyOn(EventService, 'announceResults').mockResolvedValue(contest);
    catalog([listing({ _id: 'mine', name: 'Salt-Bright Reaches', author: { id: 'judge', username: 'an-admin' } })]);

    render(<PodiumDialog open onOpenChange={() => {}} contest={contest} />);
    await screen.findByText('Salt-Bright Reaches');

    fireEvent.click(entry('Salt-Bright Reaches'));

    expect(saveButton().disabled).toBe(true);
    expect(announce).not.toHaveBeenCalled();
  });
});

describe('assembling the podium', () => {
  it('fills from gold down, so a click can never open a gap', async () => {
    catalog(three());

    render(<PodiumDialog open onOpenChange={() => {}} contest={contest} />);
    await screen.findByText('Pearl of the Undertow');

    fireEvent.click(entry('Pearl of the Undertow'));
    expect(staged()).toEqual(['1st Place / Pearl of the Undertow']);

    fireEvent.click(entry('Ninth Wave Shoals'));
    fireEvent.click(entry('Salt-Bright Reaches'));

    expect(staged()).toEqual([
      '1st Place / Pearl of the Undertow',
      '2nd Place / Ninth Wave Shoals',
      '3rd Place / Salt-Bright Reaches',
    ]);
  });

  it('takes a lone placed entry off the podium on the next click', async () => {
    // It cannot step down to silver: there would be nobody on gold, and a podium with a hole in it is
    // one the server refuses. So the only move left from the bottom row is off.
    catalog(three());

    render(<PodiumDialog open onOpenChange={() => {}} contest={contest} />);
    await screen.findByText('Pearl of the Undertow');

    fireEvent.click(entry('Pearl of the Undertow'));
    fireEvent.click(entry('Pearl of the Undertow'));

    expect(staged()).toEqual([]);
  });

  it('trades places with the row below rather than doubling up on it', async () => {
    catalog(three());

    render(<PodiumDialog open onOpenChange={() => {}} contest={contest} />);
    await screen.findByText('Pearl of the Undertow');

    fireEvent.click(entry('Pearl of the Undertow'));
    fireEvent.click(entry('Ninth Wave Shoals'));
    fireEvent.click(entry('Pearl of the Undertow'));

    expect(staged()).toEqual([
      '1st Place / Ninth Wave Shoals',
      '2nd Place / Pearl of the Undertow',
    ]);
  });

  it('never lets one world hold two places', async () => {
    catalog(three());

    render(<PodiumDialog open onOpenChange={() => {}} contest={contest} />);
    await screen.findByText('Pearl of the Undertow');

    fireEvent.click(entry('Pearl of the Undertow'));
    fireEvent.click(entry('Ninth Wave Shoals'));
    fireEvent.click(entry('Pearl of the Undertow'));

    expect(staged().filter((row) => row.endsWith('Pearl of the Undertow'))).toHaveLength(1);
  });

  it('seats a fourth entry on the bottom step rather than inventing a 4th place', async () => {
    // The podium holds three steps, not three worlds. A fourth click cannot take 4th place, so it
    // shares 3rd — which is the only reading that leaves 1, 2, 3, 3 reachable.
    catalog([...three(), listing({ _id: 'w4', name: 'Fourth Wall', author: { id: 'u5', username: 'lark' } })]);

    render(<PodiumDialog open onOpenChange={() => {}} contest={contest} />);
    await screen.findByText('Fourth Wall');

    fireEvent.click(entry('Pearl of the Undertow'));
    fireEvent.click(entry('Ninth Wave Shoals'));
    fireEvent.click(entry('Salt-Bright Reaches'));
    fireEvent.click(entry('Fourth Wall'));

    expect(staged()).toEqual([
      '1st Place / Pearl of the Undertow',
      '2nd Place / Ninth Wave Shoals',
      '3rd Place / Salt-Bright Reaches',
      '3rd Place / Fourth Wall',
    ]);
    expect(tie('Fourth Wall')).toBeChecked();
  });

  it('promotes what was below when the top place is cleared', async () => {
    catalog(three());

    render(<PodiumDialog open onOpenChange={() => {}} contest={contest} />);
    await screen.findByText('Pearl of the Undertow');

    fireEvent.click(entry('Pearl of the Undertow'));
    fireEvent.click(entry('Ninth Wave Shoals'));

    fireEvent.click(screen.getByRole('button', { name: 'Clear Pearl of the Undertow' }));

    expect(staged()).toEqual(['1st Place / Ninth Wave Shoals']);
  });

  it('closes the gap when a place is cleared from the middle', async () => {
    catalog(three());

    render(<PodiumDialog open onOpenChange={() => {}} contest={contest} />);
    await screen.findByText('Pearl of the Undertow');

    fireEvent.click(entry('Pearl of the Undertow'));
    fireEvent.click(entry('Ninth Wave Shoals'));
    fireEvent.click(entry('Salt-Bright Reaches'));

    fireEvent.click(screen.getByRole('button', { name: 'Clear Ninth Wave Shoals' }));

    expect(staged()).toEqual([
      '1st Place / Pearl of the Undertow',
      '2nd Place / Salt-Bright Reaches',
    ]);
  });
});

describe('sharing a place', () => {
  it('offers no tie on the first row, which has nothing above it', async () => {
    catalog(three());

    render(<PodiumDialog open onOpenChange={() => {}} contest={contest} />);
    await screen.findByText('Pearl of the Undertow');

    fireEvent.click(entry('Pearl of the Undertow'));
    fireEvent.click(entry('Ninth Wave Shoals'));

    expect(screen.queryByRole('checkbox', { name: 'Tie With Above: Pearl of the Undertow' })).toBeNull();
    expect(tie('Ninth Wave Shoals')).toBeTruthy();
  });

  it('makes the tie from the keyboard alone', async () => {
    // A judge who never touches the mouse still has to be able to share a place.
    const user = userEvent.setup();
    catalog(three());

    render(<PodiumDialog open onOpenChange={() => {}} contest={contest} />);
    await screen.findByText('Pearl of the Undertow');

    fireEvent.click(entry('Pearl of the Undertow'));
    fireEvent.click(entry('Ninth Wave Shoals'));

    tie('Ninth Wave Shoals').focus();
    expect(document.activeElement).toBe(tie('Ninth Wave Shoals'));
    await user.keyboard(' ');

    expect(staged()).toEqual([
      '1st Place / Pearl of the Undertow',
      '1st Place / Ninth Wave Shoals',
    ]);
  });

  it('makes a tie and derives every later place again', async () => {
    catalog(three());

    render(<PodiumDialog open onOpenChange={() => {}} contest={contest} />);
    await screen.findByText('Pearl of the Undertow');

    fireEvent.click(entry('Pearl of the Undertow'));
    fireEvent.click(entry('Ninth Wave Shoals'));
    fireEvent.click(entry('Salt-Bright Reaches'));

    fireEvent.click(tie('Ninth Wave Shoals'));

    expect(staged()).toEqual([
      '1st Place / Pearl of the Undertow',
      '1st Place / Ninth Wave Shoals',
      '3rd Place / Salt-Bright Reaches',
    ]);
  });

  it('marks the tied world with its shared place in the grid too', async () => {
    catalog(three());

    render(<PodiumDialog open onOpenChange={() => {}} contest={contest} />);
    await screen.findByText('Pearl of the Undertow');

    fireEvent.click(entry('Pearl of the Undertow'));
    fireEvent.click(entry('Ninth Wave Shoals'));
    fireEvent.click(tie('Ninth Wave Shoals'));

    expect(entry('Ninth Wave Shoals')).toHaveTextContent('1st Place');
  });

  it('breaks the tie again and puts the row back on its own step', async () => {
    catalog(three());

    render(<PodiumDialog open onOpenChange={() => {}} contest={contest} />);
    await screen.findByText('Pearl of the Undertow');

    fireEvent.click(entry('Pearl of the Undertow'));
    fireEvent.click(entry('Ninth Wave Shoals'));
    fireEvent.click(tie('Ninth Wave Shoals'));
    fireEvent.click(tie('Ninth Wave Shoals'));

    expect(staged()).toEqual([
      '1st Place / Pearl of the Undertow',
      '2nd Place / Ninth Wave Shoals',
    ]);
  });

  it('refuses a break that would leave a row with no place at all', async () => {
    // Four worlds share 1st. Untie the last and it is 4th, which is no step on this podium — so the
    // checkbox is unavailable and the way out is to clear the row.
    catalog([...three(), listing({ _id: 'w4', name: 'Fourth Wall', author: { id: 'u5', username: 'lark' } })]);

    render(<PodiumDialog open onOpenChange={() => {}} contest={contest} />);
    await screen.findByText('Fourth Wall');

    ['Pearl of the Undertow', 'Ninth Wave Shoals', 'Salt-Bright Reaches', 'Fourth Wall']
      .forEach((name) => fireEvent.click(entry(name)));
    fireEvent.click(tie('Ninth Wave Shoals'));
    fireEvent.click(tie('Salt-Bright Reaches'));

    expect(staged()).toEqual([
      '1st Place / Pearl of the Undertow',
      '1st Place / Ninth Wave Shoals',
      '1st Place / Salt-Bright Reaches',
      '1st Place / Fourth Wall',
    ]);

    expect(tie('Fourth Wall').disabled).toBe(true);
    fireEvent.click(tie('Fourth Wall'));
    expect(staged()[3]).toBe('1st Place / Fourth Wall');
  });

  it('keeps the podium shape when a tied row trades with the one below', async () => {
    // The flag belongs to the row, not to the world in it, so a trade moves two names and leaves
    // 1, 1, 3 as 1, 1, 3.
    catalog(three());

    render(<PodiumDialog open onOpenChange={() => {}} contest={contest} />);
    await screen.findByText('Pearl of the Undertow');

    fireEvent.click(entry('Pearl of the Undertow'));
    fireEvent.click(entry('Ninth Wave Shoals'));
    fireEvent.click(entry('Salt-Bright Reaches'));
    fireEvent.click(tie('Ninth Wave Shoals'));

    fireEvent.click(entry('Ninth Wave Shoals'));

    expect(staged()).toEqual([
      '1st Place / Pearl of the Undertow',
      '1st Place / Salt-Bright Reaches',
      '3rd Place / Ninth Wave Shoals',
    ]);
  });

  it('sends the repeated place in the request body, one row per world', async () => {
    const announce = vi.spyOn(EventService, 'announceResults').mockResolvedValue(contest);
    catalog(three());

    render(<PodiumDialog open onOpenChange={() => {}} contest={contest} />);
    await screen.findByText('Pearl of the Undertow');

    fireEvent.click(entry('Pearl of the Undertow'));
    fireEvent.click(entry('Ninth Wave Shoals'));
    fireEvent.click(entry('Salt-Bright Reaches'));
    fireEvent.click(tie('Ninth Wave Shoals'));

    fireEvent.click(saveButton());

    await waitFor(() => expect(announce).toHaveBeenCalledWith('c1', [
      { place: 1, worldId: 'w1' },
      { place: 1, worldId: 'w2' },
      { place: 3, worldId: 'w3' },
    ]));
  });

  it('writes the tied worlds onto one preview line', async () => {
    catalog(three());

    render(<PodiumDialog open onOpenChange={() => {}} contest={contest} />);
    await screen.findByText('Pearl of the Undertow');

    fireEvent.click(entry('Pearl of the Undertow'));
    fireEvent.click(entry('Ninth Wave Shoals'));
    fireEvent.click(entry('Salt-Bright Reaches'));
    fireEvent.click(tie('Ninth Wave Shoals'));
    fireEvent.click(tie('Salt-Bright Reaches'));

    expect(screen.getByText(
      'First place: Pearl of the Undertow by mirelle, Ninth Wave Shoals by corrin and Salt-Bright Reaches by ashgrove',
    )).toBeTruthy();
    expect(screen.queryByText(/Second place|Third place/)).toBeNull();
  });
});

describe('announcing', () => {
  it('refuses to announce an empty podium', async () => {
    catalog(three());

    render(<PodiumDialog open onOpenChange={() => {}} contest={contest} />);
    await screen.findByText('Pearl of the Undertow');

    expect(saveButton().disabled).toBe(true);
  });

  it('announces with gold alone, so a small contest is not made to invent three winners', async () => {
    const announce = vi.spyOn(EventService, 'announceResults').mockResolvedValue(contest);
    catalog(three());

    render(<PodiumDialog open onOpenChange={() => {}} contest={contest} />);
    await screen.findByText('Pearl of the Undertow');

    fireEvent.click(entry('Pearl of the Undertow'));
    fireEvent.click(saveButton());

    await waitFor(() => expect(announce).toHaveBeenCalledWith('c1', [{ place: 1, worldId: 'w1' }]));
  });

  it('previews the broadcast before it is one', async () => {
    catalog(three());

    render(<PodiumDialog open onOpenChange={() => {}} contest={contest} />);
    await screen.findByText('Pearl of the Undertow');

    fireEvent.click(entry('Pearl of the Undertow'));
    fireEvent.click(entry('Ninth Wave Shoals'));

    // The broadcast's own ordinals, not the plate's: the preview's job is the message before it is sent.
    expect(screen.getByText('First place: Pearl of the Undertow by mirelle')).toBeTruthy();
    expect(screen.getByText('Second place: Ninth Wave Shoals by corrin')).toBeTruthy();
  });

  it('sends the whole podium in one call, once', async () => {
    const announce = vi.spyOn(EventService, 'announceResults').mockResolvedValue(contest);
    catalog(three());
    const onSaved = vi.fn();

    render(<PodiumDialog open onOpenChange={() => {}} contest={contest} onSaved={onSaved} />);
    await screen.findByText('Pearl of the Undertow');

    fireEvent.click(entry('Pearl of the Undertow'));
    fireEvent.click(entry('Ninth Wave Shoals'));
    fireEvent.click(entry('Salt-Bright Reaches'));
    expect(announce).not.toHaveBeenCalled();

    fireEvent.click(saveButton());

    await waitFor(() => expect(announce).toHaveBeenCalledWith('c1', [
      { place: 1, worldId: 'w1' },
      { place: 2, worldId: 'w2' },
      { place: 3, worldId: 'w3' },
    ]));
    expect(announce).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalled();
  });

  it('stays open when the server refuses the podium', async () => {
    vi.spyOn(EventService, 'announceResults').mockRejectedValue(new Error('You cannot place your own entry'));
    catalog(three());
    const onOpenChange = vi.fn();

    render(<PodiumDialog open onOpenChange={onOpenChange} contest={contest} />);
    await screen.findByText('Pearl of the Undertow');

    fireEvent.click(entry('Pearl of the Undertow'));
    fireEvent.click(saveButton());

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('You cannot place your own entry'));
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

describe('editing an announced podium', () => {
  const announced: ServerEvent = serverEvent({
    ...contest,
    resultsAnnouncedAt: '2026-08-02T12:00:00.000Z',
    resultsMessageId: 'm-results',
    placements: [
      { place: 1, worldId: 'w1', worldName: 'Pearl of the Undertow', authorName: 'mirelle' },
      { place: 2, worldId: 'w2', worldName: 'Ninth Wave Shoals', authorName: 'corrin' },
    ],
  });

  it('opens staged from what is already published', async () => {
    catalog(three());

    render(<PodiumDialog open onOpenChange={() => {}} contest={announced} />);
    await screen.findByText('Salt-Bright Reaches');

    expect(staged()).toEqual([
      '1st Place / Pearl of the Undertow',
      '2nd Place / Ninth Wave Shoals',
    ]);
  });

  it('opens with a published tie intact', async () => {
    const tied: ServerEvent = serverEvent({
      ...announced,
      placements: [
        { place: 1, worldId: 'w1', worldName: 'Pearl of the Undertow', authorName: 'mirelle' },
        { place: 1, worldId: 'w2', worldName: 'Ninth Wave Shoals', authorName: 'corrin' },
        { place: 3, worldId: 'w3', worldName: 'Salt-Bright Reaches', authorName: 'ashgrove' },
      ],
    });
    catalog(three());

    render(<PodiumDialog open onOpenChange={() => {}} contest={tied} />);
    await screen.findByText('Salt-Bright Reaches');

    expect(staged()).toEqual([
      '1st Place / Pearl of the Undertow',
      '1st Place / Ninth Wave Shoals',
      '3rd Place / Salt-Bright Reaches',
    ]);
    expect(tie('Ninth Wave Shoals')).toBeChecked();
    expect(tie('Salt-Bright Reaches')).not.toBeChecked();
  });

  it('keeps a half-built draft when the list behind the dialog re-renders', async () => {
    // The staging effect re-seeds on a real change to the published podium, not on a fresh event object
    // handed down by the list. A correction half made must survive the poll behind it.
    catalog(three());

    const { rerender } = render(<PodiumDialog open onOpenChange={() => {}} contest={announced} />);
    await screen.findByText('Salt-Bright Reaches');

    fireEvent.click(tie('Ninth Wave Shoals'));
    expect(staged()[1]).toBe('1st Place / Ninth Wave Shoals');

    rerender(<PodiumDialog open onOpenChange={() => {}} contest={serverEvent({ ...announced })} />);

    expect(staged()[1]).toBe('1st Place / Ninth Wave Shoals');
  });

  it('re-seeds when the published podium gains a tie', async () => {
    // The guard above must not freeze the draft: a podium that really changed has to reach the dialog.
    catalog(three());

    const { rerender } = render(<PodiumDialog open onOpenChange={() => {}} contest={announced} />);
    await screen.findByText('Salt-Bright Reaches');
    expect(staged()[1]).toBe('2nd Place / Ninth Wave Shoals');

    rerender(<PodiumDialog open onOpenChange={() => {}} contest={serverEvent({
      ...announced,
      placements: [
        { place: 1, worldId: 'w1', worldName: 'Pearl of the Undertow', authorName: 'mirelle' },
        { place: 1, worldId: 'w2', worldName: 'Ninth Wave Shoals', authorName: 'corrin' },
      ],
    })} />);

    await waitFor(() => expect(staged()[1]).toBe('1st Place / Ninth Wave Shoals'));
  });

  it('offers a save rather than an announce, and previews nothing', async () => {
    catalog(three());

    render(<PodiumDialog open onOpenChange={() => {}} contest={announced} />);
    await screen.findByText('Salt-Bright Reaches');

    expect(screen.getByRole('button', { name: /Save Podium/ })).toBeTruthy();
    expect(screen.queryByText(/Goes to everyone/)).toBeNull();
    expect(screen.getByText(/Saving a correction posts nothing/)).toBeTruthy();
  });

  it('refuses to re-save a podium whose listing was deleted, rather than dropping its record', async () => {
    // The snapshot survives a deletion but the id does not, so there is nothing to send back for that
    // place. Saving anyway would write a podium of only the places that still have listings — the lost
    // one's record gone and everything under it promoted a step, off a save that changed nothing.
    const withLostGold: ServerEvent = serverEvent({
      ...announced,
      placements: [
        { place: 1, worldId: null, worldName: 'The Long Thaw', authorName: 'sedgewright' },
        { place: 2, worldId: 'w2', worldName: 'Ninth Wave Shoals', authorName: 'corrin' },
      ],
    });
    const edit = vi.spyOn(EventService, 'editPlacements').mockResolvedValue(withLostGold);
    catalog(three());

    render(<PodiumDialog open onOpenChange={() => {}} contest={withLostGold} />);
    await screen.findByText('Salt-Bright Reaches');

    expect(screen.getByText(/1st Place \(The Long Thaw\)/)).toBeInTheDocument();
    expect(saveButton().disabled).toBe(true);

    fireEvent.click(saveButton());
    expect(edit).not.toHaveBeenCalled();
  });

  it('saves normally when every published place still has its listing', async () => {
    // The guard above must not simply disable the button forever.
    catalog(three());

    render(<PodiumDialog open onOpenChange={() => {}} contest={announced} />);
    await screen.findByText('Salt-Bright Reaches');

    expect(saveButton().disabled).toBe(false);
  });

  it('sends the correction down the edit route, never the announce one', async () => {
    const edit = vi.spyOn(EventService, 'editPlacements').mockResolvedValue(announced);
    const announce = vi.spyOn(EventService, 'announceResults').mockResolvedValue(announced);
    catalog(three());

    render(<PodiumDialog open onOpenChange={() => {}} contest={announced} />);
    await screen.findByText('Salt-Bright Reaches');

    fireEvent.click(entry('Salt-Bright Reaches'));
    fireEvent.click(saveButton());

    await waitFor(() => expect(edit).toHaveBeenCalledWith('c1', [
      { place: 1, worldId: 'w1' },
      { place: 2, worldId: 'w2' },
      { place: 3, worldId: 'w3' },
    ]));
    expect(announce).not.toHaveBeenCalled();
  });
});
