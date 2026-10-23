import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { benchEditorWorld, openAddFromLibrary, renderWorldEditorBench } from '@/test/worldEditorBench';
import { markHelpSeen } from '@/lib/helpSeenStore';
import { blobHash } from '@/lib/blobHash';
import { blobToDataUrl } from '@/lib/imageSource';
import { buildEntityCardData } from '@/lib/entityFile';
import { embedEntityCard } from '@/lib/entityCard';
import type { Entity, World, WorldVrm } from '@/types';

/**
 * A library entity's Avatar pick on its way into a world and back: Add embeds the library Avatar in the world's
 * store, an owned library save brings its pick into the linked copy, and a world save writes the copy's pick back
 * in library form. Each pick matches across the two forms by file content.
 *
 * The libraries are in-memory stand-ins for the IndexedDB services, as in `WorldEditor.libraryLinks.test.tsx`.
 */

const library = vi.hoisted(() => ({
  entities: new Map<string, { id: string; name: string; data: Entity; createdAt?: string; editedAt?: string }>(),
  /** The Avatar library, by id. */
  models: new Map<string, { name: string; blob: Blob; hash: string }>(),
  imported: 0,
}));

vi.mock('@/services/EntityStorageService', () => ({
  default: {
    getEntityMetadata: () => Promise.resolve([...library.entities.values()].map(({ id, name, createdAt, editedAt }) => ({ id, name, createdAt, editedAt }))),
    getEntityData: (id: string) => {
      const found = library.entities.get(id);
      return found ? Promise.resolve(found.data) : Promise.reject(new Error('Entity not found'));
    },
    storeEntity: (record: { id: string; name: string; data: Entity }) => {
      library.entities.set(record.id, { ...library.entities.get(record.id), ...record });
      return Promise.resolve();
    },
  },
}));

vi.mock('@/services/DictionaryStorageService', () => ({
  default: { getDictionaryMetadata: () => Promise.resolve([]), getDictionaryData: () => Promise.reject(new Error('none')), storeDictionary: () => Promise.resolve() },
}));

vi.mock('@/services/ModelStorageService', async () => {
  const { blobHash: hashOf } = await import('@/lib/blobHash');
  return {
    default: {
      getModelMetadata: () => Promise.resolve([...library.models].map(([id, m]) => ({ id, name: m.name, type: 'model/vrm', size: m.blob.size }))),
      getModelHashes: () => Promise.resolve(new Map([...library.models].map(([id, m]) => [id, { name: m.name, hash: m.hash }]))),
      getModelData: (id: string) => {
        const found = library.models.get(id);
        return found ? Promise.resolve({ type: 'model/vrm', blob: found.blob, size: found.blob.size, hash: found.hash }) : Promise.reject(new Error('Model not found'));
      },
      importModelBlob: async (blob: Blob, fileName: string) => {
        const hash = await hashOf(blob);
        const held = [...library.models].find(([, m]) => m.hash === hash);
        if (held) return held[0];
        library.imported += 1;
        const id = `imported-${library.imported}`;
        library.models.set(id, { name: fileName.replace(/\.[^.]+$/, ''), blob, hash });
        return id;
      },
    },
  };
});

vi.mock('@/services/AuthService', () => ({ default: { getCurrentUser: () => ({ id: 'me', username: 'Fen' }) } }));

vi.mock('../services/WorldStorageService', () => ({
  default: { initialize: vi.fn(), getWorldMetadata: vi.fn().mockResolvedValue([]), storeWorld: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('@/lib/jsonFileWorkerUtils', () => ({ serializeJsonBlob: vi.fn(), parseJsonText: vi.fn(), terminateWorker: vi.fn() }));

vi.mock('react-toastify', () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() }, ToastContainer: () => null }));

const REVISION = '2026-01-01T00:00:00.000Z';
const HERON = new Blob(['heron-vrm-bytes'], { type: 'model/vrm' });
const CRANE = new Blob(['crane-vrm-bytes'], { type: 'model/vrm' });

const addModel = async (id: string, name: string, blob: Blob) =>
  library.models.set(id, { name, blob, hash: await blobHash(blob) });

/** A store entry holding `blob`, with no stored hash, as entries from before the hash field read. */
const storeEntry = async (name: string, blob: Blob): Promise<WorldVrm> =>
  ({ name, file: { data: await blobToDataUrl(blob), type: 'model/vrm', name: `${name}.vrm`, size: blob.size } });

const seedEntity = (id: string, name: string, extra: Partial<Entity> = {}, editedAt = REVISION) =>
  library.entities.set(id, { id, name, createdAt: REVISION, editedAt, data: { id, name, playerDescription: 'A pilot.', ...extra } as Entity });

const worldWith = (entities: Partial<Entity>[] = [], vrmStore?: Record<string, WorldVrm>): World => benchEditorWorld({
  entities: [{ id: 'e1', name: 'Wren', playerDescription: 'A ferryman.' }, ...entities],
  ...(vrmStore ? { worldOverview: { ...benchEditorWorld({}).worldOverview, vrmStore } } : {}),
} as Partial<World>);

const openTab = (name: RegExp) => fireEvent.mouseDown(screen.getByRole('tab', { name }));

const addFromLibrary = async (name: string) => {
  openTab(/Entities/);
  openAddFromLibrary('entity');
  fireEvent.click(await screen.findByText(name));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add Entity' }));
};

const awaitLibraryLookup = async () => {
  for (let i = 0; i < 4; i += 1) await act(() => new Promise<void>((r) => { setTimeout(r, 0); }));
};

beforeEach(async () => {
  localStorage.clear();
  markHelpSeen('library.linkedContent');
  library.entities.clear();
  library.models.clear();
  library.imported = 0;
  await addModel('heron', 'Grey Heron', HERON);
});

describe('Add from Library', () => {
  it('embeds the library Avatar in the world store and points the pick at it', async () => {
    seedEntity('lib-m', 'Tall Marn', { vrmPick: { kind: 'library', id: 'heron' } });
    const { ctx } = renderWorldEditorBench(worldWith(), 'advanced');
    await addFromLibrary('Tall Marn');

    await waitFor(() => expect(ctx().entities).toHaveLength(2));
    const store = ctx().worldOverview.vrmStore ?? {};
    const [id, entry] = Object.entries(store)[0];
    expect(Object.keys(store)).toHaveLength(1);
    expect(entry).toMatchObject({ name: 'Grey Heron', hash: library.models.get('heron')!.hash });
    expect(ctx().entities.find((e) => e.name === 'Tall Marn')?.vrmPick).toEqual({ kind: 'world', id });
  });

  it('reuses the store entry that already holds the same file', async () => {
    seedEntity('lib-m', 'Tall Marn', { vrmPick: { kind: 'library', id: 'heron' } });
    const { ctx } = renderWorldEditorBench(worldWith([], { 'legacy-player-avatar': await storeEntry('Player', HERON) }), 'advanced');
    await addFromLibrary('Tall Marn');

    await waitFor(() => expect(ctx().entities).toHaveLength(2));
    expect(Object.keys(ctx().worldOverview.vrmStore ?? {})).toEqual(['legacy-player-avatar']);
    expect(ctx().entities.find((e) => e.name === 'Tall Marn')?.vrmPick).toEqual({ kind: 'world', id: 'legacy-player-avatar' });
  });

  it('sets a pick of a library Avatar that is gone to none', async () => {
    seedEntity('lib-m', 'Tall Marn', { vrmPick: { kind: 'library', id: 'deleted' } });
    const { ctx } = renderWorldEditorBench(worldWith(), 'advanced');
    await addFromLibrary('Tall Marn');

    await waitFor(() => expect(ctx().entities).toHaveLength(2));
    expect(ctx().entities.find((e) => e.name === 'Tall Marn')).not.toHaveProperty('vrmPick');
    expect(ctx().worldOverview.vrmStore ?? {}).toEqual({});
  });
});

function fakeWebp(): Uint8Array {
  const payload = [1, 2, 3, 4];
  const out = new Uint8Array(12 + 8 + payload.length);
  const view = new DataView(out.buffer);
  const put4 = (s: string, at: number) => { for (let i = 0; i < 4; i++) out[at + i] = s.charCodeAt(i); };
  put4('RIFF', 0);
  view.setUint32(4, out.length - 8, true);
  put4('WEBP', 8);
  put4('VP8 ', 12);
  view.setUint32(16, payload.length, true);
  out.set(payload, 20);
  return out;
}

/** A character card whose entity picks an Avatar on the author's device and carries its file. */
const cardCarrying = async (name: string, blob: Blob) => {
  const vrm = { ...await storeEntry(name, blob), hash: '' };
  const data = buildEntityCardData({ id: 'author-e', name: 'Kestrel', vrmPick: { kind: 'library', id: 'authors-record' }, vrm });
  const bytes = embedEntityCard(fakeWebp(), JSON.stringify(data), { w: 4, h: 4 });
  const file = new File([bytes], 'card.webp', { type: 'image/webp' });
  Object.defineProperty(file, 'arrayBuffer', { value: async () => bytes.buffer });
  return file;
};

/** Pick a card through the Entities tab's Import Entity… row and wait for its review. */
const importCard = async (file: File) => {
  openTab(/Entities/);
  fireEvent.click(screen.getByRole('button', { name: 'Add to Entities' }));
  fireEvent.click(screen.getByRole('button', { name: 'Import Entity…' }));
  fireEvent.change(document.querySelector('input[type="file"][accept=".json,.png,.webp"]')!, { target: { files: [file] } });
  return within(await screen.findByRole('dialog', { name: 'Import Entity' }));
};

describe('Importing a card', () => {
  it('leaves the Avatar library unchanged when the review is canceled', async () => {
    renderWorldEditorBench(worldWith(), 'advanced');
    const review = await importCard(await cardCarrying('Crane', CRANE));

    fireEvent.click(review.getByRole('button', { name: 'Cancel' }));
    await awaitLibraryLookup();

    expect(library.imported).toBe(0);
    expect([...library.models.keys()]).toEqual(['heron']);
  });

  it('adds the Avatar on confirm and embeds it in the world store', async () => {
    const { ctx } = renderWorldEditorBench(worldWith(), 'advanced');
    const review = await importCard(await cardCarrying('Crane', CRANE));
    expect(library.imported).toBe(0);

    fireEvent.click(review.getByRole('button', { name: 'Add Entity' }));

    await waitFor(() => expect(ctx().entities).toHaveLength(2));
    expect(library.imported).toBe(1);
    const store = ctx().worldOverview.vrmStore ?? {};
    const [id, entry] = Object.entries(store)[0];
    expect(Object.keys(store)).toHaveLength(1);
    expect(entry.hash).toBe(library.models.get('imported-1')!.hash);
    expect(ctx().entities.find((e) => e.name === 'Kestrel')?.vrmPick).toEqual({ kind: 'world', id });
    // The review keeps the link by default, so the library copy picks the added record.
    expect([...library.entities.values()].find((e) => e.name === 'Kestrel')?.data.vrmPick).toEqual({ kind: 'library', id: 'imported-1' });
  });

  it('reuses the library record that holds the same file on confirm', async () => {
    const { ctx } = renderWorldEditorBench(worldWith(), 'advanced');
    const review = await importCard(await cardCarrying('Heron', HERON));

    fireEvent.click(review.getByRole('button', { name: 'Add Entity' }));

    await waitFor(() => expect(ctx().entities).toHaveLength(2));
    expect(library.imported).toBe(0);
    expect([...library.models.keys()]).toEqual(['heron']);
    expect(Object.values(ctx().worldOverview.vrmStore ?? {}).map((e) => e.name)).toEqual(['Grey Heron']);
  });
});

describe('Opening a world after a library save', () => {
  it('embeds the Avatar an owned library save picked, in the linked copy', async () => {
    seedEntity('lib-w', 'Wren', { vrmPick: { kind: 'library', id: 'heron' } }, '2026-03-03T00:00:00.000Z');
    const { ctx } = renderWorldEditorBench(benchEditorWorld({
      entities: [{ id: 'e1', name: 'Wren', playerDescription: 'A pilot.', link: { libraryId: 'lib-w', sourceName: 'Wren', sourceRevision: REVISION } }],
    }), 'advanced');

    await waitFor(() => expect(ctx().entities[0].vrmPick?.kind).toBe('world'));
    const id = (ctx().entities[0].vrmPick as { id: string }).id;
    expect(ctx().worldOverview.vrmStore?.[id]?.name).toBe('Grey Heron');
  });
});

describe('Saving a world with a linked copy of your own item', () => {
  const linkedWorld = async (blob: Blob) => benchEditorWorld({
    entities: [{
      id: 'e1', name: 'Wren', playerDescription: 'A pilot.', vrmPick: { kind: 'world', id: 'w1' },
      link: { libraryId: 'lib-w', sourceName: 'Wren', sourceRevision: REVISION },
    }],
    worldOverview: { ...benchEditorWorld({}).worldOverview, vrmStore: { w1: await storeEntry('Heron', blob) } },
  } as Partial<World>);

  const renameAndSave = async (world: World) => {
    const bench = renderWorldEditorBench(world, 'advanced');
    openTab(/Entities/);
    await awaitLibraryLookup();
    act(() => bench.ctx().updateEntity({ ...bench.ctx().entities[0], playerDescription: 'A smuggler.' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(library.entities.get('lib-w')?.data.playerDescription).toBe('A smuggler.'));
    return bench;
  };

  it('writes nothing while the copy and its item show the same Avatar', async () => {
    seedEntity('lib-w', 'Wren', { vrmPick: { kind: 'library', id: 'heron' } });
    const { ctx } = renderWorldEditorBench(await linkedWorld(HERON), 'advanced');
    await awaitLibraryLookup();
    // An edit elsewhere, so the save runs the write-back over the untouched copy.
    act(() => ctx().updateWorldOverview({ description: 'A fen.' }));
    await waitFor(() => expect(ctx().isWorldDirty).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(ctx().isWorldDirty).toBe(false));
    expect(library.entities.get('lib-w')?.editedAt).toBe(REVISION);
  });

  it('writes the library record with the same file as the item’s pick', async () => {
    seedEntity('lib-w', 'Wren');
    await renameAndSave(await linkedWorld(HERON));

    expect(library.entities.get('lib-w')?.data.vrmPick).toEqual({ kind: 'library', id: 'heron' });
    expect(library.imported).toBe(0);
  });

  it('imports a world Avatar the library lacks and picks it', async () => {
    seedEntity('lib-w', 'Wren');
    await renameAndSave(await linkedWorld(CRANE));

    expect(library.imported).toBe(1);
    expect(library.entities.get('lib-w')?.data.vrmPick).toEqual({ kind: 'library', id: 'imported-1' });
  });
});
