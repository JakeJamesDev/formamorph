import { describe, expect, it } from 'vitest';
import type { Entity, EntityStart, ScheduleRow } from '@/types';
import { diffContent } from './componentUpdates';
import { carryMap, placedIn, withCarriedRoutine } from './entityPresence';
import {
  applyLibraryUpdate, contentMatchesSource, offeredRoutine, planWriteBack, routinePlacesOf, sameRoutine, type LibrarySource,
} from './linkedContent';
import { startsOf, applyingRoutine, withFirstStarts, withFirstTraversable, withFirstRoutine } from '@/lib/entityKind';
import { oneRoutine, withoutTraversable } from '@/test/routines';

// The source's world names its places src-*; the copy's world calls them pier and tavern and has no cellar.
const REFS = [{ id: 'src-dock', name: 'Dock' }, { id: 'src-inn', name: 'Inn' }, { id: 'src-cellar', name: 'Cellar' }];
const CONNECTIONS = { 'src-dock': 'pier', 'src-inn': 'tavern' };
const LOCATIONS = [{ id: 'pier', name: 'Pier' }, { id: 'tavern', name: 'Tavern' }];
const PLACES = routinePlacesOf(LOCATIONS);
const SOURCE: LibrarySource = { id: 'lib-1', name: 'Wren', revision: 'r2', owned: true };

const stay = (id: string, place: string): ScheduleRow => ({ id, time: 'allDay', action: { kind: 'stay', place } });
const start = (id: string, place: string, schedule: ScheduleRow[] = []): EntityStart => ({ id, place, weight: 1, schedule });

const wren = (over: Partial<Entity> = {}): Entity => ({
  id: 'lib-content', name: 'Wren', kind: 'unique', locationRefs: REFS,
  routines: oneRoutine([start('s1', 'src-dock', [stay('r1', 'src-inn')])], ['src-inn', 'src-cellar']), ...over,
});

/** The copy as a fresh add would leave it: the routine carried through the same connections. */
const carried = (source: Entity): Entity => {
  const { locationRefs = [], ...rest } = source;
  const map = carryMap(locationRefs, CONNECTIONS, PLACES.known);
  return { ...placedIn(rest as Entity, map), id: 'copy', link: { libraryId: 'lib-1', sourceRevision: 'r1', connections: map } };
};

const update = (copy: Entity, source: Entity) => applyLibraryUpdate(copy, source, SOURCE, [], PLACES).item;

describe('a library update of an entity with a kind', () => {
  it("moves a row to the copy's mapped place, replacing the copy's own routine edit", () => {
    const copy = withFirstStarts(carried(wren()), [start('own', 'pier', [stay('mine', 'pier')])]);
    const next = update(copy, withFirstStarts(wren(), [start('s1', 'src-dock', [stay('r1', 'src-dock')])]));
    expect(startsOf(next)).toEqual([start('s1', 'pier', [stay('r1', 'pier')])]);
    expect(applyingRoutine(next)?.traversable).toEqual(['tavern']);
  });

  it('drops a row whose place the world has no connection for', () => {
    const next = update(carried(wren()), withFirstStarts(wren(), [start('s1', 'src-dock', [stay('r1', 'src-cellar')])]));
    expect(startsOf(next)).toEqual([start('s1', 'pier')]);
  });

  it('stores no location list, even when the library item still holds one', () => {
    const next = update({ ...carried(wren()), locations: ['pier'] }, wren({ locations: ['src-dock'] }));
    expect('locations' in next).toBe(false);
  });
});

describe('a library update that changes the kind (Q33)', () => {
  // A no-kind source names its membership in its refs; the update carries it as a first add would.
  const plain = (): Entity => ({ id: 'lib-content', name: 'Wren', locationRefs: [REFS[0], REFS[2]], locations: ['src-dock', 'src-cellar'] });

  it("gives a copy that loses its kind the source's membership, mapped, and shows it in the review", () => {
    const copy = carried(wren());
    const next = update(copy, plain());
    expect([next.kind, next.routines]).toEqual([undefined, undefined]);
    expect(next.locations).toEqual(['pier']);
    const rows = diffContent(copy, plain(), undefined, LOCATIONS).changed;
    expect(rows.find((row) => row.field === 'locations')).toEqual({ field: 'locations', label: 'Locations', current: 'Not set', incoming: 'Pier' });
    expect(rows.find((row) => row.field === 'starts')).toMatchObject({ current: 'Start 1 at Pier\n  All day: Stay at Tavern', incoming: 'Not set' });
  });

  it('maps the routine onto a copy that gains a kind and drops its list, and shows both in the review', () => {
    const copy: Entity = { ...carried(plain()), locations: ['pier'] };
    expect(copy.kind).toBeUndefined();
    const next = update(copy, wren());
    expect('locations' in next).toBe(false);
    // The copy connected only the Dock, so the row at the Inn has no place here.
    expect(startsOf(next)).toEqual([start('s1', 'pier')]);
    const rows = diffContent(copy, wren(), undefined, LOCATIONS).changed;
    expect(rows.find((row) => row.field === 'locations')).toMatchObject({ current: 'Pier', incoming: 'Not set' });
    expect(rows.find((row) => row.field === 'starts')).toMatchObject({ current: 'Not set', incoming: 'Start 1 at Pier' });
  });

  it("keeps the stored list of a copy that had no kind before, as today", () => {
    const copy: Entity = { ...carried(plain()), locations: ['tavern'] };
    expect(update(copy, plain()).locations).toEqual(['tavern']);
  });
});

describe('compare and review of a routine', () => {
  it('reads a copy equal to a fresh carry as matching, a fallback Start with a fresh id too', () => {
    expect(contentMatchesSource(carried(wren()), wren(), undefined, undefined, PLACES)).toBe(true);
    // No Start maps, so each carry mints its own fallback Start at the first mapped place.
    const unplaced = withFirstStarts(wren(), [start('s1', 'src-cellar')]);
    const copy = carried(unplaced);
    expect(startsOf(copy)[0].place).toBe('pier');
    expect(contentMatchesSource(withFirstStarts(copy, [{ ...startsOf(copy)[0], id: 'minted-here' }]), unplaced, undefined, undefined, PLACES)).toBe(true);
  });

  it('reads a copy whose routine was edited in the world as differing', () => {
    const copy = carried(wren());
    const edited = withFirstStarts(copy, [{ ...startsOf(copy)[0], weight: 3 }]);
    expect(contentMatchesSource(edited, wren(), undefined, undefined, PLACES)).toBe(false);
    expect(contentMatchesSource(withFirstTraversable(copy, 'anywhere'), wren(), undefined, undefined, PLACES)).toBe(false);
  });

  it('lists the routine change in the review, in place names', () => {
    const copy = withFirstStarts(carried(wren()), [start('own', 'pier', [stay('mine', 'pier')])]);
    const diff = diffContent(copy, wren(), undefined, LOCATIONS);
    expect(diff.changed).toEqual([{
      field: 'starts', label: 'Starts',
      current: 'Start 1 at Pier\n  All day: Stay at Pier',
      incoming: 'Start 1 at Pier\n  All day: Stay at Tavern',
    }]);
    expect(diff.unchanged.find((row) => row.field === 'traversable')).toMatchObject({ label: 'Can Also Go', current: 'Tavern' });
  });

  it('writes nothing back for an owned copy that equals a fresh carry', () => {
    const copy = carried(wren());
    const plan = planWriteBack(
      { entities: [copy], dictionaries: [], locations: LOCATIONS },
      [{ ...SOURCE, revision: 'r1', data: wren() }],
      (item) => item,
    );
    expect(plan).toEqual([]);
  });
});

describe('carry, update, compare and repair', () => {
  it('give the same routine for the same source and connection map', () => {
    for (const source of [wren(), withFirstStarts(wren(), [start('s1', 'src-cellar')]), withoutTraversable(wren({ kind: 'generic' }))]) {
      const fresh = carried(source);
      const stale: Entity = { ...withFirstRoutine(fresh, (routine) => ({ ...routine, starts: [start('old', 'tavern')], traversable: 'anywhere' })) };
      const updated = update(stale, source);
      const repaired = withCarriedRoutine(stale, source, CONNECTIONS, PLACES.known, source.kind!);
      const compared = offeredRoutine(stale, source, source.kind!, PLACES);
      for (const routine of [updated, repaired, compared]) expect(sameRoutine(routine, fresh)).toBe(true);
      expect(contentMatchesSource(fresh, source, undefined, undefined, PLACES)).toBe(true);
    }
  });
});
