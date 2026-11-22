import { describe, expect, it } from 'vitest';
import { drawnOpeningKey, readOpeningKey, resolveDrawnOpening, sameOpeningKey, type DrawnOpeningSources } from './drawnOpening';
import { DEFAULT_OPENING, drawPoolEntry, drawUnseenOpening, openingPool } from './openings';
import type { Entity, GameLocation, WorldOverview } from '@/types';

const overview = { name: 'W', openings: [{ id: 'o1', text: 'The world opens.', kind: 'action' }] } as WorldOverview;
const pell = { id: 'pell', name: 'Pell', openings: [{ id: 'o1', text: 'Pell waves.', kind: 'narration' }] } as Entity;
const harbor: GameLocation = { id: 'harbor', name: 'Harbor', isStarting: true, openings: [{ id: 'o1', text: 'Gulls cry.', kind: 'action' }] };
const sources: DrawnOpeningSources = { overview, entities: [pell], locations: [harbor] };

describe('drawnOpeningKey', () => {
  it('records nothing for the shipped default opening', () => {
    expect(drawnOpeningKey(drawPoolEntry([], Math.random))).toBeNull();
    expect(drawnOpeningKey({ ownerId: null, opening: DEFAULT_OPENING })).toBeNull();
  });

  it('carries the location id of a location row through the draw', () => {
    const pool = openingPool({ overview: null, locations: [harbor], startingLocationId: 'harbor', placesOf: () => [] });
    const draw = drawUnseenOpening(pool, [], () => 0);
    expect(drawnOpeningKey(draw)).toEqual({ ownerId: null, openingId: 'o1', locationId: 'harbor' });
  });
});

describe('resolveDrawnOpening', () => {
  it('resolves each owner to its own row, though all three share one Opening id', () => {
    expect(resolveDrawnOpening({ ownerId: null, openingId: 'o1' }, sources)).toMatchObject({ opening: { text: 'The world opens.' }, owner: null });
    expect(resolveDrawnOpening({ ownerId: 'pell', openingId: 'o1' }, sources))
      .toMatchObject({ opening: { text: 'Pell waves.' }, owner: { category: 'entity', entity: pell } });
    expect(resolveDrawnOpening({ ownerId: null, openingId: 'o1', locationId: 'harbor' }, sources))
      .toMatchObject({ opening: { text: 'Gulls cry.' }, owner: { category: 'location', location: harbor } });
  });

  it('never resolves an entity key to a location that shares its id', () => {
    const twin: GameLocation = { ...harbor, id: 'pell' };
    expect(resolveDrawnOpening({ ownerId: 'pell', openingId: 'o1' }, { ...sources, entities: [], locations: [twin] })).toBeNull();
    expect(resolveDrawnOpening({ ownerId: null, openingId: 'o1', locationId: 'pell' }, { ...sources, locations: [] })).toBeNull();
  });

  it('reads null for no key, a deleted owner and a deleted Opening', () => {
    expect(resolveDrawnOpening(null, sources)).toBeNull();
    expect(resolveDrawnOpening({ ownerId: 'gone', openingId: 'o1' }, sources)).toBeNull();
    expect(resolveDrawnOpening({ ownerId: 'pell', openingId: 'o2' }, sources)).toBeNull();
    expect(resolveDrawnOpening({ ownerId: null, openingId: 'o1' }, { ...sources, overview: { ...overview, openings: [] } })).toBeNull();
  });

  it('reads a renamed Opening under its new name', () => {
    const renamed = { ...pell, openings: [{ ...pell.openings![0], name: 'greeting' }] };
    expect(resolveDrawnOpening({ ownerId: 'pell', openingId: 'o1' }, { ...sources, entities: [renamed] })?.opening.name).toBe('greeting');
  });
});

describe('readOpeningKey', () => {
  it('keeps a well-formed key and rejects anything else', () => {
    expect(readOpeningKey({ ownerId: 'pell', openingId: 'o1' })).toEqual({ ownerId: 'pell', openingId: 'o1' });
    expect(readOpeningKey({ ownerId: null, openingId: 'o1', locationId: 'harbor' })).toEqual({ ownerId: null, openingId: 'o1', locationId: 'harbor' });
    for (const junk of [undefined, null, 'o1', {}, { ownerId: 3, openingId: 'o1' }, { ownerId: 'pell', openingId: 'o1', locationId: 'harbor' }]) {
      expect(readOpeningKey(junk)).toBeNull();
    }
  });
});

describe('sameOpeningKey', () => {
  it('tells a location row from a world row with the same Opening id', () => {
    expect(sameOpeningKey({ ownerId: null, openingId: 'o1' }, { ownerId: null, openingId: 'o1' })).toBe(true);
    expect(sameOpeningKey({ ownerId: null, openingId: 'o1' }, { ownerId: null, openingId: 'o1', locationId: 'harbor' })).toBe(false);
    expect(sameOpeningKey(null, null)).toBe(true);
  });
});
