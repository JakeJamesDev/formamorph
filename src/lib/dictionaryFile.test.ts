import { describe, it, expect } from 'vitest';
import { buildDictionaryFile, parseDictionaryFile, parseDictionaryImport, DICTIONARY_FILE_KIND } from './dictionaryFile';
import { APP_VERSION } from './version';
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
