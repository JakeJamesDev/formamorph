import { describe, expect, it } from 'vitest';
import type { Placeholder, Stat } from '@/types';
import { encodePlaceholderToken } from './placeholders';
import { phValues } from '@/test/placeholderValues';
import type { PlaceholderOwnerRef } from './placeholderHomes';
import {
  codeNameReader, codeRenameReferences, codeRenameTarget, planCodeRename, renameCodeReferences,
  type CodeRenameInput, type CodeRenameSubject, type RenameRoot,
} from './statCodeRename';

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
    expect(plan?.edits[0].boxes.after).toBe('return stats.Vigor.value * 2;');
    expect(plan?.edits[1].boxes.after).toBe(`return stats['Vigor'].max - stats.Vigor.min;`);
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

  it('counts and rewrites both boxes, and touches neither box that has nothing to move', () => {
    const boxed = {
      ...stat('a', 'return stats.Health.max;'),
      beforeCode: `return stats['Health'].value + stats.Health.min;`,
    };
    const afterOnly = stat('b', 'return stats.Health.regen;');
    const plan = planCodeRename({
      root: 'stats', oldName: 'Health', newName: 'Vigor', stats: [boxed, afterOnly], otherNames: [],
    });
    // Two in the before box, one in each after box.
    expect(plan?.references).toBe(4);
    expect(plan?.edits[0].boxes).toEqual({
      before: `return stats['Vigor'].value + stats.Vigor.min;`,
      after: 'return stats.Vigor.max;',
    });
    // The second stat leaves its before box blank, so the plan carries no rewrite for it to blank out.
    expect(plan?.edits[1].boxes).toEqual({ after: 'return stats.Vigor.regen;' });
  });

  it('plans a stat whose reference lives in the before box alone', () => {
    const beforeOnly = { ...stat('a', 'return self.value;'), beforeCode: 'return stats.Health.value;' };
    const plan = planCodeRename({
      root: 'stats', oldName: 'Health', newName: 'Vigor', stats: [beforeOnly], otherNames: [],
    });
    expect(plan?.references).toBe(1);
    expect(plan?.edits[0].boxes).toEqual({ before: 'return stats.Vigor.value;' });
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

describe('codeRenameTarget', () => {
  it('maps a find-and-replace on a name field to its map', () => {
    expect(codeRenameTarget('stat:s1', 'name')).toEqual({ root: 'stats' });
    expect(codeRenameTarget('trait:t1', 'name')).toEqual({ root: 'traits' });
    expect(codeRenameTarget('placeholder:p1', 'name'))
      .toEqual({ root: 'placeholders', subject: { kind: 'placeholder', id: 'p1' } });
  });

  it('reads an entity and a book as the owners of a path', () => {
    expect(codeRenameTarget('entity:e1', 'name'))
      .toEqual({ root: 'placeholders', subject: { kind: 'entity', id: 'e1' } });
    // A search target spells a dictionary `book:`; the offer calls it a dictionary, as the tab does.
    expect(codeRenameTarget('book:d1', 'name'))
      .toEqual({ root: 'placeholders', subject: { kind: 'dictionary', id: 'd1' } });
    expect(codeRenameTarget('dictionary:d1', 'name')).toBeNull();
  });

  it('reads a group rename as no rename, since no map holds a group', () => {
    expect(codeRenameTarget('traitGroup:g1', 'name')).toBeNull();
    expect(codeRenameTarget('placeholderGroup:g1', 'name')).toBeNull();
    expect(codeRenameTarget('entityGroup:g1', 'name')).toBeNull();
  });

  it('reads a replace on any other field as no rename', () => {
    expect(codeRenameTarget('stat:s1', 'description')).toBeNull();
    expect(codeRenameTarget('entry:d1', 'name')).toBeNull();
  });
});

describe('codeNameReader', () => {
  const beast: Placeholder = { id: 'p1', name: 'Beast', values: phValues(['Wolf']) };
  const chipped = `${encodePlaceholderToken({ id: 'p1', mode: 'world', placementId: 'pl1' })} Fury`;
  const owner = { kind: 'entity', id: 'e1' } as const;

  // Every kind a rename can move, so one added later cannot slip through unanswered: forgetting one drops
  // the rename offer silently rather than failing.
  it.each<[string, { root: RenameRoot; subject?: CodeRenameSubject }, string]>([
    ['stat', { root: 'stats' }, 'Beast Fury'],
    ['trait', { root: 'traits' }, 'Beast Fury'],
    ['placeholder', { root: 'placeholders', subject: { kind: 'placeholder', id: 'p1' } }, chipped],
    ['entity', { root: 'placeholders', subject: owner }, 'Beast Fury'],
  ])('reads a %s name as code does', (_kind, target, expected) => {
    expect(codeNameReader(target, [beast])(chipped)).toBe(expected);
  });

  it('leaves a chip-free name alone whatever was renamed', () => {
    const targets: { root: RenameRoot; subject?: CodeRenameSubject }[] = [
      { root: 'stats' }, { root: 'traits' },
      { root: 'placeholders', subject: { kind: 'placeholder', id: 'p1' } },
      { root: 'placeholders', subject: owner },
    ];
    for (const target of targets) expect(codeNameReader(target, [beast])('Fury')).toBe('Fury');
  });
});

describe('planCodeRename over the placeholder tree', () => {
  const beastChip = encodePlaceholderToken({ id: 'beast', mode: 'world', placementId: 'pl1' });
  const beast: Placeholder = { id: 'beast', name: 'Beast', values: phValues(['Wolf']) };
  const hair = (id: string, name = 'Hair'): Placeholder => ({ id, name, values: phValues(['red']) });
  const molly: PlaceholderOwnerRef = { kind: 'entity', id: 'e-molly', name: 'Molly' };

  /** A rename of one node of the tree, planned over the code of one stat. */
  const planOver = (
    code: string,
    input: Partial<CodeRenameInput> & Pick<CodeRenameInput, 'oldName' | 'newName' | 'subject'>,
  ) => planCodeRename({
    root: 'placeholders',
    stats: [stat('a', code)],
    otherNames: [],
    ...input,
  });

  it('follows a placeholder rename into the code names it derives', () => {
    const plan = planCodeRename({
      root: 'placeholders',
      oldName: 'Beast',
      newName: 'Wolf',
      subject: { kind: 'placeholder', id: 'beast' },
      placeholders: { list: [beast] },
      stats: [
        { ...stat('a', ''), name: `${beastChip} Power` },
        stat('b', `stats['Beast Power'].value + traits['Beast Fury'].enabled + placeholders.Beast.text`),
      ],
      traits: [{ name: `${beastChip} Fury` }],
      otherNames: [],
    });
    expect(plan?.references).toBe(3);
    expect(plan?.edits[0].boxes.after)
      .toBe(`stats['Wolf Power'].value + traits['Wolf Fury'].enabled + placeholders.Wolf.text`);
  });

  it('reads a stat name through its chips, so only a derived name follows', () => {
    const plan = planCodeRename({
      root: 'placeholders',
      oldName: 'Beast',
      newName: 'Wolf',
      subject: { kind: 'placeholder', id: 'beast' },
      placeholders: { list: [beast] },
      stats: [
        { ...stat('a', `stats['Beast Power'].value + stats['Beast Fury'].value`), name: `${beastChip} Power` },
        { ...stat('b', ''), name: 'Beast Fury' },
      ],
      otherNames: [],
    });
    expect(plan?.references).toBe(1);
    expect(plan?.edits[0].boxes.after).toBe(`stats['Wolf Power'].value + stats['Beast Fury'].value`);
  });

  it('rewrites the owner segment of every path through a renamed owner', () => {
    const plan = planOver(
      `placeholders.Molly.Hair.text + placeholders["Molly"]["Hair"].text`,
      {
        oldName: 'Molly',
        newName: 'Maud',
        subject: { kind: 'entity', id: 'e-molly' },
        placeholders: { list: [hair('h1')], owners: new Map([['h1', molly]]) },
      },
    );
    expect(plan?.references).toBe(2);
    expect(plan?.edits[0].boxes.after).toBe(`placeholders.Maud.Hair.text + placeholders["Maud"]["Hair"].text`);
  });

  it('rewrites the leaf of a child rename and leaves a world-level name of its own alone', () => {
    const plan = planOver(
      `placeholders.Molly.Hair.text + placeholders.Hair.text`,
      {
        oldName: 'Hair',
        newName: 'Mane',
        subject: { kind: 'placeholder', id: 'h1' },
        placeholders: { list: [hair('world'), hair('h1')], owners: new Map([['h1', molly]]) },
      },
    );
    expect(plan?.references).toBe(1);
    expect(plan?.edits[0].boxes.after).toBe(`placeholders.Molly.Mane.text + placeholders.Hair.text`);
  });

  it('rewrites the bare-name fallback a scoped placeholder answers', () => {
    const plan = planOver(
      'placeholders.Hair.text',
      {
        oldName: 'Hair',
        newName: 'Mane',
        subject: { kind: 'placeholder', id: 'h1' },
        placeholders: { list: [hair('h1')], owners: new Map([['h1', molly]]) },
      },
    );
    expect(plan?.edits[0].boxes.after).toBe('placeholders.Mane.text');
  });

  it('turns a segment into a bracket form when the new name is not an identifier', () => {
    const plan = planOver(
      'placeholders.Molly.Hair.text',
      {
        oldName: 'Hair',
        newName: 'Wild Mane',
        subject: { kind: 'placeholder', id: 'h1' },
        placeholders: { list: [hair('h1')], owners: new Map([['h1', molly]]) },
      },
    );
    expect(plan?.edits[0].boxes.after).toBe(`placeholders.Molly['Wild Mane'].text`);
  });

  it('leaves a computed segment and everything under it alone', () => {
    const plan = planOver(
      'placeholders[pick].Hair.text',
      {
        oldName: 'Hair',
        newName: 'Mane',
        subject: { kind: 'placeholder', id: 'h1' },
        placeholders: { list: [hair('h1')], owners: new Map([['h1', molly]]) },
      },
    );
    expect(plan).toBeNull();
  });

  it('never rewrites its own output when one moved name lands on another’s old one', () => {
    // `Beast` -> `BeastLord` moves two code names at once, and the first one's new spelling is the second
    // one's old spelling. Measured against the original text, `stats.Beast` becomes `stats.BeastLord` and
    // stops there; measured against each other's output it would run on to `stats.BeastLordLord`.
    const chip = encodePlaceholderToken({ id: 'beast', mode: 'world', placementId: 'pl3' });
    const plan = planCodeRename({
      root: 'placeholders',
      oldName: 'Beast',
      newName: 'BeastLord',
      subject: { kind: 'placeholder', id: 'beast' },
      placeholders: { list: [beast] },
      stats: [
        { ...stat('a', 'return stats.Beast + stats.BeastLord;'), name: chip },
        { ...stat('b', ''), name: `${chip}Lord` },
      ],
      otherNames: [],
    });
    expect(plan?.edits[0].boxes.after).toBe('return stats.BeastLord + stats.BeastLordLord;');
    expect(plan?.references).toBe(2);
  });

  it('follows one rename into both an owner key it derives and the entry itself', () => {
    // The owner is named through the same chip, so renaming the placeholder moves two segments of one path.
    const town: Placeholder = { id: 'town', name: 'Town', values: phValues(['Redwater']) };
    const guard: PlaceholderOwnerRef = {
      kind: 'entity', id: 'e-guard', name: `${encodePlaceholderToken({ id: 'town', mode: 'world', placementId: 'pl2' })} Guard`,
    };
    const plan = planOver(
      `placeholders['Town Guard'].Town.text + placeholders.Town.text`,
      {
        oldName: 'Town',
        newName: 'Ashford',
        subject: { kind: 'placeholder', id: 'town' },
        placeholders: { list: [town], owners: new Map([['town', guard]]) },
      },
    );
    expect(plan?.references).toBe(3);
    expect(plan?.edits[0].boxes.after).toBe(`placeholders['Ashford Guard'].Ashford.text + placeholders.Ashford.text`);
  });

  it('leaves a path alone where a member of the holder won the name', () => {
    // `value` is a member of every entry, so `placeholders.Hair.value` reads the member and never the child
    // that shares its name. Renaming that child moves nothing the code says.
    const chip = '{{ph:shade:world:p-shade}}';
    const plan = planOver(
      'placeholders.Hair.value',
      {
        oldName: 'value',
        newName: 'Tone',
        subject: { kind: 'placeholder', id: 'shade' },
        placeholders: {
          list: [
            { id: 'hair', name: 'Hair', values: phValues([chip]) },
            { id: 'shade', name: 'value', values: phValues(['ash']), ownerId: 'hair' },
          ],
        },
      },
    );
    expect(plan).toBeNull();
  });

  it('offers nothing for a rename onto a name a sibling already carries', () => {
    const plan = planOver(
      'placeholders.Molly.Hair.text',
      {
        oldName: 'Hair',
        newName: 'Eyes',
        subject: { kind: 'placeholder', id: 'h1' },
        placeholders: { list: [hair('h1')], owners: new Map([['h1', molly]]) },
        otherNames: ['Eyes'],
      },
    );
    expect(plan).toBeNull();
  });
});
