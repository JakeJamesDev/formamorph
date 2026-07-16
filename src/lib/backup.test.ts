import { describe, it, expect } from 'vitest';
import { parseBackup, splitByConflict, BACKUP_CATEGORIES } from '@/lib/backup';

describe('splitByConflict', () => {
  it('separates fresh ids from ones already present', () => {
    const incoming = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const { fresh, conflicts } = splitByConflict(incoming, new Set(['b']));
    expect(fresh.map((r) => r.id)).toEqual(['a', 'c']);
    expect(conflicts.map((r) => r.id)).toEqual(['b']);
  });

  it('treats everything as fresh when nothing exists', () => {
    const { fresh, conflicts } = splitByConflict([{ id: 'x' }], new Set());
    expect(fresh).toHaveLength(1);
    expect(conflicts).toHaveLength(0);
  });
});

describe('parseBackup', () => {
  it('rejects non-JSON', () => {
    expect(() => parseBackup('{ not json')).toThrow(/valid JSON/);
  });

  it('rejects JSON that is not a Formamorph backup', () => {
    expect(() => parseBackup(JSON.stringify({ hello: 'world' }))).toThrow(/not a Formamorph backup/);
  });

  it('normalizes missing categories to empty arrays and drops id-less records', () => {
    const bundle = parseBackup(
      JSON.stringify({
        formamorphBackup: 1,
        data: { worlds: [{ id: 'w1' }, { name: 'no id' }] },
      }),
    );
    expect(bundle.data.worlds.map((r) => r.id)).toEqual(['w1']);
    for (const cat of BACKUP_CATEGORIES) expect(Array.isArray(bundle.data[cat])).toBe(true);
    expect(bundle.data.saves).toEqual([]);
  });
});
