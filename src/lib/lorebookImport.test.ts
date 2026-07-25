import { describe, it, expect } from 'vitest';
import { convertLorebook } from './lorebookImport';
import type { DictionaryEntry } from '@/types';

// Grab a converted entry by its joined keywords, since ids are randomized.
const byKey = (entries: DictionaryEntry[], key: string) => entries.find((e) => e.key.join(', ') === key)!;

describe('convertLorebook — Character Card V3 lorebook (array entries)', () => {
  it('maps core fields; a true `enabled`/false `constant` stay unset (defaults)', () => {
    const book = {
      name: 'Lore',
      entries: [{ keys: ['dragon', 'wyrm'], content: 'A big lizard.', enabled: true, insertion_order: 10, case_sensitive: true, constant: false, name: 'Dragon' }],
    };
    const d = convertLorebook(book);
    expect(d?.name).toBe('Lore');
    const e = d!.entries[0];
    expect(e).toMatchObject({ name: 'Dragon', key: ['dragon', 'wyrm'], value: 'A big lizard.', caseSensitive: true, priority: 10 });
    expect(e.enabled).toBeUndefined();
    expect(e.constant).toBeUndefined();
  });

  it('maps use_regex and drops secondary keys under regex (spec)', () => {
    const d = convertLorebook({ entries: [{ keys: ['drag.n'], content: 'x', use_regex: true, secondary_keys: ['red'] }] });
    const e = d!.entries[0];
    expect(e.useRegex).toBe(true);
    expect(e.secondaryKeys).toBeUndefined();
  });

  it('keeps secondary keys only when `selective` is not false', () => {
    const on = convertLorebook({ entries: [{ keys: ['a'], content: 'x', secondary_keys: ['b'], selective: true }] });
    const off = convertLorebook({ entries: [{ keys: ['a'], content: 'x', secondary_keys: ['b'], selective: false }] });
    const omitted = convertLorebook({ entries: [{ keys: ['a'], content: 'x', secondary_keys: ['b'] }] });
    expect(on!.entries[0].secondaryKeys).toEqual(['b']);
    expect(off!.entries[0].secondaryKeys).toBeUndefined();
    expect(omitted!.entries[0].secondaryKeys).toEqual(['b']);
  });

  it('derives recursive from book `recursive_scanning`, honoring ST excludeRecursion', () => {
    const on = convertLorebook({ recursive_scanning: true, entries: [{ keys: ['a'], content: 'x' }] });
    const off = convertLorebook({ entries: [{ keys: ['a'], content: 'x' }] });
    const excluded = convertLorebook({ recursive_scanning: true, entries: [{ keys: ['a'], content: 'x', excludeRecursion: true }] });
    expect(on!.entries[0].recursive).toBe(true);
    expect(off!.entries[0].recursive).toBeUndefined();
    expect(excluded!.entries[0].recursive).toBeUndefined();
  });

  it('takes entry scan_depth over the book default', () => {
    const d = convertLorebook({ scan_depth: 5, entries: [{ keys: ['a'], content: 'x' }, { keys: ['b'], content: 'y', scan_depth: 2 }] });
    expect(byKey(d!.entries, 'a').scanDepth).toBe(5);
    expect(byKey(d!.entries, 'b').scanDepth).toBe(2);
  });

  it('maps before_char/after_char to before/after', () => {
    const d = convertLorebook({ entries: [{ keys: ['a'], content: 'x', position: 'before_char' }, { keys: ['b'], content: 'y', position: 'after_char' }] });
    expect(byKey(d!.entries, 'a').position).toBe('before');
    expect(byKey(d!.entries, 'b').position).toBe('after');
  });

  it('sorts entries by insertion_order', () => {
    const d = convertLorebook({ entries: [{ keys: ['a'], content: 'x', insertion_order: 20 }, { keys: ['b'], content: 'y', insertion_order: 5 }] });
    expect(d!.entries.map((e) => e.key)).toEqual([['b'], ['a']]);
  });

  it('strips leading @@ decorator lines from content', () => {
    const d = convertLorebook({ entries: [{ keys: ['a'], content: '@@position after_char\n@@depth 4\nReal content.' }] });
    expect(d!.entries[0].value).toBe('Real content.');
  });

  it('maps ST matchWholeWords', () => {
    const d = convertLorebook({ entries: [{ keys: ['a'], content: 'x', matchWholeWords: true }] });
    expect(d!.entries[0].matchWholeWords).toBe(true);
  });

  it('maps ST selectiveLogic to our secondary exclude/all flags', () => {
    const mk = (logic: number) =>
      convertLorebook({ entries: [{ keys: ['a'], content: 'x', secondary_keys: ['b'], selective: true, selectiveLogic: logic }] })!.entries[0];
    expect(mk(0).secondaryExclude).toBeUndefined(); // AND_ANY (default)
    expect(mk(0).secondaryAll).toBeUndefined();
    expect(mk(1)).toMatchObject({ secondaryExclude: true, secondaryAll: true }); // NOT_ALL
    expect(mk(2)).toMatchObject({ secondaryExclude: true }); // NOT_ANY
    expect(mk(2).secondaryAll).toBeUndefined();
    expect(mk(3)).toMatchObject({ secondaryAll: true }); // AND_ALL
    expect(mk(3).secondaryExclude).toBeUndefined();
  });

  it('maps a book description', () => {
    expect(convertLorebook({ name: 'L', description: 'notes', entries: [{ keys: ['a'], content: 'x' }] })?.description).toBe('notes');
  });
});

describe('convertLorebook — SillyTavern World Info (object-map entries)', () => {
  it('reads legacy field names and inverts `disable`', () => {
    const d = convertLorebook({
      entries: {
        '0': { key: ['ghost'], keysecondary: ['pale'], comment: 'Ghost', content: 'A specter.', disable: true, order: 3, position: 0, selective: true },
      },
    });
    const e = d!.entries[0];
    expect(e).toMatchObject({ name: 'Ghost', key: ['ghost'], secondaryKeys: ['pale'], value: 'A specter.', enabled: false, position: 'before', priority: 3 });
  });
});

describe('convertLorebook — wrappers & naming', () => {
  it('extracts a card lorebook and names it from the card when the book is unnamed', () => {
    const d = convertLorebook({ spec: 'chara_card_v3', data: { name: 'Char', character_book: { entries: [{ keys: ['a'], content: 'x' }] } } });
    expect(d?.name).toBe('Char');
    expect(d?.entries).toHaveLength(1);
  });

  it('extracts a standalone {spec:lorebook_v3, data} book', () => {
    const d = convertLorebook({ spec: 'lorebook_v3', data: { name: 'Standalone', entries: [{ keys: ['a'], content: 'x' }] } });
    expect(d?.name).toBe('Standalone');
  });

  it('uses fallbackName when nothing names the book', () => {
    expect(convertLorebook({ entries: [{ keys: ['a'], content: 'x' }] }, 'My File')?.name).toBe('My File');
  });
});

describe('convertLorebook — rejects non-lorebooks', () => {
  it('returns null for worlds, saves, random objects, and non-objects', () => {
    expect(convertLorebook({ worldOverview: {}, stats: [] })).toBeNull();
    expect(convertLorebook({ currentState: {}, stateHistory: [] })).toBeNull();
    expect(convertLorebook({ foo: 'bar' })).toBeNull();
    expect(convertLorebook(null)).toBeNull();
    expect(convertLorebook('nope')).toBeNull();
  });

  it('returns null when there are no usable entries', () => {
    expect(convertLorebook({ entries: [] })).toBeNull();
    expect(convertLorebook({ entries: [{}] })).toBeNull(); // no keys, no content, not constant
  });
});
