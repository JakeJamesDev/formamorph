import { describe, it, expect } from 'vitest';
import {
  connectionTargets,
  connectionsAt,
  createConnection,
  directionFrom,
  withDirection,
} from './connectionEditing';
import type { Connection, GameLocation } from '@/types';

const loc = (id: string, over: Partial<GameLocation> = {}): GameLocation => ({
  id,
  name: id,
  playerDescription: '',
  aiDescription: '',
  ...over,
} as GameLocation);

const conn = (over: Partial<Connection> = {}): Connection => ({
  id: 'c1',
  from: 'a',
  to: 'b',
  twoWay: true,
  ...over,
});

describe('directionFrom', () => {
  it('reads two-way from either end', () => {
    expect(directionFrom(conn(), 'a')).toBe('two-way');
    expect(directionFrom(conn(), 'b')).toBe('two-way');
  });

  it('reads a one-way record as outgoing at its from end and incoming at its to end', () => {
    const oneWay = conn({ twoWay: false });
    expect(directionFrom(oneWay, 'a')).toBe('outgoing');
    expect(directionFrom(oneWay, 'b')).toBe('incoming');
  });
});

describe('withDirection', () => {
  it('makes a one-way record two-way without disturbing its endpoints', () => {
    expect(withDirection(conn({ twoWay: false }), 'a', 'two-way')).toEqual(conn({ twoWay: true }));
  });

  it('points a two-way record at the partner when set outgoing here', () => {
    expect(withDirection(conn(), 'b', 'outgoing')).toEqual(conn({ from: 'b', to: 'a', twoWay: false }));
  });

  it('flips orientation when the same end asks for the opposite direction', () => {
    const outgoing = conn({ twoWay: false }); // a → b
    const flipped = withDirection(outgoing, 'a', 'incoming');
    expect(flipped).toEqual(conn({ from: 'b', to: 'a', twoWay: false }));
    // The flip has to read the same from the other end, or the two panels disagree about one record.
    expect(directionFrom(flipped, 'b')).toBe('outgoing');
  });

  it('keeps the id and hint through a direction change', () => {
    const hinted = conn({ id: 'keep', aiHint: 'through the portal' });
    expect(withDirection(hinted, 'b', 'outgoing')).toMatchObject({ id: 'keep', aiHint: 'through the portal' });
  });
});

describe('connectionsAt', () => {
  const connections = [
    conn({ id: 'ab', from: 'a', to: 'b', twoWay: false }),
    conn({ id: 'cb', from: 'c', to: 'b', twoWay: true }),
    conn({ id: 'cd', from: 'c', to: 'd', twoWay: true }),
  ];

  it('lists every record touching the location, from either endpoint', () => {
    expect(connectionsAt('b', connections).map((v) => [v.connection.id, v.partnerId, v.direction])).toEqual([
      ['ab', 'a', 'incoming'],
      ['cb', 'c', 'two-way'],
    ]);
  });

  it('shows one record as the mirror view at its other end', () => {
    const [here] = connectionsAt('a', connections);
    const [there] = connectionsAt('b', connections);
    expect(here.connection).toBe(there.connection);
    expect(here.direction).toBe('outgoing');
    expect(there.direction).toBe('incoming');
  });

  it('drops a self-link rather than listing a location as its own partner', () => {
    expect(connectionsAt('a', [conn({ from: 'a', to: 'a' })])).toEqual([]);
  });
});

describe('connectionTargets', () => {
  const locations = [loc('a'), loc('b'), loc('c')];

  it('offers every other location when nothing is connected yet', () => {
    expect(connectionTargets('a', locations, []).map((l) => l.id)).toEqual(['b', 'c']);
  });

  it('leaves out the location itself and any partner it already connects to', () => {
    const existing = [conn({ from: 'c', to: 'a', twoWay: false })];
    expect(connectionTargets('a', locations, existing).map((l) => l.id)).toEqual(['b']);
  });
});

describe('createConnection', () => {
  it('defaults to two-way and departs from the location being edited', () => {
    const created = createConnection('a', 'b');
    expect(created).toMatchObject({ from: 'a', to: 'b', twoWay: true });
    expect(created.id).toEqual(expect.any(String));
    expect(created.id).not.toBe(createConnection('a', 'b').id);
  });
});
