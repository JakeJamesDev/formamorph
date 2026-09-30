// Must load before the service singleton, whose constructor opens IndexedDB.
import 'fake-indexeddb/auto';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import { RemoteWorldCard } from './RemoteWorldCard';
import WorldStorageService, { type ListingDetailsRead } from '@/services/WorldStorageService';
import { forgetListingPrefetch, loadListingDetails } from '@/lib/listingDetailsLoader';
import { PREFETCH_DWELL_MS } from '@/lib/useListingPrefetch';
import { type WorldRecord } from '@/components/WorldDetails';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/useCachedThumbnail', () => ({ CachedThumbnail: () => <div data-testid="thumb" /> }));

/**
 * A card loads its listing when a reader rests on it, so the details are often there by the click. A
 * pass over the card, by pointer or by Tab, sends nothing, and a touch never does.
 */

const world = (id: string): WorldRecord => ({
  id,
  name: `Listing ${id}`,
  description: 'A drowned coastal town.',
  kind: 'world',
  author: { id: 'u1', username: 'wren_hallow' },
  tags: [],
  downloads: 7,
  comment_count: 2,
  likes: 3,
}) as unknown as WorldRecord;

const cards = (...ids: string[]) =>
  render(
    <>
      {ids.map((id) => (
        <RemoteWorldCard
          key={id}
          world={world(id)}
          downloadState="none"
          downloadProgress={undefined}
          isAuthenticated
          currentUser={{ id: 'me', username: 'reader' } as unknown as WorldRecord}
          onView={() => {}}
          onHideWorld={() => {}}
          onContextualDownload={() => {}}
        />
      ))}
    </>
  );

/** A card's frame: the element that carries its click, found from its name. */
const frame = (id: string) => screen.getByText(`Listing ${id}`).closest('[data-layout]') as HTMLElement;
/** A control inside a card that takes focus. */
const control = (id: string) => frame(id).querySelector('button') as HTMLButtonElement;

let readDetails: MockInstance<typeof WorldStorageService.readListingDetails>;
let readComments: MockInstance<typeof WorldStorageService.fetchComments>;
const answers = new Map<string, (read: ListingDetailsRead) => void>();

/** Which listings the server was asked about, in order. */
const asked = () => readDetails.mock.calls.map((call) => call[0]);

const rest = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

const mouse = { pointerType: 'mouse' };

beforeEach(() => {
  // Timers only: fake-indexeddb schedules its own work on the real clock.
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  forgetListingPrefetch();
  answers.clear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  readDetails = vi.spyOn(WorldStorageService, 'readListingDetails').mockImplementation(
    (id) => new Promise((resolve) => { answers.set(id, resolve); }),
  );
  readComments = vi.spyOn(WorldStorageService, 'fetchComments').mockResolvedValue({ data: [], total: 0 } as never);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('resting the pointer on a card', () => {
  it('sends nothing before the dwell is up', async () => {
    cards('w1');

    fireEvent.pointerEnter(frame('w1'), mouse);
    await rest(PREFETCH_DWELL_MS - 1);

    expect(readDetails).not.toHaveBeenCalled();
    expect(readComments).not.toHaveBeenCalled();
  });

  it('loads the listing and its first comments once the dwell is up', async () => {
    cards('w1');

    fireEvent.pointerEnter(frame('w1'), mouse);
    await rest(PREFETCH_DWELL_MS);

    expect(asked()).toEqual(['w1']);
    expect(readComments).toHaveBeenCalledTimes(1);
    expect(readComments.mock.calls[0][0]).toBe('w1');
  });

  it('sends nothing for cards the pointer sweeps across', async () => {
    cards('w1', 'w2', 'w3');

    for (const id of ['w1', 'w2', 'w3']) {
      fireEvent.pointerEnter(frame(id), mouse);
      await rest(PREFETCH_DWELL_MS / 2);
      fireEvent.pointerLeave(frame(id), mouse);
    }
    await rest(PREFETCH_DWELL_MS * 10);

    expect(readDetails).not.toHaveBeenCalled();
  });

  it('never prefetches for a touch', async () => {
    cards('w1');

    fireEvent.pointerEnter(frame('w1'), { pointerType: 'touch' });
    await rest(PREFETCH_DWELL_MS * 10);

    expect(readDetails).not.toHaveBeenCalled();
  });
});

describe('keyboard focus on a card', () => {
  it('loads the listing once focus rests inside the card', async () => {
    cards('w1');

    fireEvent.keyDown(document, { key: 'Tab' });
    act(() => control('w1').focus());
    await rest(PREFETCH_DWELL_MS);

    expect(asked()).toEqual(['w1']);
  });

  it('loads the listing once focus rests on the open button', async () => {
    cards('w1');

    fireEvent.keyDown(document, { key: 'Tab' });
    act(() => screen.getByRole('button', { name: 'Listing w1' }).focus());
    await rest(PREFETCH_DWELL_MS);

    expect(asked()).toEqual(['w1']);
  });

  it('keeps its dwell when a pointer passes over the card', async () => {
    cards('w1');

    fireEvent.keyDown(document, { key: 'Tab' });
    act(() => control('w1').focus());
    fireEvent.pointerEnter(frame('w1'), mouse);
    await rest(PREFETCH_DWELL_MS / 2);
    fireEvent.pointerLeave(frame('w1'), mouse);
    await rest(PREFETCH_DWELL_MS / 2);

    expect(asked()).toEqual(['w1']);
  });

  it('sends nothing when Tab moves past the card', async () => {
    cards('w1', 'w2');

    fireEvent.keyDown(document, { key: 'Tab' });
    act(() => control('w1').focus());
    await rest(PREFETCH_DWELL_MS / 2);
    act(() => control('w2').focus());
    await rest(PREFETCH_DWELL_MS / 2);
    act(() => control('w2').blur());
    await rest(PREFETCH_DWELL_MS * 10);

    expect(readDetails).not.toHaveBeenCalled();
  });

  it('sends nothing when a tap focuses a control inside the card', async () => {
    cards('w1');

    fireEvent.keyDown(document, { key: 'Tab' }); // an earlier key press does not make the tap a keyboard focus
    fireEvent.pointerDown(control('w1'), { pointerType: 'touch' });
    act(() => control('w1').focus());
    await rest(PREFETCH_DWELL_MS * 10);

    expect(readDetails).not.toHaveBeenCalled();
  });
});

describe('one prefetch at a time', () => {
  it('cancels the prefetch before it when another card starts one', async () => {
    cards('w1', 'w2');

    fireEvent.pointerEnter(frame('w1'), mouse);
    await rest(PREFETCH_DWELL_MS);
    fireEvent.pointerLeave(frame('w1'), mouse);
    fireEvent.pointerEnter(frame('w2'), mouse);
    await rest(PREFETCH_DWELL_MS);

    expect(asked()).toEqual(['w1', 'w2']);
    const signalOf = (call: number) => readDetails.mock.calls[call][1]!;
    expect(signalOf(0).aborted).toBe(true);
    expect(readComments.mock.calls[0][3]!.aborted).toBe(true);
    expect(signalOf(1).aborted).toBe(false);
  });

  it('leaves alone a listing this visit already has', async () => {
    cards('w1');
    const open = loadListingDetails('w1');
    answers.get('w1')!({ status: 'ok', details: { changelog: [], anonymousLikes: false } });
    await act(async () => { await open.fresh; });
    readDetails.mockClear();

    fireEvent.pointerEnter(frame('w1'), mouse);
    await rest(PREFETCH_DWELL_MS);

    expect(readDetails).not.toHaveBeenCalled();
  });
});
