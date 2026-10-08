import { describe, it, expect } from 'vitest';
import { createHistory, diffSlice, record, type SliceEdit, type SliceName, type Step, type WorldSlices } from '@/lib/editorHistory';
import { revealTarget, revealTargetForMove } from '@/lib/historyReveal';
import type {
  Connection, Dictionary, DictionaryEntry, Entity, GameLocation, Stat, StatUpdate, Trait, WorldOverview,
} from '@/types';

/** A moved Step names the tab and the record the editor shows the author afterward. */

const stat = (id: string): Stat => ({ id, name: id } as unknown as Stat);
const location = (id: string): GameLocation => ({ id, name: id } as GameLocation);
const connection = (id: string): Connection => ({ id } as unknown as Connection);
const overview = (name: string): WorldOverview => ({ name } as unknown as WorldOverview);

const emptyWorld = (over: Partial<WorldSlices> = {}): WorldSlices => ({
  worldOverview: overview('Sedge Landing'), stats: [], locations: [], connections: [], entities: [], entityGroups: [],
  traits: [], traitGroups: [], statUpdates: [], dictionaries: [], placeholders: [], placeholderGroups: [],
  ...over,
});

/** The Step a write from `prev` to `next` records on its slice. */
const stepOf = <S extends SliceName>(slice: S, prev: WorldSlices[S], next: WorldSlices[S]): Step => {
  const edit = diffSlice(slice, prev, next) as SliceEdit;
  return record(createHistory(), [edit]).steps[0];
};

describe('revealTarget', () => {
  it('names the stat an edit rewrote, on the Stats tab', () => {
    const before = [stat('hunger'), stat('thirst')];
    const after = [before[0], { ...before[1], name: 'Thirst' }];
    expect(revealTarget(stepOf('stats', before, after), emptyWorld({ stats: before })))
      .toEqual({ tab: 'stats', id: 'thirst' });
  });

  it('marks a record the move removed as gone', () => {
    const added = [stat('hunger')];
    const step = stepOf('stats', [], added);
    expect(revealTarget(step, emptyWorld({ stats: [] }))).toEqual({ tab: 'stats', id: 'hunger', gone: true });
    expect(revealTarget(step, emptyWorld({ stats: added }))).toEqual({ tab: 'stats', id: 'hunger' });
  });

  it('sends a connection to the Locations tab as a connection', () => {
    const wire = [connection('c1')];
    expect(revealTarget(stepOf('connections', [], wire), emptyWorld({ connections: wire })))
      .toEqual({ tab: 'locations', id: 'c1', connection: true });
    expect(revealTarget(stepOf('connections', [], wire), emptyWorld()))
      .toEqual({ tab: 'locations', id: 'c1', connection: true, gone: true });
  });

  it('opens the Overview tab for an overview field, with no record', () => {
    const step = stepOf('worldOverview', overview('Sedge Landing'), overview('Fen'));
    expect(revealTarget(step, emptyWorld())).toEqual({ tab: 'overview' });
  });

  it('opens the tab alone for a reorder, which touches no record', () => {
    const [a, b] = [location('a'), location('b')];
    expect(revealTarget(stepOf('locations', [a, b], [b, a]), emptyWorld({ locations: [a, b] })))
      .toEqual({ tab: 'locations' });
  });

  it('takes the first slice edit that has a tab, and the first record in it', () => {
    const update: StatUpdate = { id: 'u1', name: 'u1', prompt: '', stats: [], messageHistory: [] };
    const edits = [
      diffSlice('statUpdates', [], [update]),
      diffSlice('stats', [], [stat('a'), stat('b')]),
    ] as SliceEdit[];
    const [step] = record(createHistory(), edits).steps;
    expect(revealTarget(step, emptyWorld({ stats: [stat('a'), stat('b')] }))).toEqual({ tab: 'stats', id: 'a' });
  });

  describe('a dictionary book', () => {
    const entry = (id: string, value = ''): DictionaryEntry => ({ id, name: id, key: [], value });
    const book = (entries: DictionaryEntry[]): Dictionary => ({ id: 'lore', name: 'Lore', entries });

    it('names the entry an edit changed', () => {
      const [a, b] = [entry('a'), entry('b')];
      const before = [book([a, b])];
      const after = [book([a, { ...b, value: 'moss' }])];
      expect(revealTarget(stepOf('dictionaries', before, after), emptyWorld({ dictionaries: before })))
        .toEqual({ tab: 'dictionary', id: 'b' });
    });

    it('names the book when the entry the Step added is gone', () => {
      const a = entry('a');
      const before = [book([a])];
      const after = [book([a, entry('b')])];
      expect(revealTarget(stepOf('dictionaries', before, after), emptyWorld({ dictionaries: before })))
        .toEqual({ tab: 'dictionary', id: 'lore' });
    });

    it('names the added entry when the move brings it back', () => {
      const a = entry('a');
      const before = [book([a])];
      const after = [book([a, entry('b')])];
      expect(revealTarget(stepOf('dictionaries', before, after), emptyWorld({ dictionaries: after })))
        .toEqual({ tab: 'dictionary', id: 'b' });
    });

    it('marks a removed book as gone', () => {
      const before = [book([entry('a')])];
      expect(revealTarget(stepOf('dictionaries', before, []), emptyWorld()))
        .toEqual({ tab: 'dictionary', id: 'lore', gone: true });
    });
  });

  describe('a Step that rewrote two slices', () => {
    const trait = { id: 'paladin', name: 'Paladin' } as unknown as Trait;
    const wick = { id: 'wick', name: 'Wick' } as unknown as Entity;
    const rewrittenWick = { ...wick, name: 'Sir Wick' };
    const edits = () => [
      diffSlice('entities', [wick], [rewrittenWick]),
      diffSlice('traits', [trait], []),
    ] as SliceEdit[];

    it('leads with the slice that lost a record, not the one a cascade rewrote', () => {
      const [step] = record(createHistory(), edits()).steps;
      expect(revealTarget(step, emptyWorld({ traits: [trait], entities: [wick] })))
        .toEqual({ tab: 'traits', id: 'paladin' });
    });

    it('leads with the keyed slice when the write names one', () => {
      const [step] = record(createHistory(), [
        diffSlice('entities', [wick], [{ ...rewrittenWick }]),
        diffSlice('traits', [trait], [{ ...trait, name: 'Knight' }]),
      ] as SliceEdit[], { key: { slice: 'traits', id: 'paladin', field: 'name' } }).steps;
      expect(revealTarget(step, emptyWorld({ traits: [trait], entities: [wick] })))
        .toEqual({ tab: 'traits', id: 'paladin' });
    });
  });

  it('finds no target for a slice the editor has no tab for', () => {
    const update: StatUpdate = { id: 'u1', name: 'u1', prompt: '', stats: [], messageHistory: [] };
    expect(revealTarget(stepOf('statUpdates', [], [update]), emptyWorld({ statUpdates: [update] }))).toBeNull();
  });
});

describe('revealTargetForMove', () => {
  it('reveals the Step nearest where the move lands', () => {
    const first = stepOf('stats', [], [stat('a')]);
    const last = stepOf('locations', [], [location('b')]);
    const world = emptyWorld({ stats: [stat('a')], locations: [location('b')] });
    expect(revealTargetForMove([first, last], world)).toEqual({ tab: 'locations', id: 'b' });
  });

  it('falls back to an earlier Step when the nearest has no tab', () => {
    const update: StatUpdate = { id: 'u1', name: 'u1', prompt: '', stats: [], messageHistory: [] };
    const first = stepOf('stats', [], [stat('a')]);
    const last = stepOf('statUpdates', [], [update]);
    expect(revealTargetForMove([first, last], emptyWorld({ stats: [stat('a')] }))).toEqual({ tab: 'stats', id: 'a' });
  });

  it('finds nothing in an empty move', () => {
    expect(revealTargetForMove([], emptyWorld())).toBeNull();
  });
});
