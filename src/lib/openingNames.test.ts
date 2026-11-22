import { describe, it, expect } from 'vitest';
import type { Opening } from '@/types';
import {
  openingLabel, openingName, openingNameTaken, remintOpenings, setOpeningName,
} from './openings';
import { migrateWorld } from './version';

const row = (id: string, extra: Partial<Opening> = {}): Opening => ({ id, text: `Opening ${id}.`, kind: 'action', ...extra });
const owner = (...names: (string | undefined)[]) => ({
  openings: names.map((name, i) => row(`o${i}`, name === undefined ? {} : { name })),
});

describe('opening names', () => {
  it('labels an unnamed row "Owner · Opening N" by its place, and a named row by its name', () => {
    expect(openingLabel({}, 'Aki', 1)).toBe('Aki · Opening 2');
    expect(openingLabel({ name: '  ' }, 'World', 0)).toBe('World · Opening 1');
    expect(openingLabel({ name: 'ambush' }, 'Aki', 1)).toBe('ambush');
  });

  it('reads absent and blank as no name', () => {
    expect(openingName({})).toBeNull();
    expect(openingName({ name: '   ' })).toBeNull();
    expect(openingName({ name: ' ambush ' })).toBe('ambush');
  });

  it('stores a trimmed name, and a blank name as absent', () => {
    const set = setOpeningName(owner(undefined, undefined), 'o0', '  ambush ');
    expect(set.openings?.[0].name).toBe('ambush');
    const cleared = setOpeningName({ openings: set.openings }, 'o0', '  ');
    expect('name' in (cleared.openings?.[0] ?? {})).toBe(false);
  });

  it('refuses a name another row of the owner has, case-sensitively, and leaves the list unchanged', () => {
    const rows = owner('ambush', undefined);
    expect(openingNameTaken(rows, 'o1', 'ambush')).toBe(true);
    expect(openingNameTaken(rows, 'o1', ' ambush ')).toBe(true);
    expect(openingNameTaken(rows, 'o1', 'Ambush')).toBe(false);
    expect(setOpeningName(rows, 'o1', 'ambush').openings).toBe(rows.openings);
  });

  it('counts a Self row against the name, and never counts the row itself or a blank name', () => {
    const rows = { openings: [row('a', { name: 'route', self: true }), row('b')] };
    expect(openingNameTaken(rows, 'b', 'route')).toBe(true);
    expect(openingNameTaken(rows, 'a', 'route')).toBe(false);
    expect(openingNameTaken(rows, 'b', '')).toBe(false);
  });

  it('lets another owner use the same name', () => {
    expect(openingNameTaken(owner('ambush'), 'x', 'ambush')).toBe(true);
    expect(openingNameTaken({ openings: [row('x')] }, 'x', 'ambush')).toBe(false);
  });

  it('survives a remint and a world migration', () => {
    expect(remintOpenings(owner('ambush')).openings?.[0].name).toBe('ambush');
    const world = migrateWorld({ worldOverview: { openings: [row('a', { name: 'ambush' })] } }) as {
      worldOverview: { openings: Opening[] };
    };
    expect(world.worldOverview.openings[0].name).toBe('ambush');
  });
});
