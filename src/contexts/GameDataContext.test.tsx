import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { GameDataProvider, useGameData } from './GameDataContext';
import type { World } from '@/types';

import { phValueId, phValues } from '@/test/placeholderValues';
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

describe('the Custom Persona entity in the world store', () => {
  const links = [
    { id: 'l1', originalId: 'paladin', kind: 'trait', originalName: 'Paladin', groupId: null },
    { id: 'l2', originalId: 'brave', kind: 'trait', originalName: 'Brave', groupId: null },
  ];
  const you = { id: 'you', name: 'Wanderer', customPersona: true, traitLinks: links, traitPlacement: { groupId: null, order: 3 } };
  const withPersona = {
    ...world('w', {}),
    traits: [{ id: 'paladin', name: 'Paladin', statChanges: [], groupId: 'blueprints' }, { id: 'brave', name: 'Brave', statChanges: [], groupId: 'blueprints' }],
    traitGroups: [{ id: 'blueprints', name: 'Blueprints', parentId: null, system: 'blueprints' }],
    entities: [you],
  } as unknown as World;
  const marked = (result: { current: ReturnType<typeof useGameData> }) => result.current.entities.find((e) => e.customPersona);

  it('loads, saves and discards the mark with the world, clean on load', () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData(withPersona); });
    expect(marked(result)).toMatchObject({ id: 'you', customPersona: true, traitLinks: links });
    expect(result.current.getWorldData().entities[0].customPersona).toBe(true);
    expect(result.current.isWorldDirty).toBe(false);

    const { customPersona: _mark, ...unmarked } = result.current.entities[0];
    act(() => { result.current.updateEntity(unmarked); });
    expect(result.current.isWorldDirty).toBe(true);
    expect(result.current.getWorldData().entities[0]).not.toHaveProperty('customPersona');
    act(() => { result.current.discardChanges(); });
    expect(marked(result)).toMatchObject({ id: 'you', traitLinks: links });
  });

  it('reads no Custom Persona node off a world that still carries one', () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData({ ...withPersona, customPersona: { traitLinks: links } } as unknown as World); });
    expect(result.current.getWorldData()).not.toHaveProperty('customPersona');
    expect(marked(result)?.traitLinks).toEqual(links);
  });

  it("deleting an original deletes the Custom Persona entity's links to it", () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData(withPersona); });
    act(() => { result.current.removeTrait('paladin'); });
    expect(marked(result)?.traitLinks?.map((l) => l.id)).toEqual(['l2']);
  });

  it("removing Blueprints detaches the Custom Persona entity's links into its own traits and moves the unlinked rest up (Q11)", () => {
    const withLoner = {
      ...withPersona,
      traits: [...(withPersona.traits as unknown[]), { id: 'loner', name: 'Loner', statChanges: [], groupId: 'blueprints' }],
    } as unknown as World;
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData(withLoner); });
    expect(marked(result)?.traitLinks).toEqual(links);
    act(() => { result.current.removeTraitGroup('blueprints'); });
    expect(result.current.traitGroups).toEqual([]);
    expect(result.current.traits.map((t) => [t.id, t.groupId])).toEqual([['loner', null]]);
    expect(marked(result)).not.toHaveProperty('traitLinks');
    expect(marked(result)?.traits?.map((t) => t.name).sort()).toEqual(['Brave', 'Paladin']);
  });

  it('removing Blueprints inside another group still moves its unlinked traits to the top level', () => {
    const nested = {
      ...withPersona,
      entities: [],
      traitGroups: [{ id: 'lore', name: 'Lore', parentId: null }, { id: 'blueprints', name: 'Blueprints', parentId: 'lore', system: 'blueprints' }],
    } as unknown as World;
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData(nested); });
    act(() => { result.current.removeTraitGroup('blueprints'); });
    expect(result.current.traits.find((t) => t.id === 'paladin')?.groupId).toBeNull();
  });
});

describe('placeholder copies in the world store', () => {
  const garb = { id: 'garb', name: 'Class Garb', values: [{ id: 'tabard', text: 'a tabard' }], groupId: 'bp' };
  const pinned = {
    ...world('w', {}),
    traits: [{ id: 'paladin', name: 'Paladin', statChanges: [], groupId: 'blueprints', placeholderPins: [{ placeholderId: 'garb', value: 'a tabard', valueId: 'tabard' }] }],
    traitGroups: [{ id: 'blueprints', name: 'Blueprints', parentId: null, system: 'blueprints' }],
    entities: [{ id: 'ash', name: 'Ash', traitLinks: [{ id: 'l1', originalId: 'paladin', kind: 'trait', originalName: 'Paladin', groupId: null }] }, { id: 'bob', name: 'Bob' }],
    placeholders: [garb],
    placeholderGroups: [{ id: 'bp', name: 'Blueprints', parentId: null, system: 'blueprints' }],
  } as unknown as World;
  const copies = (result: { current: ReturnType<typeof useGameData> }, id: string) =>
    (result.current.entities.find((e) => e.id === id)?.placeholders ?? []).map((p) => p.blueprintId);

  it('gives a bearer its copies on load, clean, and writes them into the payload', () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData(pinned); });
    expect(copies(result, 'ash')).toEqual(['garb']);
    expect(copies(result, 'bob')).toEqual([]);
    expect(result.current.getWorldData().entities[0].placeholders?.[0]).toMatchObject({ name: 'Class Garb', blueprintId: 'garb' });
    expect(result.current.isWorldDirty).toBe(false);
  });

  it('creates a copy when a link joins an entity and takes it back when the link goes', () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData(pinned); });
    const bob = result.current.entities.find((e) => e.id === 'bob')!;
    act(() => { result.current.updateEntity({ ...bob, traitLinks: [{ id: 'l2', originalId: 'paladin', kind: 'trait', originalName: 'Paladin', groupId: null }] }); });
    expect(copies(result, 'bob')).toEqual(['garb']);
    const { traitLinks: _l, ...unlinked } = result.current.entities.find((e) => e.id === 'bob')!;
    act(() => { result.current.updateEntity(unlinked); });
    expect(copies(result, 'bob')).toEqual([]);
  });

  it('creates a copy when a pin joins an original that already has a bearer', () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    const { placeholderPins: _p, ...bare } = pinned.traits[0];
    act(() => { result.current.loadWorldData({ ...pinned, traits: [bare] }); });
    expect(copies(result, 'ash')).toEqual([]);
    act(() => { result.current.updateTrait(pinned.traits[0]); });
    expect(copies(result, 'ash')).toEqual(['garb']);
  });
});

describe('trait links when an original goes', () => {
  const linked = {
    ...world('w', {}),
    traits: [{ id: 'paladin', name: 'Paladin', statChanges: [], groupId: 'classes' }, { id: 'brave', name: 'Brave', statChanges: [], groupId: 'blueprints' }],
    traitGroups: [
      { id: 'blueprints', name: 'Blueprints', parentId: null, system: 'blueprints' },
      { id: 'classes', name: 'Classes', parentId: 'blueprints' },
    ],
    entities: [
      { id: 'ash', name: 'Ash', traitLinks: [
        { id: 'l1', originalId: 'paladin', kind: 'trait', originalName: 'Paladin', groupId: null },
        { id: 'l2', originalId: 'classes', kind: 'group', originalName: 'Classes', groupId: null },
      ] },
      { id: 'bob', name: 'Bob', traitLinks: [{ id: 'l3', originalId: 'brave', kind: 'trait', originalName: 'Brave', groupId: null }] },
    ],
  } as unknown as World;

  it('deleting a trait deletes its links and nothing else', () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData(linked); });
    act(() => { result.current.removeTrait('paladin'); });
    expect(result.current.entities.map((e) => e.traitLinks?.map((l) => l.id))).toEqual([['l2'], ['l3']]);
  });

  it('deleting a group deletes the links to it; its children and their links stay', () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData(linked); });
    act(() => { result.current.removeTraitGroup('classes'); });
    expect(result.current.entities.map((e) => e.traitLinks?.map((l) => l.id))).toEqual([['l1'], ['l3']]);
    expect(result.current.traits.find((t) => t.id === 'paladin')?.groupId).toBe('blueprints');
  });

  it('leaves the entities untouched when nothing linked the deleted trait', () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData({ ...linked, traits: [...linked.traits, { id: 'lone', name: 'Lone', statChanges: [] }] } as World); });
    const before = result.current.entities;
    act(() => { result.current.removeTrait('lone'); });
    expect(result.current.entities).toBe(before);
  });
});

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

  it('moves the sub-locations of a deleted location up to its parent', () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData({
      ...world('w', {}),
      locations: [
        { id: 'l1', name: 'Harbor' },
        { id: 'l2', name: 'Dock', parentId: 'l1' },
        { id: 'l3', name: 'Shed', parentId: 'l2' },
      ],
    } as unknown as World); });

    act(() => { result.current.removeLocation('l2'); });

    expect(result.current.locations.map((l) => [l.id, l.parentId ?? null])).toEqual([['l1', null], ['l3', 'l1']]);
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
      { id: 'c1', a: 'l1', b: 'l2', aToB: {}, bToA: {} },
      { id: 'c2', a: 'l3', b: 'l1', aToB: {} },
      { id: 'c3', a: 'l2', b: 'l3', aToB: {}, bToA: {} },
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

  it("carries an exported world's Introduction readme back through import, and not into the next world", () => {
    // Exported as JSON and imported through the same load path, so the round trip covers what a shared
    // world actually goes through. The normalizer is an allowlist: a field it forgets is dropped on load
    // and the loss is written back by the next saveWorld, and one it merges instead of replacing carries
    // into the world loaded after.
    const { result } = renderHook(() => useGameData(), { wrapper });
    const exported = JSON.parse(JSON.stringify(world('a', { introReadme: '# Before you choose' })));

    act(() => { result.current.loadWorldData(exported); });
    expect(result.current.worldOverview.introReadme).toBe('# Before you choose');

    act(() => { result.current.loadWorldData(world('b', {})); });
    expect(result.current.worldOverview.introReadme).toBeFalsy();
  });

  it('loads a world exported before Introductions existed with no Introduction and no error', () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData(world('old', { readme: '# Gameplay only' })); });
    expect(result.current.worldOverview.readme).toBe('# Gameplay only');
    expect(result.current.worldOverview.introReadme).toBeUndefined();
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

  const OPENINGS = [{ id: 'o1', text: 'You wake in the reed-beds.', kind: 'action' as const }];

  it("carries the world's openings, weights and switch through the load", () => {
    // Same allowlist trap as the prompt override above: a dropped list is written back by the next
    // saveWorld, so the author's openings would vanish from their own world on reopening it.
    const { result } = renderHook(() => useGameData(), { wrapper });
    const exported = JSON.parse(JSON.stringify(
      world('a', { openings: OPENINGS, openingWeights: { o1: 3 }, openingsEnabled: false }),
    ));
    act(() => { result.current.loadWorldData(exported); });
    expect(result.current.worldOverview.openings).toEqual(OPENINGS);
    expect(result.current.worldOverview.openingWeights).toEqual({ o1: 3 });
    expect(result.current.worldOverview.openingsEnabled).toBe(false);
  });

  it('loads an old single cue as the first row of the list', () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    const legacy = world('a', { openingCue: 'You wake in the reed-beds.' });
    act(() => { result.current.loadWorldData(legacy); });
    expect(result.current.worldOverview.openings?.map((o) => o.text)).toEqual(['You wake in the reed-beds.']);
    expect(result.current.worldOverview.openingsEnabled).toBeUndefined();
  });

  it("does not leak one world's openings into the next", () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData(world('a', { openings: OPENINGS, openingsEnabled: false })); });
    act(() => { result.current.loadWorldData(world('b', {})); });
    expect(result.current.worldOverview.openings).toBeUndefined();
    expect(result.current.worldOverview.openingsEnabled).toBeUndefined();
  });

  it("carries the world's persona rules through the load, and does not leak them into the next world", () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    const rules = { allowedPersonas: 'world', startPersona: { source: 'world', entityId: 'w' } } as const;
    act(() => { result.current.loadWorldData(JSON.parse(JSON.stringify(world('a', rules)))); });
    expect(result.current.worldOverview.allowedPersonas).toBe('world');
    expect(result.current.worldOverview.startPersona).toEqual({ source: 'world', entityId: 'w' });
    act(() => { result.current.loadWorldData(world('b', {})); });
    expect(result.current.worldOverview.allowedPersonas).toBeUndefined();
    expect(result.current.worldOverview.startPersona).toBeUndefined();
  });
});

describe('renaming a placeholder value', () => {
  // A pin written before value ids existed holds a plain string, so only the update path can connect a
  // rename to the traits.
  const worldWithPins = () => ({
    ...world('w', {}),
    placeholders: [
      { id: 'hair', name: 'Hair Color', values: phValues(['Red', 'Blue']) },
      { id: 'eyes', name: 'Eye Color', values: phValues(['Red']) },
    ],
    traits: [
      { id: 't1', name: 'Ember', statChanges: [], placeholderPins: [{ placeholderId: 'hair', value: 'Red' }] },
      { id: 't2', name: 'Glass', statChanges: [], placeholderPins: [{ placeholderId: 'eyes', value: 'Red' }] },
    ],
  } as unknown as World);

  it('carries the trait pins that targeted it, and leaves another placeholder holding the same string alone', () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData(worldWithPins()); });

    act(() => {
      // What the editor writes: the value keeps its id and only its text changes.
      result.current.updatePlaceholder({
        id: 'hair',
        name: 'Hair Color',
        values: [{ id: phValueId('Red'), text: 'Crimson' }, ...phValues(['Blue'])],
      });
    });

    expect(result.current.traits[0].placeholderPins).toEqual([{ placeholderId: 'hair', value: 'Crimson' }]);
    expect(result.current.traits[1].placeholderPins).toEqual([{ placeholderId: 'eyes', value: 'Red' }]);
  });

  it('routes the editing widgets through the same sweep, so the placeholder editor propagates too', () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData(worldWithPins()); });

    act(() => {
      result.current.phStore.updatePlaceholder({
        id: 'hair',
        name: 'Hair Color',
        values: [{ id: phValueId('Red'), text: 'Crimson' }, ...phValues(['Blue'])],
      });
    });

    expect(result.current.traits[0].placeholderPins).toEqual([{ placeholderId: 'hair', value: 'Crimson' }]);
  });
});

describe('placeholders an entity or a book carries', () => {
  const EYES = { id: 'eyes', name: 'Eyes', values: phValues(['amber']) };
  const scopedWorld = () => ({
    ...world('w', {}),
    placeholders: [{ id: 'shared', name: 'Weather', values: phValues(['rain']) }],
    entities: [{ id: 'molly', name: 'Molly', placeholders: [EYES] }],
    dictionaries: [{ id: 'book', name: 'Fen', entries: [], placeholders: [{ id: 'lore', name: 'Lore', values: phValues(['the Fen']) }] }],
  } as unknown as World);
  const load = () => {
    const hook = renderHook(() => useGameData(), { wrapper });
    act(() => { hook.result.current.loadWorldData(scopedWorld()); });
    return hook.result;
  };

  it("reads one combined list: the world's, then each entity's, then each book's", () => {
    const result = load();
    expect(result.current.placeholders.map((p) => p.id)).toEqual(['shared', 'eyes', 'lore']);
    expect(result.current.worldPlaceholders.map((p) => p.id)).toEqual(['shared']);
  });

  it('lands a write to a scoped placeholder on the entity, not the world list', () => {
    const result = load();
    act(() => { result.current.phStore.updatePlaceholder({ ...EYES, name: 'Eye Color' }); });
    expect(result.current.entities[0].placeholders?.[0].name).toBe('Eye Color');
    expect(result.current.worldPlaceholders.map((p) => p.id)).toEqual(['shared']);
    expect(result.current.placeholders.find((p) => p.id === 'eyes')?.name).toBe('Eye Color');
  });

  it('adds to the home a create names, and to the world list when none is named', () => {
    const result = load();
    const tale = { id: 'tale', name: 'Tale', values: phValues(['x']) };
    const mood = { id: 'mood', name: 'Mood', values: phValues(['y']) };
    act(() => { result.current.phStore.addPlaceholder(tale, { kind: 'dictionary', ownerId: 'book' }); });
    act(() => { result.current.phStore.addPlaceholder(mood); });
    expect(result.current.dictionaries[0].placeholders?.map((p) => p.id)).toEqual(['lore', 'tale']);
    expect(result.current.worldPlaceholders.map((p) => p.id)).toEqual(['shared', 'mood']);
  });

  it('puts a part created from inside a scoped holder beside that holder, not on the world list', () => {
    // What the typeahead's inline create writes: a placeholder born with its holder as owner.
    const result = load();
    act(() => { result.current.phStore.addPlaceholder({ id: 'iris', name: 'Iris', values: phValues(['gold']), ownerId: 'eyes' }); });
    expect(result.current.entities[0].placeholders?.map((p) => p.id)).toEqual(['eyes', 'iris']);
    expect(result.current.worldPlaceholders.map((p) => p.id)).toEqual(['shared']);
  });

  it('removes a scoped placeholder from its entity and leaves the world list alone', () => {
    const result = load();
    act(() => { result.current.phStore.removePlaceholder('eyes'); });
    expect('placeholders' in result.current.entities[0]).toBe(false);
    expect(result.current.worldPlaceholders).toHaveLength(1);
    expect(result.current.placeholders.map((p) => p.id)).toEqual(['shared', 'lore']);
  });

  it('routes a whole-list write back to the list that holds each id', () => {
    const result = load();
    act(() => {
      result.current.phStore.setPlaceholders((prev) => prev.map((p) => (p.id === 'lore' ? { ...p, name: 'Tale' } : p)));
    });
    expect(result.current.dictionaries[0].placeholders?.[0].name).toBe('Tale');
    expect(result.current.worldPlaceholders.map((p) => p.name)).toEqual(['Weather']);
  });

  it('keeps the combined list by identity across an edit that touches no placeholder', () => {
    const result = load();
    const before = result.current.placeholders;
    act(() => { result.current.updateEntity({ ...result.current.entities[0], playerDescription: 'A fen girl.' }); });
    expect(result.current.entities[0].playerDescription).toBe('A fen girl.');
    expect(result.current.placeholders).toBe(before);
  });

  it("takes an entity's placeholders with it when the entity goes", () => {
    const result = load();
    act(() => { result.current.removeEntity('molly'); });
    expect(result.current.placeholders.map((p) => p.id)).toEqual(['shared', 'lore']);
  });
});
