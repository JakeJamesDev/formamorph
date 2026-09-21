import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useLibraryDownload, type LibraryRecord } from './useLibraryDownload';
import * as fetchModule from './fetchCatalogContent';
import type { Entity } from '@/types';

const listing = (id: string, updatedAt = '2026-07-02T00:00:00.000Z') =>
  ({ _id: id, name: 'Mara', updated_at: updatedAt });

/** The published content — it carries the author's own entity id, as a real listing does. */
const content = { id: 'author-original-id', name: 'Mara' } as Entity;

type Store = ReturnType<typeof vi.fn>;

const setup = (records: LibraryRecord[] = [], store: Store = vi.fn()) => {
  const hook = renderHook(() =>
    useLibraryDownload<Entity>({ kind: 'entity', records, store, refresh: vi.fn() }));
  return { hook, store };
};

beforeEach(() => {
  vi.spyOn(fetchModule, 'fetchCatalogContent').mockResolvedValue(content);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('downloaded creator credits', () => {
  it.each(['entity', 'dictionary'] as const)('fills blank %s credits and preserves pen names', async (kind) => {
    const store = vi.fn();
    const hook = renderHook(() => useLibraryDownload<Entity>({ kind, records: [], store, refresh: vi.fn() }));
    for (const author of [undefined, '', '  ', 'River Quill']) {
      vi.mocked(fetchModule.fetchCatalogContent).mockResolvedValue({ ...content, author });
      await act(async () => {
        hook.result.current.startDownload({ ...listing('credit'), author: { id: 'publisher', username: ' Wren ' } });
      });
      expect(store.mock.lastCall?.[2].libraryDetails.author).toBe(author === 'River Quill' ? author : 'Wren');
      expect(store.mock.lastCall?.[1]).not.toHaveProperty('author');
    }
  });

  it('keeps an unknown author blank and leaves avatar payloads alone', async () => {
    for (const kind of ['entity', 'model'] as const) {
      const store = vi.fn();
      const hook = renderHook(() => useLibraryDownload<Entity>({ kind, records: [], store, refresh: vi.fn() }));
      await act(async () => {
        hook.result.current.startDownload(kind === 'model'
          ? { ...listing('avatar'), author: { id: 'publisher', username: 'Wren' } }
          : listing('unknown'));
      });
      expect(store.mock.lastCall?.[1]).not.toHaveProperty('author');
      hook.unmount();
    }
  });
});

describe('useLibraryDownload record id', () => {
  it('never stores under the downloaded content’s own id', async () => {
    // That id belongs to the author's original. A character you made and published carries it too, so
    // writing there would replace a local record this flow can't see — the guard only knows copies by
    // sourceId. Worlds mint a per-copy id for the same reason.
    const { hook, store } = setup();

    await act(async () => { hook.result.current.startDownload(listing('L1')); });
    await waitFor(() => expect(store).toHaveBeenCalled());

    const [recordId, stored] = store.mock.calls[0];
    expect(recordId).not.toBe('author-original-id');
    expect(recordId).toMatch(/^downloaded-/);
    expect((stored as Entity).id).toBe(recordId); // content id normalized to the record it lives in
  });

  it('reuses the existing copy’s id, so a re-download refreshes in place', async () => {
    const held: LibraryRecord = { id: 'downloaded-existing', name: 'Mara', sourceId: 'L1' };
    const { hook, store } = setup([held]);

    await act(async () => { hook.result.current.startDownload(listing('L1')); });
    await waitFor(() => expect(store).toHaveBeenCalled());

    expect(store.mock.calls[0][0]).toBe('downloaded-existing'); // one copy per listing, not a second
  });

  it('gives two listings that share a content id their own records', async () => {
    const { hook, store } = setup();

    await act(async () => { hook.result.current.startDownload(listing('L1')); });
    await waitFor(() => expect(store).toHaveBeenCalledTimes(1));
    await act(async () => { hook.result.current.startDownload(listing('L2')); });
    await waitFor(() => expect(store).toHaveBeenCalledTimes(2));

    // Both listings publish content with the same author id; they must not collapse into one record.
    expect(store.mock.calls[0][0]).not.toBe(store.mock.calls[1][0]);
  });

  it('stamps the community link on the stored copy', async () => {
    const { hook, store } = setup();

    await act(async () => { hook.result.current.startDownload(listing('L1', '2026-07-09T00:00:00.000Z')); });
    await waitFor(() => expect(store).toHaveBeenCalled());

    expect(store.mock.calls[0][2]).toMatchObject({
      sourceId: 'L1',
      sourceUpdatedAt: '2026-07-09T00:00:00.000Z',
      dirty: false, // a fresh download is unedited — and this clears the flag on a copy you'd edited
    });
  });

  it('passes the listing\'s own name, for a kind whose content names itself nothing', async () => {
    // An Avatar's content is just `{ vrm, license, hash }` — the only name available is the listing's.
    const { hook, store } = setup();

    await act(async () => { hook.result.current.startDownload(listing('L1')); });
    await waitFor(() => expect(store).toHaveBeenCalled());

    expect(store.mock.calls[0][3]).toBe('Mara');
  });
});

describe('useLibraryDownload guards', () => {
  it('asks before replacing an edited copy', async () => {
    const held: LibraryRecord = { id: 'downloaded-1', name: 'Mara', sourceId: 'L1', dirty: true };
    const { hook, store } = setup([held]);

    await act(async () => { hook.result.current.startDownload(listing('L1')); });

    expect(store).not.toHaveBeenCalled(); // nothing written until the user answers
    expect(hook.result.current.dirtyConfirm).not.toBeNull();
  });

  it('replaces the edited copy once confirmed', async () => {
    const held: LibraryRecord = { id: 'downloaded-1', name: 'Mara', sourceId: 'L1', dirty: true };
    const { hook, store } = setup([held]);

    await act(async () => { hook.result.current.startDownload(listing('L1')); });
    await act(async () => { hook.result.current.confirmDirtyDownload(); });
    await waitFor(() => expect(store).toHaveBeenCalled());

    expect(store.mock.calls[0][0]).toBe('downloaded-1');
  });

  it('does not ask when the held copy is unedited', async () => {
    const held: LibraryRecord = { id: 'downloaded-1', name: 'Mara', sourceId: 'L1', dirty: false };
    const { hook, store } = setup([held]);

    await act(async () => { hook.result.current.startDownload(listing('L1')); });
    await waitFor(() => expect(store).toHaveBeenCalled());

    expect(hook.result.current.dirtyConfirm).toBeNull();
  });

  it('ignores a second click while a download is already running', async () => {
    // Two runs on one listing share a progress key: whichever finishes first deletes it while the other is
    // still streaming, dropping the bar mid-download, and both then write the same record.
    //
    // Asserted on the fetch count, not the store count: a pending fetch is what a second run would
    // duplicate, and it's observable the moment the click lands rather than after any resolution.
    vi.mocked(fetchModule.fetchCatalogContent).mockImplementation(() => new Promise(() => {}));
    const { hook } = setup();

    await act(async () => { hook.result.current.startDownload(listing('L1')); });
    await act(async () => { hook.result.current.startDownload(listing('L1')); }); // double-click

    expect(fetchModule.fetchCatalogContent).toHaveBeenCalledTimes(1);
  });

  it('allows a different listing to download concurrently', async () => {
    // The guard is per listing, not global — two cards must still download at once.
    vi.mocked(fetchModule.fetchCatalogContent).mockImplementation(() => new Promise(() => {}));
    const { hook } = setup();

    await act(async () => { hook.result.current.startDownload(listing('L1')); });
    await act(async () => { hook.result.current.startDownload(listing('L2')); });

    expect(fetchModule.fetchCatalogContent).toHaveBeenCalledTimes(2);
  });
});
