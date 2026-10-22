// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyUpdate, type LiveWorld } from './componentUpdateRun';
import { blobHash } from './blobHash';
import type { UpdateRow } from './componentUpdates';
import type { LibrarySource } from './linkedContent';
import type { Entity, WorldVrm } from '@/types';

/** Use Author's in the update review: the source's library Avatar is embedded in the world that takes it. */

const HERON = new Blob(['heron-vrm-bytes'], { type: 'model/vrm' });

const stored = vi.hoisted(() => ({ world: {} as Record<string, unknown> }));

vi.mock('@/services/ModelStorageService', async () => {
  const { blobHash: hashOf } = await import('./blobHash');
  const blob = new Blob(['heron-vrm-bytes'], { type: 'model/vrm' });
  return {
    default: {
      getModelHashes: async () => new Map([['heron', { name: 'Grey Heron', hash: await hashOf(blob) }]]),
      getModelData: async () => ({ type: 'model/vrm', blob, size: blob.size }),
    },
  };
});

vi.mock('@/services/WorldStorageService', () => ({
  default: {
    getWorldData: () => Promise.resolve(stored.world),
    updateWorldContent: (_id: string, revise: (data: Record<string, unknown>) => Record<string, unknown>) => {
      stored.world = revise(stored.world);
      return Promise.resolve();
    },
  },
}));

const source: LibrarySource = { id: 'lib-w', name: 'Wren', revision: 'r2', owned: false };
const sourceData = { id: 'lib-w', name: 'Wren', vrmPick: { kind: 'library', id: 'heron' } } as Entity;
const copy = { id: 'e1', name: 'Wren', link: { libraryId: 'lib-w', sourceName: 'Wren', sourceRevision: 'r1' } } as Entity;
const row: UpdateRow = { worldId: 'w1', worldName: 'Marsh', itemId: 'e1', itemName: 'Wren', kind: 'entity', state: 'linked' };

beforeEach(() => {
  stored.world = { entities: [copy], placeholders: [], worldOverview: { name: 'Marsh' } };
});

describe('applyUpdate with an Avatar pick', () => {
  it('embeds the Avatar in an open world and points the copy at it', async () => {
    const written: Entity[] = [];
    let vrmStore: Record<string, WorldVrm> | undefined;
    const live: LiveWorld = {
      id: 'w1', name: 'Marsh', entities: [copy], dictionaries: [], placeholders: [],
      writeItem: (item) => written.push(item as Entity),
      getVrmStore: () => vrmStore,
      setVrmStore: (next) => { vrmStore = next; },
      addPlaceholder: () => {},
    };

    await applyUpdate(row, 'update', source, sourceData, [live]);

    const [id, entry] = Object.entries(vrmStore ?? {})[0];
    expect(entry).toMatchObject({ name: 'Grey Heron', hash: await blobHash(HERON) });
    expect(written[0].vrmPick).toEqual({ kind: 'world', id });
  });

  it('embeds the Avatar once when one review updates two copies in the open world', async () => {
    const second = { ...copy, id: 'e2' };
    const written: Entity[] = [];
    let vrmStore: Record<string, WorldVrm> | undefined;
    const live: LiveWorld = {
      id: 'w1', name: 'Marsh', entities: [copy, second], dictionaries: [], placeholders: [],
      writeItem: (item) => written.push(item as Entity),
      getVrmStore: () => vrmStore,
      setVrmStore: (next) => { vrmStore = next; },
      addPlaceholder: () => {},
    };

    await applyUpdate(row, 'update', source, sourceData, [live]);
    await applyUpdate({ ...row, itemId: 'e2' }, 'update', source, sourceData, [live]);

    const ids = Object.keys(vrmStore ?? {});
    expect(ids).toHaveLength(1);
    expect(written.map((e) => e.vrmPick)).toEqual([{ kind: 'world', id: ids[0] }, { kind: 'world', id: ids[0] }]);
  });

  it('embeds the Avatar in a stored world', async () => {
    await applyUpdate(row, 'update', source, sourceData);

    const world = stored.world as { entities: Entity[]; worldOverview: { name: string; vrmStore?: Record<string, WorldVrm> } };
    const [id, entry] = Object.entries(world.worldOverview.vrmStore ?? {})[0];
    expect(entry.name).toBe('Grey Heron');
    expect(world.worldOverview.name).toBe('Marsh');
    expect(world.entities[0].vrmPick).toEqual({ kind: 'world', id });
  });

  it('leaves the store alone on Keep Mine', async () => {
    await applyUpdate(row, 'keep', source, sourceData);
    expect((stored.world as { worldOverview: object }).worldOverview).toEqual({ name: 'Marsh' });
  });
});
