// @vitest-environment jsdom
// Must load before the storage singletons, whose first use opens IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { GameDataProvider, useGameData } from './GameDataContext';
import EntityStorageService from '@/services/EntityStorageService';
import { saveCopyToLibrary } from '@/lib/librarySources';
import { contentMatchesSource } from '@/lib/linkedContent';
import { loadMediaHashes } from '@/lib/libraryMedia';
import { buildEntityCardData, parseEntityCardData } from '@/lib/entityFile';
import { entityImages } from '@/lib/entityImages';
import type { Entity, World } from '@/types';

vi.mock('@/services/AuthService', () => ({ default: { getCurrentUser: () => null } }));
vi.mock('react-toastify', () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } }));

// The library boundary on a world the load migrated into its Media List.

// "ABC" under two MIME labels: one file, two strings.
const ABC_PNG = 'data:image/png;base64,QUJD';
const ABC_RAW = 'data:application/octet-stream;base64,QUJD';
const XYZ_PNG = 'data:image/png;base64,WFla';

type Handle = ReturnType<typeof useGameData>;

const Harness = ({ world, onReady }: { world: World; onReady: (ctx: Handle) => void }) => {
  const ctx = useGameData();
  useEffect(() => { ctx.loadWorldData(world); /* once */ }, []); // eslint-disable-line react-hooks/exhaustive-deps
  onReady(ctx);
  return null;
};

/** A stored world holding an embedded linked copy of `source`, opened in the store. */
async function openWorld(source: { id: string; revision?: string }) {
  const world = {
    id: 'w-media', version: '3.0.0',
    worldOverview: { name: 'Sedge Landing', description: '', author: '', thumbnail: null, bgm: null, systemPrompt: '', tags: [] },
    stats: [], locations: [], traits: [], statUpdates: [],
    entities: [{ id: 'w1', name: 'Wren', images: [{ data: ABC_PNG }], link: { libraryId: source.id, sourceRevision: source.revision } }],
  } as unknown as World;
  let ctx!: Handle;
  render(<GameDataProvider><Harness world={world} onReady={(c) => { ctx = c; }} /></GameDataProvider>);
  await waitFor(() => expect(ctx.worldLoaded).toBe(true));
  // A save writes back only once the world's Supporter Copy marker is read.
  await waitFor(() => expect(ctx.supporterCopy).toBeNull());
  return () => ctx;
}

const save = (ctx: Handle) => act(async () => { expect((await ctx.saveWorld()).ok).toBe(true); });

describe('a linked library copy in a world migrated on load', () => {
  it('holds ids after the load, and reads unchanged against its embedded source', async () => {
    const source = await saveCopyToLibrary({ id: 'x', name: 'Wren', images: [{ data: ABC_RAW }] } as Entity, []);
    const ctx = await openWorld(source);
    const [copy] = ctx().entities;
    expect(copy.images?.every((img) => 'mediaId' in img)).toBe(true);

    // The update review's compare: same file, two forms.
    const stored = await EntityStorageService.getEntityData(source.id);
    const list = ctx().worldOverview.mediaList;
    const hashes = await loadMediaHashes([copy, stored], list);
    expect(contentMatchesSource(copy, stored as Entity, undefined, undefined, undefined, { list, hashes })).toBe(true);
  });

  it('saves without a write-back while unchanged, and writes an edit back as embedded, named pictures', async () => {
    const source = await saveCopyToLibrary({ id: 'x', name: 'Wren', images: [{ data: ABC_RAW }] } as Entity, []);
    const ctx = await openWorld(source);

    await save(ctx());
    expect((await EntityStorageService.getEntityData(source.id)).images).toEqual([{ data: ABC_RAW }]);

    // The editor reports which library items the author owns; an edit to an owned copy stays linked.
    act(() => ctx().setOwnedLibraryIds([source.id]));
    // Add a second picture the way the gallery does: an entry and a link in one step.
    const [copy] = ctx().entities;
    await act(async () => {
      ctx().updateEntity({ ...copy, images: [...(copy.images ?? []), { mediaId: 'm-new' }] });
      ctx().addMedia({ 'm-new': { id: 'm-new', name: 'Wounded', kind: 'image', data: XYZ_PNG } });
    });
    await save(ctx());

    const written = await EntityStorageService.getEntityData(source.id);
    expect(written.images).toEqual([{ data: ABC_PNG, name: 'Wren 1' }, { data: XYZ_PNG, name: 'Wounded' }]);
  });

  it('exports a character card that carries its pictures', async () => {
    const source = await saveCopyToLibrary({ id: 'x', name: 'Wren', images: [{ data: ABC_RAW }] } as Entity, []);
    const ctx = await openWorld(source);
    const [copy] = ctx().entities;
    const card = buildEntityCardData(copy, [], {}, undefined, undefined, ctx().worldOverview.mediaList);
    const parsed = parseEntityCardData(JSON.parse(JSON.stringify(card)), ABC_PNG);
    expect(entityImages(parsed).map((img) => img.data)).toEqual([ABC_PNG]);
  });
});
