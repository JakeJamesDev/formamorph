import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventsTab } from './EventsTab';
import EventService from '@/services/EventService';
import { daysFrom, serverEvent } from '@/test/serverEvents';
import type { ServerEvent } from '@/types';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

// The two dialogs have their own coverage; stubbing them keeps this file about the tab's own list.
vi.mock('./EventFormDialog', () => ({
  EventFormDialog: ({ editing }: { editing?: ServerEvent | null }) => (
    <div data-testid="event-form">{editing ? `editing ${editing.title}` : 'new'}</div>
  ),
}));
vi.mock('./WinnerPickDialog', () => ({
  WinnerPickDialog: ({ contest }: { contest: ServerEvent }) => (
    <div data-testid="winner-dialog">{contest.title}</div>
  ),
}));

// The app-wide events poll lives in MainMenu; here only the nudge itself is the tab's to prove.
const { refreshActiveEvents } = vi.hoisted(() => ({ refreshActiveEvents: vi.fn() }));
vi.mock('@/lib/useActiveEvents', () => ({ refreshActiveEvents }));

// The shared events list players read. Its own behavior is covered beside it; here the wiring is.
const { invalidateEvents } = vi.hoisted(() => ({ invalidateEvents: vi.fn() }));
vi.mock('@/lib/eventsCache', () => ({ invalidateEvents, resetEventsCache: () => {} }));

const currentUser = { id: 'a1', username: 'root-admin', accountType: 'admin' };
vi.mock('@/services/AuthService', () => ({
  default: { token: 't', getCurrentUser: () => currentUser },
}));

const at = (offsetDays: number) => daysFrom(offsetDays);

const event = (over: Partial<ServerEvent> = {}): ServerEvent =>
  serverEvent({ title: 'Summer Isles Contest', startsAt: at(-4), endsAt: at(8), ...over });

const running = event({ id: 'running', title: 'Running Contest' });
const judging = event({ id: 'judging', title: 'Judging Contest', startsAt: at(-20), endsAt: at(-2) });
const scheduled = event({ id: 'scheduled', title: 'Future Contest', startsAt: at(5), endsAt: at(20) });
const canceled = event({ id: 'canceled', title: 'Called Off Contest', cancelledAt: at(-1) });

const asAdmin = () => { currentUser.accountType = 'admin'; };
const asMod = () => { currentUser.accountType = 'mod'; };

/** The tab reads its calendar once on becoming active; wait for that read before asserting. */
const renderTab = async (list: ServerEvent[]) => {
  vi.spyOn(EventService, 'fetchList').mockResolvedValue(list);
  render(<EventsTab active />);
  await screen.findByText(list[0].title);
};

beforeEach(() => {
  asAdmin();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the calendar', () => {
  it('fetches nothing until the tab is the one on screen', () => {
    // The panel plays a close animation; the list stays mounted through it and gates the fetch instead.
    const fetchList = vi.spyOn(EventService, 'fetchList').mockResolvedValue([]);

    render(<EventsTab active={false} />);

    expect(fetchList).not.toHaveBeenCalled();
  });

  it('groups what is running, what is scheduled and what is over', async () => {
    await renderTab([running, judging, scheduled, event({ id: 'over', title: 'Old Contest', startsAt: at(-60), endsAt: at(-30), winnerName: 'Lantern Reef' })]);

    // Which group a title landed in is its position between the headings — the grouping is the whole
    // point of the list, and a test that only checked the titles were present would pass on a flat one.
    const positions = new Map(
      ['Happening Now', 'Scheduled', 'Past', 'Running Contest', 'Judging Contest', 'Future Contest', 'Old Contest']
        .map((label) => {
          const node = /Contest$/.test(label)
            ? screen.getByText(label)
            : screen.getByRole('heading', { name: label });
          return [label, [...document.querySelectorAll('*')].indexOf(node)];
        }),
    );
    const between = (label: string, from: string, to: string) =>
      positions.get(label)! > positions.get(from)! && positions.get(label)! < positions.get(to)!;

    expect(between('Running Contest', 'Happening Now', 'Scheduled')).toBe(true);
    expect(between('Judging Contest', 'Happening Now', 'Scheduled')).toBe(true);
    expect(between('Future Contest', 'Scheduled', 'Past')).toBe(true);
    expect(positions.get('Old Contest')!).toBeGreaterThan(positions.get('Past')!);
  });

  it('says so when a group is empty rather than dropping its heading', async () => {
    await renderTab([running]);

    expect(screen.getByText('Nothing is scheduled.')).toBeTruthy();
    expect(screen.getByText('Nothing has finished yet.')).toBeTruthy();
  });

  it('shows nothing but an empty state on a server with no events', async () => {
    vi.spyOn(EventService, 'fetchList').mockResolvedValue([]);

    render(<EventsTab active />);

    expect(await screen.findByText(/No events yet/)).toBeTruthy();
  });
});

describe('what an administrator may do', () => {
  it('offers the edit and the cancel on a running event', async () => {
    await renderTab([running]);

    expect(screen.getByRole('button', { name: /Edit/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Cancel$/ })).toBeTruthy();
  });

  it('offers delete only on an event nobody was told about', async () => {
    await renderTab([running, scheduled]);

    // One delete for the scheduled row, none for the running one.
    expect(screen.getAllByRole('button', { name: /Delete/ })).toHaveLength(1);
  });

  it('sees the events that were called off', async () => {
    await renderTab([running, canceled]);

    expect(screen.getByText('Called Off Contest')).toBeTruthy();
  });

  it('confirms before calling an event off, naming what it undoes', async () => {
    const cancel = vi.spyOn(EventService, 'cancel').mockResolvedValue(running);
    await renderTab([running]);

    fireEvent.click(screen.getByRole('button', { name: /^Cancel$/ }));

    expect(await screen.findByText(/Entries go back to being ordinary listings/)).toBeTruthy();
    expect(cancel).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel Event' }));

    await waitFor(() => expect(cancel).toHaveBeenCalledWith('running'));
  });

  it('confirms before deleting a scheduled event', async () => {
    const remove = vi.spyOn(EventService, 'remove').mockResolvedValue(undefined);
    await renderTab([scheduled]);

    fireEvent.click(screen.getByRole('button', { name: /Delete/ }));
    expect(remove).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByRole('button', { name: 'Delete Event' }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith('scheduled'));
  });

  it('opens the form on the event being edited', async () => {
    await renderTab([running]);

    fireEvent.click(screen.getByRole('button', { name: /Edit/ }));

    expect(screen.getByTestId('event-form').textContent).toBe('editing Running Contest');
  });

  it('re-reads the calendar after a cancel, so the row settles into its new state', async () => {
    const fetchList = vi.spyOn(EventService, 'fetchList').mockResolvedValue([running]);
    vi.spyOn(EventService, 'cancel').mockResolvedValue({ ...running, cancelledAt: at(0) });
    render(<EventsTab active />);
    await screen.findByText('Running Contest');
    expect(fetchList).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /^Cancel$/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel Event' }));

    await waitFor(() => expect(fetchList).toHaveBeenCalledTimes(2));
  });

  it('nudges the app-wide events poll after a mutation, so an edit reaches the publish flow at once', async () => {
    refreshActiveEvents.mockClear();
    vi.spyOn(EventService, 'cancel').mockResolvedValue({ ...running, cancelledAt: at(0) });
    await renderTab([running]);
    expect(refreshActiveEvents).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /^Cancel$/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel Event' }));

    await waitFor(() => expect(refreshActiveEvents).toHaveBeenCalled());
  });

  it('drops the shared events list too, so the archive and its badges agree in this session', async () => {
    invalidateEvents.mockClear();
    vi.spyOn(EventService, 'cancel').mockResolvedValue({ ...running, cancelledAt: at(0) });
    await renderTab([running]);
    expect(invalidateEvents).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /^Cancel$/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel Event' }));

    await waitFor(() => expect(invalidateEvents).toHaveBeenCalled());
  });
});

describe('what a moderator may do', () => {
  it('picks a winner, which is the judgement the tab is staff-visible for', async () => {
    asMod();
    await renderTab([judging]);

    fireEvent.click(screen.getByRole('button', { name: /Pick Winner/ }));

    expect(screen.getByTestId('winner-dialog').textContent).toBe('Judging Contest');
  });

  it('is not offered the controls that speak to every player', async () => {
    asMod();
    await renderTab([running, judging, scheduled]);

    expect(screen.queryByRole('button', { name: /New Event/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Edit/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Cancel$/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Delete/ })).toBeNull();
  });

  it('is not shown the events that were called off', async () => {
    asMod();
    await renderTab([running, canceled]);

    expect(screen.queryByText('Called Off Contest')).toBeNull();
  });

  it('is offered no winner pick while a contest is still taking entries', async () => {
    asMod();
    await renderTab([running]);

    expect(screen.queryByRole('button', { name: /Pick Winner/ })).toBeNull();
  });

  it('is offered no winner pick once one has been named', async () => {
    asMod();
    const decided = event({
      id: 'decided', title: 'Decided Contest', startsAt: at(-20), endsAt: at(-2), winnerName: 'Lantern Reef',
    });
    await renderTab([decided]);

    expect(screen.queryByRole('button', { name: /Pick Winner/ })).toBeNull();
  });
});

describe('the Past group once there are years of them', () => {
  /** `count` finished announcements, newest first — what a monthly cadence leaves behind. */
  const finished = (count: number): ServerEvent[] =>
    Array.from({ length: count }, (_, i) => event({
      id: `past-${i}`,
      type: 'announcement',
      title: `Past ${i}`,
      startsAt: at(-30 - i * 30),
      endsAt: at(-29 - i * 30),
    }));

  it('shows the newest handful and folds the rest behind one action', async () => {
    await renderTab(finished(13));

    expect(screen.getByText('Past 0')).toBeInTheDocument();
    expect(screen.getByText('Past 9')).toBeInTheDocument();
    expect(screen.queryByText('Past 10')).toBeNull();
    expect(screen.getByRole('button', { name: 'Show Older (3)' })).toBeInTheDocument();
  });

  it('reveals every one of them when the action is pressed — the record is never gone', async () => {
    await renderTab(finished(13));

    fireEvent.click(screen.getByRole('button', { name: 'Show Older (3)' }));

    expect(screen.getByText('Past 12')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show Fewer' }));
    expect(screen.queryByText('Past 12')).toBeNull();
  });

  it('offers nothing to expand while the group still fits', async () => {
    await renderTab(finished(10));

    expect(screen.getByText('Past 9')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Show Older/ })).toBeNull();
  });

  it('folds the same way for a moderator, whose calendar is the shorter one', async () => {
    asMod();

    await renderTab([...finished(12), canceled]);

    // The canceled event is an administrator's business and never joins the count.
    expect(screen.queryByText('Called Off Contest')).toBeNull();
    expect(screen.getByRole('button', { name: 'Show Older (2)' })).toBeInTheDocument();
  });
});
