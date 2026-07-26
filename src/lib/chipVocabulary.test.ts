import { describe, it, expect } from 'vitest';
import type { Placeholder } from '@/types';
import { promptVocabulary, placeholderVocabulary } from './chipVocabulary';
import { encodePlaceholderToken, decodePlaceholderToken } from './placeholders';

const P = (id: string, values: string[]): Placeholder => ({ id, name: `name-${id}`, values });
const tok = (id: string, mode: 'world' | 'unique', pid = 'p1') => encodePlaceholderToken({ id, mode, placementId: pid });

describe('promptVocabulary (regression — the existing prompt family still works)', () => {
  const v = promptVocabulary([]);
  it('recognizes a registry token and reports its label/color', () => {
    expect(v.isKnown('<WORLD DESCRIPTION>')).toBe(true);
    expect(v.label('<WORLD DESCRIPTION>')).toBe('World');
    expect(v.color('<WORLD DESCRIPTION>')).toBeTruthy();
  });
  it('changes a variant axis via setAxis', () => {
    // Location has a content axis; switching it to summary appends the variant suffix.
    const next = v.setAxis('<LOCATION>', 'content', 'summary');
    expect(next).toBe('<LOCATION|summary>');
    expect(v.variantLabel(next)).toContain('Summary');
  });
  it('parses tokens out of text', () => {
    const segs = v.parse('a <WORLD DESCRIPTION> b');
    expect(segs).toEqual([
      { type: 'text', value: 'a ' },
      { type: 'variable', token: '<WORLD DESCRIPTION>' },
      { type: 'text', value: ' b' },
    ]);
  });
});

describe('placeholderVocabulary', () => {
  const placeholders = [P('eye', ['Red', 'Blue', 'Green']), P('king', ['Aldric'])];
  const v = placeholderVocabulary(placeholders);

  it('parses placeholder tokens out of text', () => {
    const t = tok('eye', 'world');
    expect(v.parse(`eyes: ${t}.`)).toEqual([
      { type: 'text', value: 'eyes: ' },
      { type: 'variable', token: t },
      { type: 'text', value: '.' },
    ]);
  });

  it('labels a chip by the placeholder name, and marks a deleted one', () => {
    expect(v.label(tok('eye', 'world'))).toBe('name-eye');
    expect(v.label(tok('ghost', 'world'))).toBe('(missing)');
  });

  it('shows the World/Unique axis only for a Wildcard (2+ values)', () => {
    expect(v.axes(tok('eye', 'world'))).toHaveLength(1); // 3 values → Wildcard
    expect(v.axes(tok('king', 'world'))).toHaveLength(0); // 1 value → Variable, no axis
    expect(v.axes(tok('ghost', 'world'))).toHaveLength(0); // missing → none
  });

  it('reflects and flips the mode', () => {
    expect(v.variantLabel(tok('eye', 'world'))).toBeNull(); // World is the default, not shown
    expect(v.variantLabel(tok('eye', 'unique'))).toBe('Unique');
    expect(v.selection(tok('eye', 'unique'))).toEqual({ mode: 'unique' });

    const flipped = v.setAxis(tok('eye', 'world', 'p9'), 'mode', 'unique');
    expect(decodePlaceholderToken(flipped)).toEqual({ id: 'eye', mode: 'unique', placementId: 'p9' });
    const back = v.setAxis(flipped, 'mode', null);
    expect(decodePlaceholderToken(back)).toEqual({ id: 'eye', mode: 'world', placementId: 'p9' });
  });

  it('offers each placeholder in the palette', () => {
    const items = v.palette();
    expect(items.map((i) => i.label)).toEqual(['name-eye', 'name-king']);
    expect(items.every((i) => decodePlaceholderToken(i.token))).toBe(true);
  });

  it('re-mints a fresh placement id on insert (so two Unique chips roll independently)', () => {
    const paletteToken = v.palette()[0].token;
    const a = decodePlaceholderToken(v.freshInsertToken(paletteToken))!;
    const b = decodePlaceholderToken(v.freshInsertToken(paletteToken))!;
    expect(a.placementId).not.toBe('palette');
    expect(a.placementId).not.toBe(b.placementId);
    expect(a.id).toBe('eye');
  });
});

describe('chip affixes in the editor vocabulary (gate 8)', () => {
  const vocab = promptVocabulary([]);

  it('offers affixes only on chips that render an inline value', () => {
    expect(vocab.affixes('<LOCATION|name>')).toEqual({ pre: '', post: '' });
    expect(vocab.affixes('<ENTITIES>')).toEqual({ pre: '', post: '' });
    expect(vocab.affixes('<NOTES>')).toEqual({ pre: '', post: '' });
    // Block-rendering chips get no fields at all.
    expect(vocab.affixes('<WORLD DESCRIPTION>')).toBeNull();
    expect(vocab.affixes('<STATS DESCRIPTION>')).toBeNull();
  });

  it('writes affixes into the token and reads them back', () => {
    const t = vocab.setAffixes('<ENTITIES|name>', ' with ', ' present');
    expect(t).toBe('<ENTITIES|name|pre=" with "|post=" present">');
    expect(vocab.affixes(t)).toEqual({ pre: ' with ', post: ' present' });
  });

  it('removes the part when an affix is set to empty (canonical form)', () => {
    const both = vocab.setAffixes('<ENTITIES|name>', ' with ', ' present');
    expect(vocab.setAffixes(both, '', ' present')).toBe('<ENTITIES|name|post=" present">');
    expect(vocab.setAffixes(both, '', '')).toBe('<ENTITIES|name>');
  });

  it('keeps affixes when a mode is switched — the wording is not lost to a click', () => {
    const t = vocab.setAffixes('<ENTITIES|name>', ' with ', ' present');
    const switched = vocab.setAxis(t, 'scope', 'reachable');
    expect(vocab.affixes(switched)).toEqual({ pre: ' with ', post: ' present' });
    expect(vocab.selection(switched).scope).toBe('reachable');
  });

  it('reports the same variant label affixed or not, so the chip reads the same', () => {
    expect(vocab.variantLabel('<ENTITIES|name|pre=" with ">')).toBe(vocab.variantLabel('<ENTITIES|name>'));
  });

  it('refuses affixes on a chip that does not take them', () => {
    expect(vocab.setAffixes('<WORLD DESCRIPTION>', ' x ', '')).toBe('<WORLD DESCRIPTION>');
  });
});
