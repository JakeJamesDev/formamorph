import { describe, it, expect } from 'vitest';
import { convertStPersonaBackup, importedDefaultPersona, stPersonaReport } from './stPersonaImport';

const backup = {
  personas: {
    '1700000000-Aria.png': 'Aria',
    'user-default.png': 'Bram',
    '1700000001-Cole.png': 'Cole',
  },
  persona_descriptions: {
    '1700000000-Aria.png': {
      description: '{{user}} is a cartographer. {{char}} trusts {{USER}}\'s maps. {{random:a,b}} stays.',
      position: 0, depth: 2, role: 0, lorebook: 'Aria lore', title: 'The Mapmaker',
      connections: [{ type: 'character', id: 'x.png' }],
    },
    'user-default.png': { description: '', position: 0 },
    'orphan.png': { description: 'No persona owns this.' },
  },
  default_persona: 'user-default.png',
};

const text = (value: unknown) => JSON.stringify(value);

describe('convertStPersonaBackup', () => {
  it('turns each persona into a marked entity with a fresh id', () => {
    const result = convertStPersonaBackup(text(backup), []);
    expect(result.personas.map((p) => p.entity.name)).toEqual(['Aria', 'Bram', 'Cole']);
    for (const { entity } of result.personas) expect(entity.persona).toBe(true);
    const ids = result.personas.map((p) => p.entity.id);
    expect(new Set(ids).size).toBe(3);
    expect(ids).not.toContain('1700000000-Aria.png');
    expect(convertStPersonaBackup(text(backup), []).personas[0].entity.id).not.toBe(ids[0]);
  });

  it('rewrites the user macro to the persona name and the char macro to "the other character"', () => {
    const [aria] = convertStPersonaBackup(text(backup), []).personas;
    expect(aria.entity.aiDescription)
      .toBe('Aria is a cartographer. the other character trusts Aria\'s maps. {{random:a,b}} stays.');
  });

  it('drops the position, depth, role, title, lorebook, and connections fields', () => {
    const [aria] = convertStPersonaBackup(text(backup), []).personas;
    expect(Object.keys(aria.entity).sort()).toEqual(['aiDescription', 'id', 'name', 'persona']);
    expect(JSON.stringify(aria.entity)).not.toMatch(/Mapmaker|Aria lore|x\.png/);
  });

  it('leaves the description off when ST holds none', () => {
    const bram = convertStPersonaBackup(text(backup), []).personas[1];
    expect(bram.entity).not.toHaveProperty('aiDescription');
  });

  it('matches an image only when its filename equals the persona key', () => {
    const result = convertStPersonaBackup(text(backup), ['1700000000-Aria.png', 'User-Default.png', 'cole.png']);
    expect(result.personas.map((p) => p.image ?? null)).toEqual(['1700000000-Aria.png', null, null]);
    expect(result.unusedImages).toEqual(['User-Default.png', 'cole.png']);
  });

  it('reports each imageless persona and each skipped entry', () => {
    const result = convertStPersonaBackup(text({
      ...backup,
      personas: { ...backup.personas, 'blank.png': '  ', 'number.png': 7 },
    }), ['1700000000-Aria.png']);
    expect(result.personas.filter((p) => !p.image).map((p) => p.entity.name)).toEqual(['Bram', 'Cole']);
    expect(result.skipped).toEqual([
      { key: 'blank.png', reason: 'no name' },
      { key: 'number.png', reason: 'no name' },
      { key: 'orphan.png', reason: 'a description with no persona' },
    ]);
  });

  it("names ST's default persona by its converted entity", () => {
    const result = convertStPersonaBackup(text(backup), []);
    expect(result.defaultId).toBe(result.personas[1].entity.id);
  });

  it('has no default when the default key names no converted persona', () => {
    expect(convertStPersonaBackup(text({ ...backup, default_persona: 'gone.png' }), []).defaultId).toBeUndefined();
    expect(convertStPersonaBackup(text({ ...backup, default_persona: null }), []).defaultId).toBeUndefined();
  });

  it.each([
    ['text that is not JSON', '{ personas: '],
    ['a JSON array', '[]'],
    ['a file with no personas map', text({ persona_descriptions: {} })],
    ['a file with no descriptions map', text({ personas: { 'a.png': 'Aria' } })],
    ['a personas map that is an array', text({ personas: ['Aria'], persona_descriptions: {} })],
    ['a world file', text({ formamorphKind: 'world', name: 'Sedge' })],
  ])('rejects %s with a clear error', (_label, input) => {
    expect(() => convertStPersonaBackup(input, [])).toThrow(/SillyTavern persona backup/);
  });

  it('rejects a backup that yields no persona', () => {
    expect(() => convertStPersonaBackup(text({ personas: { 'a.png': '' }, persona_descriptions: {} }), []))
      .toThrow(/no personas/);
  });
});

describe('stPersonaReport', () => {
  it('lists each imageless, skipped, unsaved persona and each unused image', () => {
    const result = convertStPersonaBackup(text(backup), ['1700000000-Aria.png', 'stray.png']);
    const cole = result.personas[2].entity.id;
    expect(stPersonaReport(result, new Set([cole]))).toEqual([
      'Bram: no image named user-default.png',
      'Cole: not saved',
      'orphan.png: skipped, a description with no persona',
      'stray.png: matches no persona',
    ]);
  });

  it('is empty for a clean import', () => {
    const clean = { personas: { 'a.png': 'Aria' }, persona_descriptions: {} };
    expect(stPersonaReport(convertStPersonaBackup(text(clean), ['a.png']))).toEqual([]);
  });
});

describe('importedDefaultPersona', () => {
  const library = new Set(['lib-1']);

  it('adopts the imported default when no global default is set', () => {
    expect(importedDefaultPersona(undefined, library, 'new-1')).toBe('new-1');
  });

  it('keeps a global default that still names a library persona', () => {
    expect(importedDefaultPersona('lib-1', library, 'new-1')).toBeUndefined();
  });

  it('adopts the imported default over one that no longer names a persona', () => {
    expect(importedDefaultPersona('deleted', library, 'new-1')).toBe('new-1');
  });

  it('changes nothing when the backup has no default', () => {
    expect(importedDefaultPersona(undefined, library, undefined)).toBeUndefined();
  });
});
