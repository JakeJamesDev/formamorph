import { describe, it, expect } from 'vitest';
import {
  parseKeywords,
  getActivatedDictionary,
  buildDictionaryContext,
  flattenEnabledBookEntries,
} from './dictionaryUtils';
import type { Dictionary, DictionaryEntry } from '@/types';

const entry = (over: Partial<DictionaryEntry>): DictionaryEntry => ({
  id: '1',
  name: '',
  key: '',
  value: '',
  ...over,
});

const book = (over: Partial<Dictionary>): Dictionary => ({
  id: 'b',
  name: 'Book',
  entries: [],
  ...over,
});

describe('parseKeywords', () => {
  it('splits, trims, and drops empty keywords', () => {
    expect(parseKeywords(entry({ key: 'dragon,  fire ,, ice ' }))).toEqual(['dragon', 'fire', 'ice']);
  });

  it('returns [] for an empty key', () => {
    expect(parseKeywords(entry({ key: '' }))).toEqual([]);
  });
});

describe('getActivatedDictionary — base matching', () => {
  const dragon = entry({ id: 'd', key: 'dragon, wyrm', value: 'A big lizard.' });
  const castle = entry({ id: 'c', key: 'castle', value: 'A fortress.' });
  const dict = [dragon, castle];

  it('matches case-insensitively across multiple scene texts', () => {
    expect(getActivatedDictionary(dict, ['The DRAGON roars', 'nothing here'])).toEqual([dragon]);
  });

  it('matches on any of an entry keyword', () => {
    expect(getActivatedDictionary(dict, ['a lone wyrm'])).toEqual([dragon]);
  });

  it('returns [] when the dictionary is empty', () => {
    expect(getActivatedDictionary([], ['dragon'])).toEqual([]);
  });

  it('returns [] when there is no usable text', () => {
    expect(getActivatedDictionary(dict, ['', null as unknown as string])).toEqual([]);
  });

  it('preserves declaration order in the result', () => {
    expect(getActivatedDictionary(dict, ['castle and dragon'])).toEqual([dragon, castle]);
  });
});

describe('getActivatedDictionary — lorebook activation fields', () => {
  it('skips disabled entries', () => {
    const off = entry({ id: 'o', key: 'dragon', value: 'x', enabled: false });
    expect(getActivatedDictionary([off], ['dragon here'])).toEqual([]);
  });

  it('always includes constant entries, even with no matching text', () => {
    const always = entry({ id: 'a', key: 'never-matches', value: 'World rule.', constant: true });
    expect(getActivatedDictionary([always], ['unrelated'])).toEqual([always]);
    expect(getActivatedDictionary([always], [''])).toEqual([always]);
  });

  it('honors caseSensitive', () => {
    const cs = entry({ id: 'x', key: 'IT', value: 'the entity', caseSensitive: true });
    expect(getActivatedDictionary([cs], ['it happened'])).toEqual([]);
    expect(getActivatedDictionary([cs], ['IT looms'])).toEqual([cs]);
  });

  it('treats keys as regex with useRegex', () => {
    const rx = entry({ id: 'r', key: 'dragons?\\b', value: 'lizard', useRegex: true });
    expect(getActivatedDictionary([rx], ['a dragon'])).toEqual([rx]);
    expect(getActivatedDictionary([rx], ['dragons roam'])).toEqual([rx]);
    expect(getActivatedDictionary([rx], ['dragonfly'])).toEqual([]); // \b stops the partial word
  });

  it('a malformed regex simply never matches (no throw)', () => {
    const bad = entry({ id: 'b', key: '(', value: 'x', useRegex: true });
    expect(getActivatedDictionary([bad], ['anything ('])).toEqual([]);
  });

  it('requires a secondary key when secondaryKeys is set (primary AND secondary)', () => {
    const red = entry({ id: 'rd', key: 'dragon', secondaryKeys: 'red, crimson', value: 'The Red Dragon.' });
    expect(getActivatedDictionary([red], ['a dragon appears'])).toEqual([]); // primary only
    expect(getActivatedDictionary([red], ['a red dragon appears'])).toEqual([red]); // both present
  });

  it('matchWholeWords matches whole words only', () => {
    const art = entry({ id: 'w', key: 'art', value: 'x', matchWholeWords: true });
    expect(getActivatedDictionary([art], ['the art show'])).toEqual([art]);
    expect(getActivatedDictionary([art], ['a cart'])).toEqual([]);
    expect(getActivatedDictionary([art], ['start here'])).toEqual([]);
  });

  it('secondaryAll requires every secondary keyword', () => {
    const e = entry({ id: 'sa', key: 'dragon', secondaryKeys: 'red, ancient', secondaryAll: true, value: 'x' });
    expect(getActivatedDictionary([e], ['a red dragon'])).toEqual([]); // missing "ancient"
    expect(getActivatedDictionary([e], ['an ancient red dragon'])).toEqual([e]);
  });

  it('secondaryExclude fires only when the secondaries are absent (NOT-ANY)', () => {
    const e = entry({ id: 'sx', key: 'dragon', secondaryKeys: 'friendly', secondaryExclude: true, value: 'x' });
    expect(getActivatedDictionary([e], ['a lone dragon'])).toEqual([e]);
    expect(getActivatedDictionary([e], ['a friendly dragon'])).toEqual([]);
  });

  it('secondaryExclude + secondaryAll fires unless all secondaries appear (NOT-ALL)', () => {
    const e = entry({ id: 'sxa', key: 'dragon', secondaryKeys: 'red, ancient', secondaryExclude: true, secondaryAll: true, value: 'x' });
    expect(getActivatedDictionary([e], ['a red dragon'])).toEqual([e]); // not all present → fires
    expect(getActivatedDictionary([e], ['an ancient red dragon'])).toEqual([]); // all present → excluded
  });
});

describe('getActivatedDictionary — scanDepth over history', () => {
  const ghost = entry({ id: 'g', key: 'ghost', value: 'A specter.' });

  it('scans all history when scanDepth is unset', () => {
    const history = ['a ghost long ago', 'm2', 'm3', 'm4'];
    expect(getActivatedDictionary([ghost], ['calm scene'], { history })).toEqual([ghost]);
  });

  it('caps the lookback to the last N messages when scanDepth is set', () => {
    const shallow = entry({ ...ghost, scanDepth: 2 });
    // ghost is 3 messages back → outside a depth of 2
    expect(getActivatedDictionary([shallow], ['calm scene'], { history: ['a ghost', 'm2', 'm3', 'm4'] })).toEqual([]);
    // ghost within the last 2
    expect(getActivatedDictionary([shallow], ['calm scene'], { history: ['m1', 'm2', 'a ghost', 'm4'] })).toEqual([shallow]);
  });

  it('scanDepth 0 scans the current scene only, not history', () => {
    const none = entry({ ...ghost, scanDepth: 0 });
    expect(getActivatedDictionary([none], ['calm scene'], { history: ['a ghost'] })).toEqual([]);
    expect(getActivatedDictionary([none], ['a ghost in the room'], { history: ['old'] })).toEqual([none]);
  });
});

describe('getActivatedDictionary — recursive activation', () => {
  it("chains through recursive entries' content, bounded", () => {
    const a = entry({ id: 'a', key: 'gate', value: 'Beyond the gate lies the Keep.' });
    const b = entry({ id: 'b', key: 'keep', value: 'The Keep houses the Warden.', recursive: true });
    const c = entry({ id: 'c', key: 'warden', value: 'The Warden guards it.', recursive: true });
    // scene mentions only "gate" → a fires; a's text mentions "Keep" → b; b's text mentions "Warden" → c.
    expect(getActivatedDictionary([a, b, c], ['the gate creaks'])).toEqual([a, b, c]);
  });

  it('does not recursively activate a non-recursive entry', () => {
    const a = entry({ id: 'a', key: 'gate', value: 'Beyond the gate lies the Keep.' });
    const b = entry({ id: 'b', key: 'keep', value: 'The Keep.' }); // not recursive
    expect(getActivatedDictionary([a, b], ['the gate creaks'])).toEqual([a]);
  });
});

describe('buildDictionaryContext', () => {
  it('labels entries by name (falling back to key) under the "Foreground Lore" heading', () => {
    const named = entry({ name: 'Dragon', key: 'dragon', value: 'Big.' });
    const keyed = entry({ name: '', key: 'castle', value: 'Stone.' });
    expect(buildDictionaryContext([named, keyed])).toBe('## Foreground Lore\nDragon: Big.\ncastle: Stone.');
  });

  it('omits the heading with includeHeading: false (the chip body)', () => {
    const named = entry({ name: 'Dragon', key: 'dragon', value: 'Big.' });
    expect(buildDictionaryContext([named], false)).toBe('Dragon: Big.');
  });

  it('renders entries in the given array order (position/order is the caller\'s job)', () => {
    const a = entry({ name: 'A', value: 'a' });
    const b = entry({ name: 'B', value: 'b' });
    expect(buildDictionaryContext([b, a], false)).toBe('B: b\nA: a');
  });

  it('skips entries with no value', () => {
    expect(buildDictionaryContext([entry({ name: 'Empty', key: 'x', value: '' })])).toBe('');
    expect(buildDictionaryContext([entry({ name: 'Empty', key: 'x', value: '' })], false)).toBe('');
  });

  it('returns "" for no entries', () => {
    expect(buildDictionaryContext([])).toBe('');
    expect(buildDictionaryContext([], false)).toBe('');
  });
});

describe('flattenEnabledBookEntries', () => {
  const a = entry({ id: 'a', value: 'a' });
  const b = entry({ id: 'b', value: 'b' });
  const c = entry({ id: 'c', value: 'c' });

  it('concatenates books in order, entries in per-book order', () => {
    const books = [book({ id: 'b1', entries: [a, b] }), book({ id: 'b2', entries: [c] })];
    expect(flattenEnabledBookEntries(books).map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('drops every entry of a disabled book, including entries with enabled unset', () => {
    const books = [book({ id: 'b1', enabled: false, entries: [a] }), book({ id: 'b2', entries: [b] })];
    expect(flattenEnabledBookEntries(books).map((e) => e.id)).toEqual(['b']);
  });

  it('includes books with enabled unset or true', () => {
    const books = [book({ id: 'b1', entries: [a] }), book({ id: 'b2', enabled: true, entries: [b] })];
    expect(flattenEnabledBookEntries(books).map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('keeps a per-entry disabled entry (activation filters it, not the flatten)', () => {
    const off = entry({ id: 'off', value: 'x', enabled: false });
    expect(flattenEnabledBookEntries([book({ entries: [off] })])).toContainEqual(off);
  });

  it('returns [] for undefined or empty input', () => {
    expect(flattenEnabledBookEntries(undefined)).toEqual([]);
    expect(flattenEnabledBookEntries([])).toEqual([]);
  });
});
