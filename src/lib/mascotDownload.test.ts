// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { toast } from 'react-toastify';
import { useLibraryDownload } from './useLibraryDownload';
import { mascotLibraryTarget } from './mascotDownload';
import { DEFAULT_MASCOT_RIG, type MascotImageRef, type MascotRig } from './formaquestion/mascot';
import { buildMascotCardData, mascotRigFromCard } from './formaquestion/mascotCard';
import { DEFAULT_MASCOT_ID, saveMascotRig, type MascotPresetStore } from './formaquestion/mascotPresets';
import { mascotImageIds } from './formaquestion/mascotRigEdits';
import * as fetchModule from './fetchCatalogContent';

const STAMP = '2026-10-27T00:00:00.000Z';
const listing = (updatedAt = STAMP) =>
  ({ _id: 'M1', kind: 'mascot', name: 'Listed', updated_at: updatedAt, author: { id: 'u1', username: 'Uploader' } });

const stored = (id: string): MascotImageRef => ({ kind: 'stored', id });
const rigOf = (...ids: string[]): MascotRig => ({
  ...DEFAULT_MASCOT_RIG,
  base: stored(ids[0]),
  layers: [{ id: 'hi', name: 'Hi', kind: 'state', enabled: true, images: ids.slice(1).map(stored) }],
});

/** A card as the listing serves it: images as data URLs, named by the pixels they carry. */
const card = (name: string | undefined, ...ids: string[]) => ({
  ...buildMascotCardData(name ?? '', rigOf(...ids), (ref) => `data:image/png;base64,${btoa(ref.kind === 'bundled' ? ref.name : ref.id)}`, '3.0.1'),
  ...(name === undefined ? { name: undefined } : {}),
});

/** The preset store and the image store a download touches, held in memory. */
function setup(initial: MascotPresetStore = { activeId: DEFAULT_MASCOT_ID, mascots: [] }) {
  const state = { store: initial, nextImage: 1, images: new Set<string>() };
  const dropImages = vi.fn((ids: readonly string[]) => ids.forEach((id) => state.images.delete(id)));
  const storeCard = vi.fn(async (data: ReturnType<typeof card>) => {
    const ids = data.images.map(() => `img-${state.nextImage++}`);
    ids.forEach((id) => state.images.add(id));
    return mascotRigFromCard(data, ids);
  });
  const hook = renderHook(() => useLibraryDownload(mascotLibraryTarget(
    state.store.mascots,
    { read: () => state.store, write: (next) => { state.store = next; } },
    { storeCard, dropImages },
  )));
  return { state, hook, storeCard, dropImages };
}

const download = async (hook: ReturnType<typeof setup>['hook'], state: ReturnType<typeof setup>['state']) => {
  const before = state.store;
  await act(async () => { hook.result.current.startDownload(listing()); });
  await waitFor(() => expect(state.store).not.toBe(before));
  hook.rerender();
};

beforeEach(() => {
  vi.spyOn(fetchModule, 'fetchCatalogContent').mockResolvedValue(card('Wren', 'a', 'b'));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('Mascot listing download', () => {
  it('adds a selectable custom Mascot that follows the listing, and leaves the selection alone', async () => {
    const { hook, state } = setup();
    await download(hook, state);

    expect(state.store.activeId).toBe(DEFAULT_MASCOT_ID);
    expect(state.store.mascots).toHaveLength(1);
    const [mascot] = state.store.mascots;
    expect(mascot).toMatchObject({ name: 'Wren', sourceId: 'M1', sourceUpdatedAt: STAMP, sourceAuthorId: 'u1', sourceAuthorName: 'Uploader' });
    expect(mascot.id).not.toBe(DEFAULT_MASCOT_ID);
    // Its images are the ones the card stored, by id, so the mascot draws from the image store.
    expect([...mascotImageIds(mascot.rig)].sort()).toEqual(['img-1', 'img-2']);
    expect(hook.result.current.downloadStateFor(listing())).toBe('refresh');
  });

  it('shows Update Available once the listing is newer than the copy', async () => {
    const { hook, state } = setup();
    await download(hook, state);

    expect(hook.result.current.downloadStateFor(listing('2026-10-28T00:00:00.000Z'))).toBe('update');
  });

  it('replaces the held copy on a second download, in place, and deletes the images it no longer uses', async () => {
    const { hook, state, dropImages } = setup();
    await download(hook, state);
    const firstId = state.store.mascots[0].id;
    vi.mocked(fetchModule.fetchCatalogContent).mockResolvedValue(card('Wren', 'c', 'd'));
    await download(hook, state);

    expect(state.store.mascots).toHaveLength(1);
    expect(state.store.mascots[0].id).toBe(firstId);
    expect([...mascotImageIds(state.store.mascots[0].rig)].sort()).toEqual(['img-3', 'img-4']);
    expect(dropImages).toHaveBeenCalledWith(expect.arrayContaining(['img-1', 'img-2']));
    expect([...state.images].sort()).toEqual(['img-3', 'img-4']);
  });

  it('keeps an image a duplicate of the old copy still uses', async () => {
    const { hook, state, dropImages } = setup();
    await download(hook, state);
    const held = state.store.mascots[0];
    state.store = { ...state.store, mascots: [...state.store.mascots, { id: 'twin', name: 'Twin', rig: held.rig }] };
    hook.rerender();
    vi.mocked(fetchModule.fetchCatalogContent).mockResolvedValue(card('Wren', 'c', 'd'));
    await download(hook, state);

    expect(dropImages).toHaveBeenCalledWith([]);
  });

  it('numbers the name when another Mascot has it, and keeps a replaced copy\'s own name free', async () => {
    const { hook, state } = setup({ activeId: DEFAULT_MASCOT_ID, mascots: [{ id: 'own', name: 'Wren', rig: rigOf('x') }] });
    await download(hook, state);
    expect(state.store.mascots.map((mascot) => mascot.name)).toEqual(['Wren', 'Wren 2']);

    vi.mocked(fetchModule.fetchCatalogContent).mockResolvedValue(card('Wren', 'c'));
    await download(hook, state);
    expect(state.store.mascots.map((mascot) => mascot.name)).toEqual(['Wren', 'Wren 2']);
  });

  it('names the Mascot after the listing when the card carries no name', async () => {
    vi.mocked(fetchModule.fetchCatalogContent).mockResolvedValue(card(undefined, 'a'));
    const { hook, state } = setup();
    await download(hook, state);

    expect(state.store.mascots[0].name).toBe('Listed');
  });

  it('asks before replacing an edited copy, and replaces nothing until the player agrees', async () => {
    const { hook, state, storeCard } = setup();
    await download(hook, state);
    state.store = saveMascotRig(state.store, state.store.mascots[0].id, rigOf('mine'));
    hook.rerender();
    const before = state.store;
    storeCard.mockClear();
    await act(async () => { hook.result.current.startDownload(listing()); });

    expect(hook.result.current.dirtyConfirm).not.toBeNull();
    expect(storeCard).not.toHaveBeenCalled();
    expect(state.store).toBe(before);

    await act(async () => { hook.result.current.confirmDirtyDownload(); });
    await waitFor(() => expect(state.store).not.toBe(before));
    expect(state.store.mascots[0].dirty).toBeUndefined();
  });

  it('stores nothing and keeps the store when the content is not a Mascot card', async () => {
    const error = vi.spyOn(toast, 'error');
    vi.mocked(fetchModule.fetchCatalogContent).mockResolvedValue({ kind: 'something-else' });
    const { hook, state, storeCard } = setup();
    const before = state.store;
    await act(async () => { hook.result.current.startDownload(listing()); });
    await waitFor(() => expect(error).toHaveBeenCalled());

    expect(storeCard).not.toHaveBeenCalled();
    expect(state.store).toBe(before);
  });
});
