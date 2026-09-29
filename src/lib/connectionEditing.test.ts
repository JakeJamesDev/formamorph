import { describe, it, expect } from 'vitest';
import {
  connectionTargets,
  connectionsAt,
  createConnection,
  directionFrom,
  hintsLinked,
  legFrom,
  withDirection,
  withHint,
  withLink,
  withUnlink,
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
  a: 'a',
  b: 'b',
  aToB: {},
  bToA: {},
  ...over,
});

/** A one-way record: `a → b`, or `b → a` when `back` is set. */
const oneWay = (over: Partial<Connection> = {}, back = false): Connection => {
  const { aToB, bToA, ...rest } = conn(over);
  return back ? { ...rest, bToA } : { ...rest, aToB };
};

describe('directionFrom', () => {
  it('reads two-way from either end', () => {
    expect(directionFrom(conn(), 'a')).toBe('two-way');
    expect(directionFrom(conn(), 'b')).toBe('two-way');
  });

  it('reads a one-way record as outgoing where its leg leaves and incoming where it arrives', () => {
    expect(directionFrom(oneWay(), 'a')).toBe('outgoing');
    expect(directionFrom(oneWay(), 'b')).toBe('incoming');
    const back = oneWay({}, true);
    expect(directionFrom(back, 'b')).toBe('outgoing');
    expect(directionFrom(back, 'a')).toBe('incoming');
  });
});

describe('legFrom', () => {
  it('names the leg that leaves the given end', () => {
    expect(legFrom(conn(), 'a')).toBe('aToB');
    expect(legFrom(conn(), 'b')).toBe('bToA');
  });
});

describe('withDirection', () => {
  it('adds the return leg with the existing hint when a one-way record turns two-way', () => {
    const next = withDirection(oneWay({ aToB: { hint: 'up the steps' } }), 'b', 'two-way');
    expect(next).toEqual(conn({ aToB: { hint: 'up the steps' }, bToA: { hint: 'up the steps' } }));
  });

  it('keeps the remaining leg and its own hint when a two-way record turns one-way', () => {
    const twoWay = conn({ aToB: { hint: 'up' }, bToA: { hint: 'down' } });
    const next = withDirection(twoWay, 'b', 'outgoing');
    expect(next).toEqual({ id: 'c1', a: 'a', b: 'b', bToA: { hint: 'down' } });
    expect(next).not.toHaveProperty('aToB');
  });

  it('moves the leg on a flip and leaves the ends alone', () => {
    const flipped = withDirection(oneWay({ aToB: { hint: 'up' } }), 'a', 'incoming');
    expect(flipped).toEqual({ id: 'c1', a: 'a', b: 'b', bToA: { hint: 'up' } });
    expect(flipped).not.toHaveProperty('aToB');
    // The flip has to read the same from the other end, or the two panels disagree about one record.
    expect(directionFrom(flipped, 'b')).toBe('outgoing');
  });

  it('leaves a two-way record as it is when two-way is picked again', () => {
    const twoWay = conn({ aToB: { hint: 'up' }, bToA: { hint: 'down' } });
    expect(withDirection(twoWay, 'a', 'two-way')).toEqual(twoWay);
  });
});

describe('withHint', () => {
  it('writes only the named leg', () => {
    expect(withHint(conn({ bToA: { hint: 'down' } }), 'aToB', 'up')).toEqual(
      conn({ aToB: { hint: 'up' }, bToA: { hint: 'down' } }),
    );
  });

  it('drops the field for a blank hint and keeps the leg', () => {
    const next = withHint(conn({ aToB: { hint: 'up' } }), 'aToB', '   ');
    expect(next.aToB).toEqual({});
  });

  it('adds no leg when the named direction is not travelable', () => {
    const record = oneWay();
    expect(withHint(record, 'bToA', 'down')).toBe(record);
  });
});

describe('hintsLinked', () => {
  it('reads equal hints on both legs as linked', () => {
    expect(hintsLinked(conn({ aToB: { hint: 'up' }, bToA: { hint: 'up' } }))).toBe(true);
  });

  it('reads two legs with no hint as linked', () => {
    expect(hintsLinked(conn())).toBe(true);
  });

  it('reads different hints as unlinked, including one leg with no hint', () => {
    expect(hintsLinked(conn({ aToB: { hint: 'up' }, bToA: { hint: 'down' } }))).toBe(false);
    expect(hintsLinked(conn({ aToB: { hint: 'up' } }))).toBe(false);
  });

  it('reads a one-way record as unlinked, since there is no second leg to link', () => {
    expect(hintsLinked(oneWay())).toBe(false);
    expect(hintsLinked(oneWay({}, true))).toBe(false);
  });
});

describe('withLink', () => {
  it('writes the first leg hint into the second leg', () => {
    const next = withLink(conn({ aToB: { hint: 'up' }, bToA: { hint: 'down' } }), 'aToB');
    expect(next).toEqual(conn({ aToB: { hint: 'up' }, bToA: { hint: 'up' } }));
  });

  it('copies from whichever leg is first, so the other end panel links its own way', () => {
    const next = withLink(conn({ aToB: { hint: 'up' }, bToA: { hint: 'down' } }), 'bToA');
    expect(next).toEqual(conn({ aToB: { hint: 'down' }, bToA: { hint: 'down' } }));
  });

  it('clears the second hint when the first leg has none', () => {
    expect(withLink(conn({ bToA: { hint: 'down' } }), 'aToB')).toEqual(conn());
  });

  it('adds no leg to a one-way record', () => {
    const record = oneWay({ aToB: { hint: 'up' } });
    expect(withLink(record, 'aToB')).toBe(record);
  });
});

describe('withUnlink', () => {
  it('writes the given text back into the second leg and leaves the first alone', () => {
    const linked = conn({ aToB: { hint: 'up' }, bToA: { hint: 'up' } });
    expect(withUnlink(linked, 'aToB', 'down')).toEqual(conn({ aToB: { hint: 'up' }, bToA: { hint: 'down' } }));
    expect(withUnlink(linked, 'bToA', 'down')).toEqual(conn({ aToB: { hint: 'down' }, bToA: { hint: 'up' } }));
  });

  it('drops the field for a blank restored text', () => {
    const next = withUnlink(conn({ aToB: { hint: 'up' }, bToA: { hint: 'up' } }), 'aToB', '');
    expect(next.bToA).toEqual({});
  });
});

describe('connectionsAt', () => {
  const connections = [
    oneWay({ id: 'ab', a: 'a', b: 'b' }),
    conn({ id: 'cb', a: 'c', b: 'b' }),
    conn({ id: 'cd', a: 'c', b: 'd' }),
  ];

  it('lists every record touching the location, from either end', () => {
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
    expect(connectionsAt('a', [conn({ a: 'a', b: 'a' })])).toEqual([]);
  });
});

describe('connectionTargets', () => {
  const locations = [loc('a'), loc('b'), loc('c')];

  it('offers every other location when nothing is connected yet', () => {
    expect(connectionTargets('a', locations, []).map((l) => l.id)).toEqual(['b', 'c']);
  });

  it('leaves out the location itself and any partner it already connects to', () => {
    const existing = [oneWay({ a: 'c', b: 'a' })];
    expect(connectionTargets('a', locations, existing).map((l) => l.id)).toEqual(['b']);
  });
});

describe('createConnection', () => {
  it('starts two-way with no hints, from the location being edited', () => {
    const created = createConnection('a', 'b');
    expect(created).toEqual({ id: expect.any(String), a: 'a', b: 'b', aToB: {}, bToA: {} });
    expect(created.id).not.toBe(createConnection('a', 'b').id);
  });
});
