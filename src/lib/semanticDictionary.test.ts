import { describe, it, expect } from 'vitest';
import {
  SEMANTIC_LORE_THRESHOLD,
  SEMANTIC_LORE_CAP,
  entryEmbedText,
  entryVectorKey,
  selectSemanticLore,
  applySemanticLore,
} from './semanticDictionary';
import { explainActivation } from './dictionaryUtils';
import type { DictionaryEntry } from '@/types';

const entry = (id: string, over: Partial<DictionaryEntry> = {}): DictionaryEntry => ({
  id,
  name: `Entry ${id}`,
  key: [`key-${id}`],
  value: `lore of ${id}`,
  ...over,
});

const vec = (...vals: number[]) => new Float32Array(vals);
const withVectors = (entries: DictionaryEntry[], vecs: Float32Array[]) =>
  new Map(entries.map((e, i) => [entryVectorKey(e), vecs[i]] as const));

describe('entryEmbedText', () => {
  it('joins name, keys, and content, capping giant content', () => {
    const e = entry('a', { name: 'Old Beacon', key: ['tower', 'beacon'], value: 'x'.repeat(2000) });
    const text = entryEmbedText(e);
    expect(text.startsWith('Old Beacon — tower, beacon — ')).toBe(true);
    expect(text.length).toBeLessThan(1100);
  });

  // The editor mirrored `name` from the keywords before the fields were decoupled; embedding both weighted
  // those keywords twice against the entry's own content.
  it('drops a name that merely repeats the keys', () => {
    const e = entry('a', { name: 'tower, beacon', key: ['tower', 'beacon'], value: 'A ruined light.' });
    expect(entryEmbedText(e)).toBe('tower, beacon — A ruined light.');
  });

  it('drops a single-keyword name that repeats its only key', () => {
    const e = entry('a', { name: 'Weck', key: ['Weck'], value: 'A ferryman.' });
    expect(entryEmbedText(e)).toBe('Weck — A ferryman.');
  });

  it('keeps a name that differs from the keys', () => {
    const e = entry('a', { name: 'Old Beacon', key: ['tower'], value: 'A ruined light.' });
    expect(entryEmbedText(e)).toBe('Old Beacon — tower — A ruined light.');
  });

  it('keys the vector by content, so a text edit changes the key and an id change does not', () => {
    const a = entry('a', { name: 'Beacon' });
    expect(entryVectorKey(a)).toBe(entryVectorKey({ ...a, id: 'regenerated' }));
    expect(entryVectorKey(a)).not.toBe(entryVectorKey({ ...a, value: 'edited' }));
  });
});

describe('selectSemanticLore', () => {
  const query = vec(1, 0);

  it('activates entries above the threshold, best-first, capped', () => {
    const entries = [entry('lo'), entry('mid'), entry('hi'), entry('top'), entry('x')];
    const sims = [vec(0.45, 0.89), vec(0.6, 0.8), vec(0.8, 0.6), vec(0.95, 0.31), vec(0, 1)];
    const out = selectSemanticLore(entries, query, withVectors(entries, sims), 0.5, 2);
    expect([...out.keys()]).toEqual(['top', 'hi']); // best two of the three above 0.5
    expect(out.get('top')).toBeCloseTo(0.95);
  });

  it('skips disabled and constant entries', () => {
    const entries = [entry('off', { enabled: false }), entry('always', { constant: true }), entry('ok')];
    const out = selectSemanticLore(entries, query, withVectors(entries, [vec(1, 0), vec(1, 0), vec(1, 0)]));
    expect([...out.keys()]).toEqual(['ok']);
  });

  it('skips entries with no cached vector instead of failing', () => {
    const entries = [entry('unembedded'), entry('ok')];
    const vectors = new Map([[entryVectorKey(entries[1]), vec(1, 0)]]);
    expect([...selectSemanticLore(entries, query, vectors).keys()]).toEqual(['ok']);
  });

  it('ships with a sane threshold and cap', () => {
    expect(SEMANTIC_LORE_THRESHOLD).toBeGreaterThan(0);
    expect(SEMANTIC_LORE_THRESHOLD).toBeLessThan(1);
    expect(SEMANTIC_LORE_CAP).toBeGreaterThan(0);
  });
});

describe('applySemanticLore', () => {
  it('activates non-keyword entries as semantic and never overrides a keyword reason', () => {
    const entries = [entry('kw', { key: ['lighthouse'] }), entry('sem', { key: ['unrelated'] })];
    const report = explainActivation(entries, [{ region: 'action', text: 'I walk to the lighthouse' }]);
    applySemanticLore(report, new Map([['kw', 0.9], ['sem', 0.6]]));
    const kw = report.byId.get('kw')!;
    const sem = report.byId.get('sem')!;
    expect(kw.reason).toBe('keyword'); // similarity for an already-active entry is ignored
    expect(kw.semanticSimilarity).toBeUndefined();
    expect(sem.activated).toBe(true);
    expect(sem.reason).toBe('semantic');
    expect(sem.semanticSimilarity).toBe(0.6);
  });

  it('leaves unselected entries untouched', () => {
    const entries = [entry('quiet', { key: ['unrelated'] })];
    const report = explainActivation(entries, [{ region: 'action', text: 'nothing relevant' }]);
    applySemanticLore(report, new Map());
    expect(report.byId.get('quiet')!.activated).toBe(false);
    expect(report.byId.get('quiet')!.reason).toBe('none');
  });
});
