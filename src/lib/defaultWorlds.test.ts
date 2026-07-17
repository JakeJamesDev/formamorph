import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_WORLDS, isDefaultWorldId, readDeletedDefaultWorlds, tombstoneDefaultWorld,
  clearDeletedDefaultWorlds,
} from './defaultWorlds';

const KEY = 'FORMAMORPH_deletedDefaultWorlds';

beforeEach(() => localStorage.clear());

describe('isDefaultWorldId', () => {
  it('recognizes every bundled default', () => {
    for (const w of DEFAULT_WORLDS) expect(isDefaultWorldId(w.id)).toBe(true);
  });

  it.each(['uploaded-123', 'custom', ''])('rejects the non-default id %s', (id) => {
    expect(isDefaultWorldId(id)).toBe(false);
  });
});

describe('tombstoneDefaultWorld', () => {
  it('records a deleted default so the seeder can skip it', () => {
    tombstoneDefaultWorld('rampage');
    expect(readDeletedDefaultWorlds().has('rampage')).toBe(true);
  });

  it('ignores a non-default id — only defaults are tombstoned', () => {
    tombstoneDefaultWorld('uploaded-123');
    expect(readDeletedDefaultWorlds().size).toBe(0);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('accumulates ids without duplicating a repeat delete', () => {
    tombstoneDefaultWorld('rampage');
    tombstoneDefaultWorld('drone');
    tombstoneDefaultWorld('rampage');
    expect([...readDeletedDefaultWorlds()].sort()).toEqual(['drone', 'rampage']);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toHaveLength(2);
  });
});

describe('clearDeletedDefaultWorlds', () => {
  it('forgets every deletion so the seeder re-creates them', () => {
    tombstoneDefaultWorld('rampage');
    tombstoneDefaultWorld('drone');

    clearDeletedDefaultWorlds();

    expect(readDeletedDefaultWorlds().size).toBe(0);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('is a no-op when nothing was deleted', () => {
    expect(() => clearDeletedDefaultWorlds()).not.toThrow();
    expect(readDeletedDefaultWorlds().size).toBe(0);
  });
});

describe('readDeletedDefaultWorlds', () => {
  it('reads nothing when no default has been deleted', () => {
    expect(readDeletedDefaultWorlds().size).toBe(0);
  });

  it.each([['not json'], ['null'], ['{"a":1}'], ['[1,2]']])(
    'falls back to "none deleted" on the malformed value %s', (raw) => {
      // A bad value must never read as "everything deleted" — that would silently wipe the defaults.
      localStorage.setItem(KEY, raw);
      expect(readDeletedDefaultWorlds().size).toBe(0);
    });

  it('round-trips through storage', () => {
    localStorage.setItem(KEY, JSON.stringify(['drone']));
    expect([...readDeletedDefaultWorlds()]).toEqual(['drone']);
  });
});
