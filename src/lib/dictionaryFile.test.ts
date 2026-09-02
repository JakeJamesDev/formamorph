import { describe, it, expect } from 'vitest';
import { buildDictionaryFile, parseDictionaryFile, parseDictionaryImport, DICTIONARY_FILE_KIND } from './dictionaryFile';
import { APP_VERSION } from './version';
import { phValues } from '@/test/placeholderValues';
import type { Dictionary } from '@/types';

const book = (over: Partial<Dictionary> = {}): Dictionary => ({
  id: 'b1',
  name: 'Lore',
  entries: [
    { id: 'e1', name: 'Dragon', key: ['dragon'], value: 'A big lizard.', position: 'before' },
    { id: 'e2', name: 'Castle', key: ['castle'], value: 'A fortress.' },
  ],
  ...over,
});

describe('buildDictionaryFile', () => {
  it('stamps the discriminator + version and carries name/entries', () => {
    const file = buildDictionaryFile(book());
    expect(file.formamorphKind).toBe(DICTIONARY_FILE_KIND);
    expect(file.version).toBe(APP_VERSION);
    expect(file.name).toBe('Lore');
    expect(file.entries).toHaveLength(2);
  });

  it('emits enabled only when the book is disabled', () => {
    expect('enabled' in buildDictionaryFile(book())).toBe(false);
    expect(buildDictionaryFile(book({ enabled: false })).enabled).toBe(false);
  });

  it('carries a description only when present, and round-trips it', () => {
    expect('description' in buildDictionaryFile(book())).toBe(false);
    expect(parseDictionaryFile(buildDictionaryFile(book({ description: 'notes' }))).description).toBe('notes');
  });
});

describe('a dictionary file’s placeholders', () => {
  const weather = { id: 'weather', name: 'Weather', values: phValues(['Rain', 'Sun']) };
  const unused = { id: 'unused', name: 'Season', values: phValues(['Spring']) };
  const lore = { id: 'lore', name: 'Lore', values: phValues(['{{ph:weather:world:v1}} tales']) };

  it('writes the book’s own placeholders as they are, and the shared defs its entries and they reach', () => {
    const b = book({ placeholders: [lore], entries: [{ id: 'e1', name: 'Fen', key: ['fen'], value: 'It rains {{ph:weather:world:p1}}.' }] });
    const file = buildDictionaryFile(b, [weather, unused, lore]);
    expect(file.placeholders).toEqual([lore]);
    expect(file.sharedPlaceholders).toEqual([weather]);
    const parsed = parseDictionaryFile(file);
    expect(parsed.placeholders).toEqual([lore]);
    expect(parsed.sharedPlaceholders).toEqual([weather]);
  });

  it('drops the folder reference from every def it carries — folders are the world’s', () => {
    const grouped = { ...weather, groupId: 'sky' };
    const b = book({ placeholders: [{ ...lore, groupId: 'tales' }], entries: [{ id: 'e1', name: 'Fen', key: ['fen'], value: '{{ph:weather:world:p1}}' }] });
    const file = buildDictionaryFile(b, [grouped, lore]);
    expect(file.placeholders?.[0]).not.toHaveProperty('groupId');
    expect(file.sharedPlaceholders?.[0]).not.toHaveProperty('groupId');
    expect(file.sharedPlaceholders?.map((p) => p.id)).toEqual(['weather']);
  });

  it('carries only the shared defs a book with nothing of its own uses, and reads an old file as owned', () => {
    const b = book({ entries: [{ id: 'e1', name: 'Fen', key: ['fen'], value: '{{ph:weather:world:p1}}' }] });
    const file = buildDictionaryFile(b, [weather, unused]);
    expect(file).not.toHaveProperty('placeholders');
    expect(file.sharedPlaceholders).toEqual([weather]);
    const old = parseDictionaryFile({ formamorphKind: 'dictionary', name: 'Old', entries: [], placeholders: [weather] });
    expect(old.placeholders).toEqual([weather]);
    expect(old).not.toHaveProperty('sharedPlaceholders');
  });
});

describe('parseDictionaryFile', () => {
  it('round-trips content but regenerates the book id and every entry id', () => {
    const original = book();
    const parsed = parseDictionaryFile(buildDictionaryFile(original));
    expect(parsed.name).toBe('Lore');
    expect(parsed.entries.map((e) => ({ name: e.name, key: e.key, value: e.value, position: e.position })))
      .toEqual(original.entries.map((e) => ({ name: e.name, key: e.key, value: e.value, position: e.position })));
    // Fresh ids, so an import never collides with existing content.
    expect(parsed.id).not.toBe(original.id);
    expect(parsed.entries.map((e) => e.id)).not.toEqual(original.entries.map((e) => e.id));
  });

  it('preserves a disabled book flag', () => {
    expect(parseDictionaryFile(buildDictionaryFile(book({ enabled: false }))).enabled).toBe(false);
  });

  it('rejects a world file, a save envelope, and non-objects', () => {
    expect(() => parseDictionaryFile({ worldOverview: {}, stats: [] })).toThrow();
    expect(() => parseDictionaryFile({ currentState: {}, stateHistory: [] })).toThrow();
    expect(() => parseDictionaryFile(null)).toThrow();
    expect(() => parseDictionaryFile('nope')).toThrow();
  });

  it('two imports of the same file produce disjoint id sets', () => {
    const file = buildDictionaryFile(book());
    const first = parseDictionaryFile(file);
    const second = parseDictionaryFile(file);
    const ids = new Set([first.id, ...first.entries.map((e) => e.id)]);
    for (const id of [second.id, ...second.entries.map((e) => e.id)]) expect(ids.has(id)).toBe(false);
  });

  it('coerces a missing/non-array entries list to empty and falls back the name', () => {
    const parsed = parseDictionaryFile({ formamorphKind: 'dictionary', version: '2.0.1' });
    expect(parsed.name).toBe('Imported Dictionary');
    expect(parsed.entries).toEqual([]);
  });
});

describe('parseDictionaryImport', () => {
  it('passes a native dictionary file through', () => {
    const parsed = parseDictionaryImport(buildDictionaryFile(book()));
    expect(parsed.name).toBe('Lore');
    expect(parsed.entries).toHaveLength(2);
  });

  it('converts a foreign lorebook, titling it from the fallback name', () => {
    const parsed = parseDictionaryImport({ entries: [{ keys: ['a'], content: 'x' }] }, 'From File');
    expect(parsed.name).toBe('From File');
    expect(parsed.entries).toHaveLength(1);
  });

  it('throws a targeted message for a world or save file', () => {
    expect(() => parseDictionaryImport({ formamorphKind: 'world' })).toThrow(/Worlds tab/);
    expect(() => parseDictionaryImport({ formamorphKind: 'save' })).toThrow(/save file/);
  });

  it('throws a generic message for anything unrecognized', () => {
    expect(() => parseDictionaryImport({ foo: 'bar' })).toThrow(/Unrecognized/);
  });
});

/**
 * A book's listing tags and cover.
 *
 * Same allowlist hazard as the character card: a field the build/parse pair does not name is dropped on
 * the way through a file, without anything saying so.
 */
describe('a dictionary’s tags and cover', () => {
  it('carries both through a round trip', () => {
    const book = { id: 'd1', name: 'Fen Cant', entries: [], tags: ['lore', 'marsh'], thumbnail: 'data:image/webp;base64,AAAA' };

    const parsed = parseDictionaryFile(buildDictionaryFile(book));

    expect(parsed.tags).toEqual(['lore', 'marsh']);
    expect(parsed.thumbnail).toBe('data:image/webp;base64,AAAA');
  });

  it('leaves both off a book that has neither', () => {
    const file = buildDictionaryFile({ id: 'd1', name: 'Plain', entries: [] });

    expect(file).not.toHaveProperty('tags');
    expect(file).not.toHaveProperty('thumbnail');
  });

  it('drops junk in the tag list', () => {
    const parsed = parseDictionaryFile({
      formamorphKind: DICTIONARY_FILE_KIND, version: '2.8.0', name: 'Fen Cant', entries: [],
      tags: ['lore', 3, '  ', null],
    });

    expect(parsed.tags).toEqual(['lore']);
  });
});
