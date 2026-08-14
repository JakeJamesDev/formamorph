import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { GameDataProvider, useGameData } from './GameDataContext';
import type { World } from '@/types';

// The provider initializes IndexedDB storage on mount; stub it out so these tests exercise only
// loadWorldData's normalization.
vi.mock('../services/WorldStorageService', () => ({
  default: { initialize: vi.fn(), getWorldMetadata: vi.fn().mockResolvedValue([]) },
}));

const world = (id: string, overview: Record<string, unknown>): World => ({
  id,
  worldOverview: {
    name: id, description: '', author: '', thumbnail: null, bgm: null,
    systemPrompt: '', use3DModel: true, tags: [], ...overview,
  },
  stats: [], locations: [], entities: [], traits: [], statUpdates: [],
} as unknown as World);

const wrapper = ({ children }: { children: ReactNode }) => <GameDataProvider>{children}</GameDataProvider>;

describe('entity ↔ location membership', () => {
  // Membership is entity-owned (ADR-0003), so these worlds are stated the way the editor writes them.
  const worldWith = (entityIds: string[]) => ({
    ...world('w', {}),
    entities: entityIds.map((id) => ({ id, name: id, locations: ['l1', 'l2'] })),
    locations: [
      { id: 'l1', name: 'Dock' },
      { id: 'l2', name: 'Green' },
    ],
  } as unknown as World);

  it('deleting an entity takes its location links with it, leaving no residue on the world', () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData(worldWith(['gone', 'keep'])); });

    act(() => { result.current.removeEntity('gone'); });

    expect(result.current.entities.map((e) => e.id)).toEqual(['keep']);
    expect(JSON.stringify(result.current.locations)).not.toContain('gone');
  });

  it('deleting a location strips it from every membership that listed it', () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData(worldWith(['keep'])); });

    act(() => { result.current.removeLocation('l1'); });

    // A stale id is invisible in every roster but rides into the exported world forever.
    expect(result.current.entities[0].locations).toEqual(['l2']);
  });

  it('leaves the entities untouched when nobody belonged to the deleted location', () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData(worldWith(['keep'])); });
    const before = result.current.entities;

    act(() => { result.current.removeLocation('l9'); });

    expect(result.current.entities).toBe(before); // same reference — no needless re-render
  });

  it('flips a location-owned world on load, so an old save file needs no separate import step', () => {
    const legacyWorld = {
      ...world('w', {}),
      entities: [{ id: 'e1', name: 'Hermit' }],
      locations: [{ id: 'l1', name: 'Dock', entities: ['e1'] }],
    } as unknown as World;
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData(legacyWorld); });

    expect(result.current.entities[0].locations).toEqual(['l1']);
    expect('entities' in result.current.locations[0]).toBe(false);
  });
});

describe('adding a location', () => {
  const mapped = () => ({
    ...world('w', {}),
    locations: [
      { id: 'l1', name: 'Harbor', canvasPosition: { x: 0, y: 0 } },
      { id: 'l2', name: 'Dock', parentId: 'l1', canvasPosition: { x: 20, y: 36 } },
    ],
  } as unknown as World);

  it('places a new location on the canvas as it is created', () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData(mapped()); });
    const before = result.current.locations.map((l) => l.canvasPosition);

    act(() => { result.current.addLocation({ id: 'l3', name: 'Beach' } as never); });

    const fresh = result.current.locations.find((l) => l.id === 'l3')!;
    expect(fresh.canvasPosition).toBeDefined();
    // Clear of the Harbor rather than on top of it, and nothing already on the map was moved to fit it.
    expect(fresh.canvasPosition!.y).toBeGreaterThan(0);
    expect(result.current.locations.slice(0, 2).map((l) => l.canvasPosition)).toEqual(before);
  });

  it('places a new sub-location inside the group that will hold it', () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData(mapped()); });

    act(() => { result.current.addLocation({ id: 'l3', name: 'Cellar', parentId: 'l1' } as never); });

    const fresh = result.current.locations.find((l) => l.id === 'l3')!;
    expect(fresh.canvasPosition).toEqual({ x: 20, y: 128 });
  });

  it('keeps a position the caller already decided on', () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData(mapped()); });

    act(() => { result.current.addLocation({ id: 'l3', name: 'Beach', canvasPosition: { x: 7, y: 9 } } as never); });

    expect(result.current.locations.find((l) => l.id === 'l3')?.canvasPosition).toEqual({ x: 7, y: 9 });
  });
});

describe('connections', () => {
  const linkedWorld = () => ({
    ...world('w', {}),
    locations: [
      { id: 'l1', name: 'Dock' },
      { id: 'l2', name: 'Green' },
      { id: 'l3', name: 'Landing' },
    ],
    connections: [
      { id: 'c1', from: 'l1', to: 'l2', twoWay: true },
      { id: 'c2', from: 'l3', to: 'l1', twoWay: false },
      { id: 'c3', from: 'l2', to: 'l3', twoWay: true },
    ],
  } as unknown as World);

  it('deleting a location deletes every Connection touching it, from either end', () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData(linkedWorld()); });

    act(() => { result.current.removeLocation('l1'); });

    // A record with a dead endpoint links nothing and can never be selected to delete by hand.
    expect(result.current.connections.map((c) => c.id)).toEqual(['c3']);
  });

  it('carries the Connections into the payload every save and export reads', () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData(linkedWorld()); });

    expect(result.current.getWorldData().connections).toHaveLength(3);
  });
});

describe('discardChanges', () => {
  const worldWithEntity = () => ({
    ...world('w', {}),
    entities: [{ id: 'e1', name: 'Sedge' }],
  } as unknown as World);

  it('goes clean again when an edit is undone by hand', () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData(worldWithEntity()); });

    act(() => { result.current.updateEntity({ id: 'e1', name: 'Sedgewick' } as never); });
    expect(result.current.isWorldDirty).toBe(true);

    // Typing the old name back is the revert most authors reach for, and it has to count as one.
    act(() => { result.current.updateEntity({ id: 'e1', name: 'Sedge' } as never); });
    expect(result.current.isWorldDirty).toBe(false);
  });

  it('goes clean again when a field that was never there is filled in and emptied', () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData(worldWithEntity()); });

    // `aliases` is absent on the loaded entity; adding one puts the key there for good.
    act(() => { result.current.updateEntity({ id: 'e1', name: 'Sedge', aliases: ['Sedgy'] } as never); });
    expect(result.current.isWorldDirty).toBe(true);

    act(() => { result.current.updateEntity({ id: 'e1', name: 'Sedge', aliases: [] } as never); });
    expect(result.current.isWorldDirty).toBe(false);
  });

  it('stays clean when a record is rewritten with its keys in another order', () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData({
      ...world('w', {}),
      entities: [{ id: 'e1', name: 'Sedge', type: 'fisher' }],
    } as unknown as World); });

    // Same entity, written the way a manager that rebuilds the record would write it.
    act(() => { result.current.updateEntity({ type: 'fisher', name: 'Sedge', id: 'e1' } as never); });
    expect(result.current.isWorldDirty).toBe(false);
  });

  it('rolls the world back to the last load and clears the dirty flag', () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData(worldWithEntity()); });

    act(() => { result.current.updateEntity({ id: 'e1', name: 'Sedge', model: { name: 'x.glb', data: 'data:x' } } as never); });
    expect(result.current.isWorldDirty).toBe(true);

    act(() => { result.current.discardChanges(); });

    // The edit is gone, not merely re-flagged clean: the pre-edit entity is back verbatim.
    expect(result.current.entities).toEqual([{ id: 'e1', name: 'Sedge' }]);
    expect(result.current.isWorldDirty).toBe(false);
  });

  it('reverts an edit made to a field that was previously absent', () => {
    // The reported bug: a model attached where there was none stayed attached, because nothing rolled it back.
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData(worldWithEntity()); });

    act(() => { result.current.updateEntity({ id: 'e1', name: 'Sedge', model: { name: 'x.glb' } } as never); });
    act(() => { result.current.discardChanges(); });

    expect(result.current.entities[0]).not.toHaveProperty('model');
  });

  it('keeps the world id, so a discard does not orphan the editor from its record', () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData(worldWithEntity()); });

    act(() => { result.current.discardChanges(); });

    expect(result.current.worldId).toBe('w');
  });

  it('is a no-op before any world is loaded', () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.discardChanges(); });
    expect(result.current.entities).toEqual([]);
  });

  it('reverts a never-saved world to the blank it started from', () => {
    // A brand-new world is loaded into the editor but not persisted until Save, so its baseline is the blank
    // itself. Discarding has to land back on that blank rather than on nothing — an empty overview and a
    // missing seed book would leave the editor in a state the author can't recover from.
    const blank = {
      id: 'new',
      worldOverview: {
        name: '', description: '', author: '', thumbnail: null, bgm: null,
        systemPrompt: '', use3DModel: true, tags: [],
      },
      stats: [], locations: [], entities: [], traits: [], statUpdates: [],
      dictionaries: [{ id: 'seed', name: 'Default', enabled: true, entries: [] }],
    } as unknown as World;

    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData(blank, true); });

    act(() => { result.current.updateWorldOverview({ name: 'Half-written world' }); });
    act(() => { result.current.addEntity({ id: 'e1', name: 'Stray' } as never); });
    expect(result.current.isWorldDirty).toBe(true);

    act(() => { result.current.discardChanges(); });

    expect(result.current.worldOverview.name).toBe('');
    expect(result.current.entities).toEqual([]);
    // The seed book has to survive, or the ≥1-book invariant breaks on a discard.
    expect(result.current.dictionaries.map((d) => d.name)).toEqual(['Default']);
    expect(result.current.isWorldDirty).toBe(false);
  });

  it('keeps a migrated world in its current shape across a discard', () => {
    // `discardChanges` reloads through `loadWorldData`, which re-runs `migrateWorld`. That has to be a no-op
    // on an already-migrated world: resurrecting the legacy keys would hand stale field names to the AI, and
    // a non-idempotent migration would corrupt the world every time the author backed out.
    const legacy = {
      id: 'w',
      worldOverview: {
        name: 'Legacy', description: '', author: '', thumbnail: null, bgm: null,
        systemPrompt: '', use3DModel: true, tags: [],
      },
      stats: [], locations: [], traits: [], statUpdates: [],
      entities: [{ id: 'e1', name: 'Sedge', inGameDescription: 'Seen', detailedDescription: 'Known' }],
    } as unknown as World;

    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData(legacy); });
    const migrated = result.current.entities[0];
    expect(migrated).toMatchObject({ playerDescription: 'Seen', aiDescription: 'Known' });

    act(() => { result.current.updateEntity({ ...migrated, name: 'Renamed' } as never); });
    act(() => { result.current.discardChanges(); });

    expect(result.current.entities[0]).toEqual(migrated);
    expect(result.current.entities[0]).not.toHaveProperty('inGameDescription');
    expect(result.current.entities[0]).not.toHaveProperty('detailedDescription');
    expect(result.current.isWorldDirty).toBe(false);
  });

  it('discards back to the most recent load, not the first', () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData(world('a', { readme: "A's readme" })); });
    act(() => { result.current.loadWorldData(world('b', { readme: "B's readme" })); });

    act(() => { result.current.updateWorldOverview({ readme: 'edited' }); });
    act(() => { result.current.discardChanges(); });

    expect(result.current.worldOverview.readme).toBe("B's readme");
  });
});

describe('loadWorldData', () => {
  it("loads the world's own readme", () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData(world('a', { readme: '# Hello' })); });
    expect(result.current.worldOverview.readme).toBe('# Hello');
  });

  it('replaces the overview rather than merging, so no field leaks between worlds', () => {
    const { result } = renderHook(() => useGameData(), { wrapper });

    act(() => { result.current.loadWorldData(world('a', { readme: "A's readme" })); });
    expect(result.current.worldOverview.readme).toBe("A's readme");

    // B has no readme; it must not inherit A's.
    act(() => { result.current.loadWorldData(world('b', {})); });
    expect(result.current.worldOverview.readme).toBeFalsy();
    expect(result.current.worldOverview.name).toBe('b');
  });

  it('keeps the readme out of the dirty baseline, so a freshly loaded world is clean', () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData(world('a', { readme: '# Hello' })); });
    expect(result.current.isWorldDirty).toBe(false);
  });

  it("carries the world's narration prompt override through the load", () => {
    // The normalizer is an allowlist, so a field it forgets is dropped here and the loss is written back
    // by the next saveWorld — the author's prompt would vanish from their own world on reopening it.
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData(world('a', { promptOverrides: { systemPrompt: 'tell it slant' } })); });
    expect(result.current.worldOverview.promptOverrides?.systemPrompt).toBe('tell it slant');
  });

  it("does not leak one world's narration prompt into the next", () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData(world('a', { promptOverrides: { systemPrompt: 'A prompt' } })); });
    act(() => { result.current.loadWorldData(world('b', {})); });
    expect(result.current.worldOverview.promptOverrides).toBeUndefined();
  });
});
