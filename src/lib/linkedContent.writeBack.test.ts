import { describe, expect, it } from 'vitest';
import type { ContentLocationRef, Entity, EntityStart, GameLocation, ScheduleRow } from '@/types';
import { carryMap, placedIn } from './entityPresence';
import {
  applyLibraryUpdate, contentMatchesSource, planWriteBack, routinePlacesOf, sameRoutine, type LibrarySource,
} from './linkedContent';
import { toLibraryItem } from './librarySources';
import { unresolvedReferences } from './worldReferences';

const stay = (id: string, place: string): ScheduleRow => ({ id, time: 'allDay', action: { kind: 'stay', place } });
const start = (id: string, place: string, schedule: ScheduleRow[] = []): EntityStart => ({ id, place, weight: 1, schedule });
const loc = (id: string, name: string): GameLocation => ({ id, name });

// The library item names its places src-*. World A connects every one; world B has no cellar and one quay for
// both the Dock and the Pier.
const REFS: ContentLocationRef[] = [
  { id: 'src-dock', name: 'Dock' }, { id: 'src-pier', name: 'Pier' }, { id: 'src-inn', name: 'Inn' }, { id: 'src-cellar', name: 'Cellar' },
];
const LIBRARY: Entity = {
  id: 'lib-content', name: 'Wren', kind: 'unique', locationRefs: REFS,
  starts: [
    start('s1', 'src-dock', [stay('r1', 'src-inn'), stay('r2', 'src-cellar')]),
    start('s2', 'src-pier'),
    start('s3', 'src-cellar', [stay('r3', 'src-cellar')]),
  ],
  traversable: ['src-inn', 'src-cellar'],
};

interface World {
  locations: GameLocation[];
  connections: Record<string, string>;
}

const WORLD_A: World = {
  locations: [loc('a-dock', 'Dock'), loc('a-pier', 'Pier'), loc('a-inn', 'Inn'), loc('a-cellar', 'Cellar')],
  connections: { 'src-dock': 'a-dock', 'src-pier': 'a-pier', 'src-inn': 'a-inn', 'src-cellar': 'a-cellar' },
};
const WORLD_B: World = {
  locations: [loc('b-quay', 'Quay'), loc('b-bar', 'Bar'), loc('b-garden', 'Garden')],
  connections: { 'src-dock': 'b-quay', 'src-pier': 'b-quay', 'src-inn': 'b-bar' },
};

const placesOf = (world: World) => routinePlacesOf(world.locations);
const source = (data: Entity, revision: string): LibrarySource => ({ id: 'lib-1', name: 'Wren', revision, owned: true, data });

/** A world's copy of `library` as a first add leaves it. */
function carried(library: Entity, world: World): Entity {
  const { locationRefs = [], ...rest } = library;
  const map = carryMap(locationRefs, world.connections, placesOf(world).known);
  return { ...placedIn(rest as Entity, map), id: 'copy', link: { libraryId: 'lib-1', sourceRevision: 'r1', connections: world.connections } };
}

/** The world save's write-back of `copy`, and the library item it leaves. */
function writeBack(copy: Entity, world: World, library = LIBRARY) {
  const plan = planWriteBack(
    { entities: [copy], dictionaries: [], locations: world.locations },
    [source(library, 'r1')],
    (item) => toLibraryItem(item, [], world.locations),
  );
  expect(plan).toHaveLength(1);
  const item = { ...plan[0].content, id: 'lib-content' } as Entity;
  const written: Entity = { ...copy, link: { ...copy.link!, sourceRevision: 'r2', connections: plan[0].connections } };
  return { item, written };
}

const update = (copy: Entity, item: Entity, world: World) => applyLibraryUpdate(copy, item, source(item, 'r2'), [], placesOf(world)).item;

/** World B's copy with a row added at the Garden, which B never connected to the library item. */
function editedInB(): Entity {
  const copy = carried(LIBRARY, WORLD_B);
  const [s1, ...rest] = copy.starts!;
  return { ...copy, starts: [{ ...s1, schedule: [...s1.schedule, stay('r9', 'b-garden')] }, ...rest] };
}

describe("a write-back from one world, then an update in another (Q30, Q34)", () => {
  it("leaves world A's copy every place it has a connection for", () => {
    const { item } = writeBack(editedInB(), WORLD_B);
    const next = update(carried(LIBRARY, WORLD_A), item, WORLD_A);
    // The Garden row is the one row A cannot place; everything else A had stays.
    expect(sameRoutine(next, carried(LIBRARY, WORLD_A))).toBe(true);
  });

  it('keeps the Cellar Start, the Cellar row in its old place, and the Cellar in Can Also Go', () => {
    const { item } = writeBack(editedInB(), WORLD_B);
    expect(item.starts).toEqual([
      start('s1', 'src-dock', [stay('r1', 'src-inn'), stay('r2', 'src-cellar'), stay('r9', 'b-garden')]),
      start('s2', 'src-pier'),
      start('s3', 'src-cellar', [stay('r3', 'src-cellar')]),
    ]);
    expect(item.traversable).toEqual(['src-inn', 'src-cellar']);
  });

  it('keeps the Dock and the Pier distinct though world B connected both to one place (Q35)', () => {
    const { item } = writeBack(editedInB(), WORLD_B);
    expect(item.starts!.map((s) => s.place).slice(0, 2)).toEqual(['src-dock', 'src-pier']);
  });

  it('sends a moved Start back to the first library place carried to its new place (Q35)', () => {
    const copy = editedInB();
    const moved = { ...copy, starts: copy.starts!.map((s) => (s.id === 's2' ? { ...s, place: 'b-bar' } : s)) };
    expect(writeBack(moved, WORLD_B).item.starts![1].place).toBe('src-inn');
  });

  it('drops the kept rows of a Start the author deleted in world B (Q34)', () => {
    const copy = editedInB();
    const { item } = writeBack({ ...copy, starts: copy.starts!.filter((s) => s.id !== 's1') }, WORLD_B);
    expect(item.starts).toEqual([start('s2', 'src-pier'), start('s3', 'src-cellar', [stay('r3', 'src-cellar')])]);
  });

  it('names a place added in world B as a new library place, which world A sees as unconnected (Q21, Q36)', () => {
    const { item } = writeBack(editedInB(), WORLD_B);
    expect(item.locationRefs).toEqual([
      { id: 'src-dock', name: 'Dock' }, { id: 'src-inn', name: 'Inn' }, { id: 'src-cellar', name: 'Cellar' },
      { id: 'b-garden', name: 'Garden' }, { id: 'src-pier', name: 'Pier' },
    ]);
    const open = unresolvedReferences(item, { placeholders: [], locations: WORLD_A.locations }, WORLD_A.connections);
    expect(open.map((row) => [row.kind, row.key])).toEqual([['location', 'b-garden']]);
  });
});

describe('a fallback Start the carry minted (Q37)', () => {
  // World B connects only the Dock and the Inn, so no library Start carries and the carry mints a fallback.
  const cellarOnly = (kind: Entity['kind']): Entity => ({
    ...LIBRARY, kind, starts: [start('s3', 'src-cellar', [stay('r3', 'src-cellar')])], traversable: undefined,
  });
  const described = (copy: Entity): Entity => ({ ...copy, playerDescription: 'A ferryman.' });

  it('stays out of the library item of a Unique entity', () => {
    const copy = carried(cellarOnly('unique'), WORLD_B);
    expect(copy.starts).toEqual([expect.objectContaining({ place: 'b-quay', schedule: [] })]);
    expect(writeBack(described(copy), WORLD_B, cellarOnly('unique')).item.starts).toEqual(cellarOnly('unique').starts);
  });

  it('goes back once the author gives it a new weight', () => {
    const copy = carried(cellarOnly('unique'), WORLD_B);
    const weighted = { ...copy, starts: [{ ...copy.starts![0], weight: 3 }] };
    const { item } = writeBack(weighted, WORLD_B, cellarOnly('unique'));
    expect(item.starts!.map((s) => [s.place, s.weight])).toEqual([['src-cellar', 1], ['src-dock', 3]]);
  });

  it('stays out of the library item of a Generic entity, one per mapped place', () => {
    const copy = carried(cellarOnly('generic'), WORLD_B);
    expect(copy.starts!.map((s) => s.place)).toEqual(['b-quay', 'b-bar']);
    expect(writeBack(described(copy), WORLD_B, cellarOnly('generic')).item.starts).toEqual(cellarOnly('generic').starts);
  });
});

describe('a plain Start the author added while a library Start carried (Q40)', () => {
  // World B connects the Dock and not the Cellar, so s1 carries and s3 stays behind; the carry mints no fallback.
  const dockAndCellar: Entity = {
    ...LIBRARY, kind: 'generic', starts: [start('s1', 'src-dock'), start('s3', 'src-cellar', [stay('r3', 'src-cellar')])], traversable: undefined,
  };

  it('goes back to the library item', () => {
    const copy = carried(dockAndCellar, WORLD_B);
    expect(copy.starts!.map((s) => [s.id, s.place])).toEqual([['s1', 'b-quay']]);
    const added = { ...copy, starts: [...copy.starts!, start('mine', 'b-bar')] };
    const { item } = writeBack(added, WORLD_B, dockAndCellar);
    expect(item.starts!.map((s) => [s.id, s.place])).toEqual([['s1', 'src-dock'], ['s3', 'src-cellar'], ['mine', 'src-inn']]);
  });
});

describe('Can Also Go written back (Q38)', () => {
  it('replaces the list with Anywhere', () => {
    expect(writeBack({ ...editedInB(), traversable: 'anywhere' }, WORLD_B).item.traversable).toBe('anywhere');
  });

  it('keeps the uncarried entries when the author clears the list', () => {
    const { traversable: _cleared, ...copy } = editedInB();
    expect(writeBack(copy, WORLD_B).item.traversable).toEqual(['src-cellar']);
    expect(writeBack({ ...copy, traversable: [] }, WORLD_B).item.traversable).toEqual(['src-cellar']);
  });
});

describe('a membership written back (Q39)', () => {
  const library: Entity = { id: 'lib-content', name: 'Wren', locationRefs: [{ id: 'src-inn', name: 'Inn' }, { id: 'src-cellar', name: 'Cellar' }] };
  const copy: Entity = {
    id: 'copy', name: 'Wren', playerDescription: 'A ferryman.', locations: ['b-bar', 'b-garden'],
    link: { libraryId: 'lib-1', sourceRevision: 'r1', connections: WORLD_B.connections },
  };

  it('names connected places as the library does, keeps the ones world B lacks, and adds the new one', () => {
    const { item, written } = writeBack(copy, WORLD_B, library);
    expect(item.locationRefs).toEqual([{ id: 'src-inn', name: 'Inn' }, { id: 'src-cellar', name: 'Cellar' }, { id: 'b-garden', name: 'Garden' }]);
    expect(written.link?.connections).toEqual({ ...WORLD_B.connections, 'b-garden': 'b-garden' });
  });
});

describe('world B right after its write-back', () => {
  it('connects the new place and reads as its library item', () => {
    const { item, written } = writeBack(editedInB(), WORLD_B);
    expect(written.link?.connections).toEqual({ ...WORLD_B.connections, 'b-garden': 'b-garden' });
    expect(contentMatchesSource(written, item, undefined, undefined, placesOf(WORLD_B))).toBe(true);
    const again = planWriteBack(
      { entities: [written], dictionaries: [], locations: WORLD_B.locations },
      [source(item, 'r2')],
      (copy) => toLibraryItem(copy, [], WORLD_B.locations),
    );
    expect(again).toEqual([]);
  });

  it('gets the same routine back from an update, Start and row ids aside', () => {
    const edited = editedInB();
    const { item, written } = writeBack(edited, WORLD_B);
    expect(sameRoutine(update(written, item, WORLD_B), edited)).toBe(true);
  });
});

describe('On Map through the library', () => {
  it('keeps its value from a save in world A to a copy in world B', () => {
    const inA = { ...carried(LIBRARY, WORLD_A), onMap: 'whenNearby' as const };
    const item = { ...toLibraryItem(inA, [], WORLD_A.locations), id: 'lib-content' } as Entity;
    expect(item.onMap).toBe('whenNearby');
    expect(carried(item, WORLD_B).onMap).toBe('whenNearby');
  });
});

describe('a linked copy with no kind', () => {
  // A library item names its places in refs; the world copy holds its own list and no refs (Q2).
  const library: Entity = { id: 'lib-content', name: 'Wren', playerDescription: 'A ferryman.', locationRefs: [{ id: 'src-inn', name: 'Inn' }] };
  const copy: Entity = {
    id: 'copy', name: 'Wren', playerDescription: 'A ferryman.', locations: ['a-inn'],
    link: { libraryId: 'lib-1', sourceRevision: 'r1', connections: { 'src-inn': 'a-inn' } },
  };

  it('matches its library item, with or without the world named', () => {
    expect(contentMatchesSource(copy, library)).toBe(true);
    expect(contentMatchesSource(copy, library, undefined, undefined, placesOf(WORLD_A))).toBe(true);
  });

  it('differs once its description changes', () => {
    expect(contentMatchesSource({ ...copy, playerDescription: 'A ferryman, retired.' }, library)).toBe(false);
  });

  it('writes nothing back while it equals its library item', () => {
    const plan = planWriteBack(
      { entities: [copy], dictionaries: [], locations: WORLD_A.locations },
      [source(library, 'r1')],
      (item) => toLibraryItem(item, [], WORLD_A.locations),
    );
    expect(plan).toEqual([]);
  });
});
