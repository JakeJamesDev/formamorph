import { describe, expect, it } from 'vitest';
import type { Script } from '@/types';
import { inRunOrder, migrateStatBoxes, migrateStatLinkBoxes, withFirstCodeAt } from './scripts';

const script = (over: Partial<Script> & Pick<Script, 'id'>): Script => ({ timing: 'after', code: 'return 1;', ...over });

describe('migrateStatBoxes', () => {
  it('turns both boxes into scripts with their timings and stable ids, and drops the old fields', () => {
    const out = migrateStatBoxes({ id: 'hp', name: 'Health', beforeCode: 'return 1;', code: 'return 2;' });
    expect(out).toEqual({
      id: 'hp', name: 'Health',
      scripts: [{ id: 'hp:before', timing: 'before', code: 'return 1;' }, { id: 'hp:after', timing: 'after', code: 'return 2;' }],
    });
  });

  it('leaves a blank box out and stores no list when both are blank', () => {
    expect(migrateStatBoxes({ id: 'a', beforeCode: '  \n', code: 'return 2;' })).toEqual({
      id: 'a', scripts: [{ id: 'a:after', timing: 'after', code: 'return 2;' }],
    });
    expect(migrateStatBoxes({ id: 'a', beforeCode: '', code: ' ' })).toEqual({ id: 'a' });
  });

  it('is idempotent and returns the same object for a stat with no box', () => {
    const once = migrateStatBoxes({ id: 'a', code: 'return 2;' });
    expect(migrateStatBoxes(once)).toBe(once);
  });
});

describe('migrateStatLinkBoxes', () => {
  const original = { id: 'o', beforeCode: 'return 1;', code: 'return 2;' };

  it('folds one box override into a scripts override, the live side read from the original', () => {
    const link = { id: 'l', originalId: 'o', overrides: { o: { code: { value: 'return 9;', blueprint: 'return 2;' }, min: { value: 3, blueprint: 0 } } } };
    const out = migrateStatLinkBoxes(link, () => original);
    expect(out.overrides.o).toEqual({
      min: { value: 3, blueprint: 0 },
      scripts: {
        value: [{ id: 'o:before', timing: 'before', code: 'return 1;' }, { id: 'o:after', timing: 'after', code: 'return 9;' }],
        blueprint: [{ id: 'o:before', timing: 'before', code: 'return 1;' }, { id: 'o:after', timing: 'after', code: 'return 2;' }],
      },
    });
  });

  it('keeps a stale override stale: its blueprint side is what it was made against', () => {
    const link = { id: 'l', overrides: { o: { beforeCode: { value: '', blueprint: 'return 0;' } } } };
    const out: { overrides: Record<string, unknown> } = migrateStatLinkBoxes(link, () => migrateStatBoxes(original));
    expect(out.overrides.o).toEqual({ scripts: {
      value: [{ id: 'o:after', timing: 'after', code: 'return 2;' }],
      blueprint: [{ id: 'o:before', timing: 'before', code: 'return 0;' }, { id: 'o:after', timing: 'after', code: 'return 2;' }],
    } });
  });

  it('leaves an override unfolded while its original is out of reach', () => {
    const link = { id: 'l', overrides: { o: { code: { value: 'return 9;', blueprint: 'return 2;' } } } };
    expect(migrateStatLinkBoxes(link, () => undefined)).toBe(link);
  });

  it('returns the same link when no override names a box', () => {
    const link = { id: 'l', overrides: { o: { min: { value: 3, blueprint: 0 } } } };
    expect(migrateStatLinkBoxes(link, () => original)).toBe(link);
  });
});

describe('inRunOrder', () => {
  it('runs ordered scripts first, ascending, then the rest in the order given', () => {
    const units = [
      { script: script({ id: 'a' }) },
      { script: script({ id: 'b', order: 2 }) },
      { script: script({ id: 'c' }) },
      { script: script({ id: 'd', order: 0 }) },
    ];
    expect(inRunOrder(units).map((unit) => unit.script.id)).toEqual(['d', 'b', 'a', 'c']);
  });
});

describe('withFirstCodeAt', () => {
  const mint = () => 'new';

  it('adds a script when the timing has none, and stores nothing for empty code', () => {
    expect(withFirstCodeAt(undefined, 'before', 'return 1;', mint)).toEqual([{ id: 'new', timing: 'before', code: 'return 1;' }]);
    expect(withFirstCodeAt(undefined, 'before', '', mint)).toBeUndefined();
  });

  it('edits only the first script of the timing and removes it when cleared', () => {
    const list = [script({ id: 'x', timing: 'before' }), script({ id: 'y' }), script({ id: 'z' })];
    expect(withFirstCodeAt(list, 'after', 'return 5;', mint)?.map((s) => [s.id, s.code])).toEqual([
      ['x', 'return 1;'], ['y', 'return 5;'], ['z', 'return 1;'],
    ]);
    expect(withFirstCodeAt(list, 'after', '', mint)?.map((s) => s.id)).toEqual(['x', 'z']);
    expect(withFirstCodeAt([script({ id: 'x' })], 'after', '', mint)).toBeUndefined();
  });

  it('returns the same list when the code is unchanged', () => {
    const list = [script({ id: 'y' })];
    expect(withFirstCodeAt(list, 'after', 'return 1;', mint)).toBe(list);
  });
});
