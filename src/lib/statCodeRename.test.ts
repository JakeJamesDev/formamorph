import { describe, expect, it } from 'vitest';
import type { Stat } from '@/types';
import { codeRenameReferences, planCodeRename, renameCodeReferences, renameRootForTarget } from './statCodeRename';

const stat = (id: string, code: string): Stat => ({ id, name: id, type: 'number', value: 0, min: 0, max: 100, code } as Stat);

describe('renameCodeReferences', () => {
  it('rewrites the dot form', () => {
    expect(renameCodeReferences('return stats.Health.value;', 'stats', 'Health', 'Vigor'))
      .toBe('return stats.Vigor.value;');
  });

  it('rewrites both quote styles, keeping the quote the author used', () => {
    expect(renameCodeReferences(`stats['Health'].value + stats["Health"].max`, 'stats', 'Health', 'Vigor'))
      .toBe(`stats['Vigor'].value + stats["Vigor"].max`);
  });

  it('rewrites an optional-chained lookup', () => {
    expect(renameCodeReferences('return stats?.Health?.value;', 'stats', 'Health', 'Vigor'))
      .toBe('return stats?.Vigor?.value;');
  });

  it('leaves a comparison form alone', () => {
    const code = `const s = Object.values(stats).find(x => x.name === 'Health');`;
    expect(renameCodeReferences(code, 'stats', 'Health', 'Vigor')).toBe(code);
  });

  it('leaves another map and another name alone', () => {
    const code = `stats.Health.value + placeholders.Health.value + stats.Stamina.value`;
    expect(renameCodeReferences(code, 'stats', 'Health', 'Vigor'))
      .toBe(`stats.Vigor.value + placeholders.Health.value + stats.Stamina.value`);
  });

  it('rewrites placeholders and traits under their own roots', () => {
    expect(renameCodeReferences(`placeholders.Mood.pin('calm');`, 'placeholders', 'Mood', 'Temper'))
      .toBe(`placeholders.Temper.pin('calm');`);
    expect(renameCodeReferences('traits.Brave.enabled', 'traits', 'Brave', 'Bold'))
      .toBe('traits.Bold.enabled');
  });

  it('turns a dot form into a bracket form when the new name is not an identifier', () => {
    expect(renameCodeReferences('return stats.Health.value;', 'stats', 'Health', 'Max Health'))
      .toBe(`return stats['Max Health'].value;`);
    expect(renameCodeReferences('return stats?.Health;', 'stats', 'Health', 'Max Health'))
      .toBe(`return stats?.['Max Health'];`);
  });

  it('keeps the bracket form when the new name is an identifier', () => {
    expect(renameCodeReferences(`stats['Max Health'].value`, 'stats', 'Max Health', 'Health'))
      .toBe(`stats['Health'].value`);
  });

  it('escapes a quote the new name shares with the author’s', () => {
    expect(renameCodeReferences(`stats['Health'].value`, 'stats', 'Health', "Ann's Health"))
      .toBe(`stats['Ann\\'s Health'].value`);
    expect(renameCodeReferences('stats.Health.value', 'stats', 'Health', "Ann's Health"))
      .toBe(`stats['Ann\\'s Health'].value`);
  });

  it('leaves an escaped key alone, since only a run could name it', () => {
    // Spelled `Hea\lth`, which reads as `Health` at run time and so names a different stat than the one
    // whose authored name is that exact text.
    const code = String.raw`stats['Hea\lth'].value`;
    expect(renameCodeReferences(code, 'stats', String.raw`Hea\lth`, 'Vigor')).toBe(code);
  });

  it('leaves a computed key alone', () => {
    const code = 'stats[pick].value';
    expect(renameCodeReferences(code, 'stats', 'Health', 'Vigor')).toBe(code);
  });

  it('leaves a shadowed root alone', () => {
    const code = `const stats = other; stats.Health.value`;
    expect(renameCodeReferences(code, 'stats', 'Health', 'Vigor')).toBe(code);
  });

  it('rewrites every reference in one pass', () => {
    expect(renameCodeReferences(`stats.Health.value + stats['Health'].max + stats.Health.min`, 'stats', 'Health', 'Vigor'))
      .toBe(`stats.Vigor.value + stats['Vigor'].max + stats.Vigor.min`);
  });

  it('is a no-op for code with no reference', () => {
    expect(renameCodeReferences('return self.value + 1;', 'stats', 'Health', 'Vigor')).toBe('return self.value + 1;');
  });
});

describe('codeRenameReferences', () => {
  it('counts every map-lookup form and no comparison form', () => {
    const code = `stats.Health.value + stats['Health'].max + Object.values(stats).find(x => x.name === 'Health')`;
    expect(codeRenameReferences(code, 'stats', 'Health')).toHaveLength(2);
  });

  it('finds nothing in empty code', () => {
    expect(codeRenameReferences('', 'stats', 'Health')).toEqual([]);
  });
});

describe('planCodeRename', () => {
  const stats = [
    stat('a', 'return stats.Health.value * 2;'),
    stat('b', `return stats['Health'].max - stats.Health.min;`),
    stat('c', 'return self.value;'),
  ];

  it('plans the rewrite across every stat that references the old name', () => {
    const plan = planCodeRename({ root: 'stats', oldName: 'Health', newName: 'Vigor', stats, otherNames: [] });
    expect(plan).not.toBeNull();
    expect(plan?.references).toBe(3);
    expect(plan?.edits.map((edit) => edit.id)).toEqual(['a', 'b']);
    expect(plan?.edits[0].code).toBe('return stats.Vigor.value * 2;');
    expect(plan?.edits[1].code).toBe(`return stats['Vigor'].max - stats.Vigor.min;`);
  });

  it('offers nothing when nothing references the old name', () => {
    expect(planCodeRename({ root: 'stats', oldName: 'Stamina', newName: 'Grit', stats, otherNames: [] })).toBeNull();
  });

  it('offers nothing when the name did not change', () => {
    expect(planCodeRename({ root: 'stats', oldName: 'Health', newName: 'Health', stats, otherNames: [] })).toBeNull();
  });

  it('offers nothing when either name is blank', () => {
    expect(planCodeRename({ root: 'stats', oldName: '', newName: 'Health', stats, otherNames: [] })).toBeNull();
    expect(planCodeRename({ root: 'stats', oldName: 'Health', newName: '  ', stats, otherNames: [] })).toBeNull();
  });

  it('offers nothing when the new name is one another entry already carries', () => {
    expect(planCodeRename({ root: 'stats', oldName: 'Health', newName: 'Stamina', stats, otherNames: ['Stamina'] }))
      .toBeNull();
  });

  it('reads a name that differs only by its spaces as the same duplicate', () => {
    expect(planCodeRename({ root: 'stats', oldName: 'Health', newName: ' Stamina ', stats, otherNames: ['Stamina'] }))
      .toBeNull();
    expect(planCodeRename({ root: 'stats', oldName: 'Health', newName: 'Stamina', stats, otherNames: [' Stamina '] }))
      .toBeNull();
  });

  it('skips a stat whose code is empty', () => {
    const plan = planCodeRename({
      root: 'traits',
      oldName: 'Brave',
      newName: 'Bold',
      stats: [stat('a', ''), stat('b', 'return traits.Brave.enabled ? 1 : 0;')],
      otherNames: [],
    });
    expect(plan?.edits.map((edit) => edit.id)).toEqual(['b']);
  });
});

describe('renameRootForTarget', () => {
  it('maps a find-and-replace on a name field to its map', () => {
    expect(renameRootForTarget('stat:s1', 'name')).toBe('stats');
    expect(renameRootForTarget('trait:t1', 'name')).toBe('traits');
    expect(renameRootForTarget('placeholder:p1', 'name')).toBe('placeholders');
  });

  it('reads a group rename as no rename, since no map holds a group', () => {
    expect(renameRootForTarget('traitGroup:g1', 'name')).toBeNull();
    expect(renameRootForTarget('placeholderGroup:g1', 'name')).toBeNull();
    expect(renameRootForTarget('entityGroup:g1', 'name')).toBeNull();
  });

  it('reads a replace on any other field as no rename', () => {
    expect(renameRootForTarget('stat:s1', 'description')).toBeNull();
    expect(renameRootForTarget('entity:e1', 'name')).toBeNull();
    expect(renameRootForTarget('entry:d1', 'name')).toBeNull();
  });
});
