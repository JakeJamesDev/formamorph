import { describe, it, expect } from 'vitest';
import {
  parseKeywords,
  getActivatedDictionary,
  buildDictionaryContext,
} from './dictionaryUtils';
import type { DictionaryEntry } from '@/types';

const entry = (over: Partial<DictionaryEntry>): DictionaryEntry => ({
  id: '1',
  name: '',
  key: '',
  value: '',
  ...over,
});

describe('parseKeywords', () => {
  it('splits, trims, and drops empty keywords', () => {
    expect(parseKeywords(entry({ key: 'dragon,  fire ,, ice ' }))).toEqual([
      'dragon',
      'fire',
      'ice',
    ]);
  });

  it('returns [] for an empty key', () => {
    expect(parseKeywords(entry({ key: '' }))).toEqual([]);
  });
});

describe('getActivatedDictionary', () => {
  const dragon = entry({ id: 'd', key: 'dragon, wyrm', value: 'A big lizard.' });
  const castle = entry({ id: 'c', key: 'castle', value: 'A fortress.' });
  const dict = [dragon, castle];

  it('matches case-insensitively across multiple texts', () => {
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
});

describe('buildDictionaryContext', () => {
  it('labels entries by name, falling back to key', () => {
    const named = entry({ name: 'Dragon', key: 'dragon', value: 'Big.' });
    const keyed = entry({ name: '', key: 'castle', value: 'Stone.' });
    expect(buildDictionaryContext([named, keyed])).toBe(
      'Relevant Information:\nDragon: Big.\ncastle: Stone.',
    );
  });

  it('skips entries with no value', () => {
    expect(buildDictionaryContext([entry({ name: 'Empty', key: 'x', value: '' })])).toBe('');
  });

  it('returns "" for no entries', () => {
    expect(buildDictionaryContext([])).toBe('');
  });
});
