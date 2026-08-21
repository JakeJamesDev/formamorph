import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { toast } from 'react-toastify';
import { WinnerPickDialog } from './WinnerPickDialog';
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
    getCurrentUser: () => ({ id: 'picker', username: 'a-mod', accountType: 'mod' }),
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

const catalog = (worlds: Record<string, unknown>[]) => {
  vi.spyOn(WorldStorageService, 'fetchRemoteWorlds')
    .mockResolvedValue({ success: true, data: worlds, pagination: undefined, total: worlds.length });
};

const entry = (name: string) => screen.getByRole('radio', { name: new RegExp(name) });

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

    render(<WinnerPickDialog open onOpenChange={() => {}} contest={contest} />);

    expect(await screen.findByText('Pearl of the Undertow')).toBeTruthy();
    expect(screen.queryByText('Not Entered')).toBeNull();
  });

  it('says so when nothing was entered', async () => {
    catalog([]);

    render(<WinnerPickDialog open onOpenChange={() => {}} contest={contest} />);

    expect(await screen.findByText('Nothing was entered into this contest.')).toBeTruthy();
  });
});

describe('the entries nobody may crown', () => {
  it('keeps the picker from their own, wearing the reason rather than vanishing', async () => {
    catalog([listing({ _id: 'mine', name: 'Salt-Bright Reaches', author: { id: 'picker', username: 'a-mod' } })]);

    render(<WinnerPickDialog open onOpenChange={() => {}} contest={contest} />);
    await screen.findByText('Salt-Bright Reaches');

    expect(screen.getByText('Your entry')).toBeTruthy();
    expect((entry('Salt-Bright Reaches') as HTMLButtonElement).disabled).toBe(true);
  });

  it('keeps a quarantined entry out of the running for the same reason the catalog hides it', async () => {
    catalog([listing({ _id: 'q1', name: 'Ninth Wave Shoals', quarantined_at: '2026-07-20 12:00:00' })]);

    render(<WinnerPickDialog open onOpenChange={() => {}} contest={contest} />);
    await screen.findByText('Ninth Wave Shoals');

    expect(screen.getByText('Quarantined')).toBeTruthy();
    expect((entry('Ninth Wave Shoals') as HTMLButtonElement).disabled).toBe(true);
  });

  it('sends nothing when a blocked entry is clicked', async () => {
    const pick = vi.spyOn(EventService, 'pickWinner').mockResolvedValue(contest);
    catalog([listing({ _id: 'mine', name: 'Salt-Bright Reaches', author: { id: 'picker', username: 'a-mod' } })]);

    render(<WinnerPickDialog open onOpenChange={() => {}} contest={contest} />);
    await screen.findByText('Salt-Bright Reaches');

    fireEvent.click(entry('Salt-Bright Reaches'));

    expect((screen.getByRole('button', { name: /Announce Winner/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(pick).not.toHaveBeenCalled();
  });
});

describe('announcing', () => {
  it('shows nothing to announce until an entry is chosen', async () => {
    catalog([listing()]);

    render(<WinnerPickDialog open onOpenChange={() => {}} contest={contest} />);
    await screen.findByText('Pearl of the Undertow');

    expect(screen.queryByText(/The winning world is/)).toBeNull();
    expect((screen.getByRole('button', { name: /Announce Winner/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('previews the broadcast before it is one', async () => {
    catalog([listing()]);

    render(<WinnerPickDialog open onOpenChange={() => {}} contest={contest} />);
    await screen.findByText('Pearl of the Undertow');

    fireEvent.click(entry('Pearl of the Undertow'));

    expect(screen.getByText(/The winning world is “Pearl of the Undertow” by mirelle/)).toBeTruthy();
  });

  it('sends the pick only once the announcement has been confirmed', async () => {
    const pick = vi.spyOn(EventService, 'pickWinner').mockResolvedValue(contest);
    catalog([listing()]);
    const onPicked = vi.fn();

    render(<WinnerPickDialog open onOpenChange={() => {}} contest={contest} onPicked={onPicked} />);
    await screen.findByText('Pearl of the Undertow');

    fireEvent.click(entry('Pearl of the Undertow'));
    expect(pick).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Announce Winner/ }));

    await waitFor(() => expect(pick).toHaveBeenCalledWith('c1', 'w1'));
    expect(onPicked).toHaveBeenCalled();
  });

  it('stays open when the server refuses the pick', async () => {
    vi.spyOn(EventService, 'pickWinner').mockRejectedValue(new Error('You cannot pick your own entry'));
    catalog([listing()]);
    const onOpenChange = vi.fn();

    render(<WinnerPickDialog open onOpenChange={onOpenChange} contest={contest} />);
    await screen.findByText('Pearl of the Undertow');

    fireEvent.click(entry('Pearl of the Undertow'));
    fireEvent.click(screen.getByRole('button', { name: /Announce Winner/ }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('You cannot pick your own entry'));
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
