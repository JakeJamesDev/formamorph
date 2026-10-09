import { describe, it, expect } from 'vitest';
import {
  createHistory, diffSlice, record, type SliceEdit, type SliceName, type Step, type StepOrigin, type WorldSlices,
} from '@/lib/editorHistory';
import { revealForMove, revealTarget } from '@/lib/historyReveal';
import type {
  Connection, Dictionary, DictionaryEntry, Entity, GameLocation, Stat, StatUpdate, Trait, WorldOverview,
} from '@/types';

/** A moved Step names the tab and the record the editor shows the author afterward. */

// Reveal reads ids and names only, so the fixtures carry no other field.
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
    // Reveal reads ids and names only.
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

// A Step with no Origin, in an editor that shows every tab.
const NO_ORIGIN_EDITOR = { shows: () => true, holds: () => false };
const revealWithoutOrigin = (moved: Step[], world: WorldSlices) => revealForMove(moved, world, NO_ORIGIN_EDITOR);

describe('revealForMove without an Origin', () => {
  it('reveals the Step nearest where the move lands', () => {
    const first = stepOf('stats', [], [stat('a')]);
    const last = stepOf('locations', [], [location('b')]);
    const world = emptyWorld({ stats: [stat('a')], locations: [location('b')] });
    expect(revealWithoutOrigin([first, last], world)).toEqual({ tab: 'locations', id: 'b' });
  });

  it('falls back to an earlier Step when the nearest has no tab', () => {
    const update: StatUpdate = { id: 'u1', name: 'u1', prompt: '', stats: [], messageHistory: [] };
    const first = stepOf('stats', [], [stat('a')]);
    const last = stepOf('statUpdates', [], [update]);
    expect(revealWithoutOrigin([first, last], emptyWorld({ stats: [stat('a')] }))).toEqual({ tab: 'stats', id: 'a' });
  });

  it('finds nothing in an empty move', () => {
    expect(revealWithoutOrigin([], emptyWorld())).toBeNull();
  });
});

describe('revealForMove', () => {
  // A roster edit: the Locations tab wrote an entity, whose own tab is Entities.
  const wick = { id: 'wick', name: 'Wick', locations: [] } as unknown as Entity;
  const rostered = { ...wick, locations: ['harbor'] };
  const rosterEdit = () => diffSlice('entities', [wick], [rostered]) as SliceEdit;
  const stepFrom = (origin: StepOrigin | undefined, edits: SliceEdit[] = [rosterEdit()]): Step =>
    record(createHistory(), edits, { origin }).steps[0];
  const world = emptyWorld({ entities: [wick], locations: [location('harbor')] });
  const ALL_TABS = ['overview', 'stats', 'locations', 'entities', 'traits', 'dictionary', 'placeholders'];
  const editor = (over: { shown?: string[]; held?: string[] } = {}) => ({
    shows: (tab: string) => (over.shown ?? ALL_TABS).includes(tab),
    holds: (_tab: string, id: string) => (over.held ?? ['harbor']).includes(id),
  });

  it('reveals the Origin tab and record for an edit made through a mirror', () => {
    const step = stepFrom({ tab: 'locations', ids: ['harbor'] });
    expect(revealForMove([step], world, editor())).toEqual({ tab: 'locations', id: 'harbor' });
  });

  it('opens the Origin tab alone when the author had nothing selected there', () => {
    const step = stepFrom({ tab: 'overview' });
    expect(revealForMove([step], world, editor())).toEqual({ tab: 'overview' });
    expect(revealForMove([stepFrom({ tab: 'overview', ids: [] })], world, editor())).toEqual({ tab: 'overview' });
  });

  it('reveals the touched record on its own tab when the Origin is that tab', () => {
    // An add selects the new record in the same commit, so the Origin still names the earlier selection.
    const step = stepFrom({ tab: 'entities', ids: ['other'] });
    expect(revealForMove([step], world, editor({ held: ['other', 'wick'] }))).toEqual({ tab: 'entities', id: 'wick' });
  });

  it('falls back to the touched record when the Origin record is gone', () => {
    const step = stepFrom({ tab: 'locations', ids: ['harbor'] });
    expect(revealForMove([step], world, editor({ held: [] }))).toEqual({ tab: 'entities', id: 'wick' });
  });

  it('falls back to the touched record when the mode hides the Origin tab', () => {
    const step = stepFrom({ tab: 'placeholders', ids: ['harbor'] });
    expect(revealForMove([step], world, editor({ shown: ['entities'] }))).toEqual({ tab: 'entities', id: 'wick' });
  });

  it('reveals the touched record for a Step with no Origin', () => {
    expect(revealForMove([stepFrom(undefined)], world, editor())).toEqual({ tab: 'entities', id: 'wick' });
  });

  it('opens the Origin tab for a Step whose edits have no tab of their own', () => {
    const update: StatUpdate = { id: 'u1', name: 'u1', prompt: '', stats: [], messageHistory: [] };
    const step = stepFrom({ tab: 'stats', ids: ['harbor'] }, [diffSlice('statUpdates', [], [update]) as SliceEdit]);
    expect(revealForMove([step], world, editor())).toEqual({ tab: 'stats', id: 'harbor' });
  });

  describe('with several records selected', () => {
    const picked = { tab: 'locations', ids: ['harbor', 'docks', 'quay'] };

    it('restores every record of the selection that still stands', () => {
      expect(revealForMove([stepFrom(picked)], world, editor({ held: ['harbor', 'docks', 'quay'] })))
        .toEqual({ tab: 'locations', id: 'harbor', ids: ['harbor', 'docks', 'quay'] });
    });

    it('drops the records that are gone and keeps the order of the rest', () => {
      expect(revealForMove([stepFrom(picked)], world, editor({ held: ['quay', 'harbor'] })))
        .toEqual({ tab: 'locations', id: 'harbor', ids: ['harbor', 'quay'] });
    });

    it('names the one record that is left without a selection list', () => {
      expect(revealForMove([stepFrom(picked)], world, editor({ held: ['docks'] })))
        .toEqual({ tab: 'locations', id: 'docks' });
    });

    it('falls back to the touched record when every record is gone', () => {
      expect(revealForMove([stepFrom(picked)], world, editor({ held: [] })))
        .toEqual({ tab: 'entities', id: 'wick' });
    });
  });

  it('reveals nothing when the mode hides both tabs', () => {
    const step = stepFrom({ tab: 'placeholders', ids: ['harbor'] });
    expect(revealForMove([step], world, editor({ shown: ['overview'] }))).toBeNull();
  });

  describe('the Origin sub-view', () => {
    it('rides with the Origin tab and record of a mirror', () => {
      const step = stepFrom({ tab: 'locations', ids: ['harbor'], subTab: 'presence', view: 'canvas' });
      expect(revealForMove([step], world, editor()))
        .toEqual({ tab: 'locations', id: 'harbor', subTab: 'presence', view: 'canvas' });
    });

    it('rides with the Origin tab alone when nothing was selected there', () => {
      const step = stepFrom({ tab: 'overview', subTab: 'opening' });
      expect(revealForMove([step], world, editor())).toEqual({ tab: 'overview', subTab: 'opening' });
    });

    it('applies to the touched record on its own tab', () => {
      const step = stepFrom({ tab: 'entities', ids: ['other'], subTab: 'descriptions' });
      expect(revealForMove([step], world, editor({ held: ['other', 'wick'] })))
        .toEqual({ tab: 'entities', id: 'wick', subTab: 'descriptions' });
    });

    it('reveals the list view with the Origin location for a connection edited there', () => {
      const connectionEdit = diffSlice('connections', [], [
        { id: 'c1', a: 'harbor', b: 'docks', aToB: {}, bToA: {} } as unknown as Connection,
      ]) as SliceEdit;
      const step = stepFrom({ tab: 'locations', ids: ['harbor'], view: 'list' }, [connectionEdit]);
      expect(revealForMove([step], world, editor())).toEqual({ tab: 'locations', id: 'harbor', view: 'list' });
    });

    it('opens the list view alone when a connection edited there had no location open', () => {
      const connectionEdit = diffSlice('connections', [], [
        { id: 'c1', a: 'harbor', b: 'docks', aToB: {}, bToA: {} } as unknown as Connection,
      ]) as SliceEdit;
      const step = stepFrom({ tab: 'locations', view: 'list' }, [connectionEdit]);
      expect(revealForMove([step], world, editor())).toEqual({ tab: 'locations', view: 'list' });
    });

    it('still selects the connection for one edited on the canvas', () => {
      const connectionEdit = diffSlice('connections', [], [
        { id: 'c1', a: 'harbor', b: 'docks', aToB: {}, bToA: {} } as unknown as Connection,
      ]) as SliceEdit;
      const step = stepFrom({ tab: 'locations', ids: ['harbor'], view: 'canvas' }, [connectionEdit]);
      const joined = { ...world, connections: [{ id: 'c1', a: 'harbor', b: 'docks', aToB: {}, bToA: {} }] } as unknown as WorldSlices;
      expect(revealForMove([step], joined, editor({ held: ['harbor', 'c1'] })))
        .toEqual({ tab: 'locations', id: 'c1', connection: true, view: 'canvas' });
    });

    it('is dropped when the reveal falls back to a tab the Origin was not on', () => {
      const step = stepFrom({ tab: 'locations', ids: ['harbor'], subTab: 'presence', view: 'canvas' });
      expect(revealForMove([step], world, editor({ held: [] }))).toEqual({ tab: 'entities', id: 'wick' });
    });
  });

  it('reveals the Origin of the Step nearest where a jump lands', () => {
    const first = stepFrom({ tab: 'overview' });
    const last = stepFrom({ tab: 'locations', ids: ['harbor'] });
    expect(revealForMove([first, last], world, editor())).toEqual({ tab: 'locations', id: 'harbor' });
  });

  it('falls back inward when the nearest Step reveals nothing', () => {
    const first = stepFrom({ tab: 'locations', ids: ['harbor'] });
    const last = stepFrom({ tab: 'placeholders', ids: ['harbor'] });
    expect(revealForMove([first, last], world, editor({ shown: ['locations'] }))).toEqual({ tab: 'locations', id: 'harbor' });
  });
});
