import { describe, expect, it } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { chunksOf, mergeRanks, rankByVector, readPicks, scoreRecall, summarizeRecall, withKeywords } from './help-recall-score';

describe('scoreRecall', () => {
  const right = ['Library#how-to-make-a-group', 'Library#groups'];

  it('finds a keyed section first, in the first five, and in the sent block', () => {
    const block = ['Library#how-to-make-a-group', 'Settings#output'];
    expect(scoreRecall(right, block, block)).toEqual({ first: true, at5: true, sent: true });
  });

  it('counts any keyed section, and only the first one sent as first', () => {
    const block = ['Settings#output', 'Library#groups'];
    expect(scoreRecall(right, block, block)).toEqual({ first: false, at5: true, sent: true });
  });

  it('does not count a keyed section after the fifth place', () => {
    const block = ['A#1', 'A#2', 'A#3', 'A#4', 'A#5', 'Library#groups'];
    expect(scoreRecall(right, block, block).at5).toBe(false);
  });

  it('scores the sent block apart from the ranking, so a section the budget cut is found but not sent', () => {
    expect(scoreRecall(right, ['A#1', 'Library#groups'], ['A#1'])).toEqual({ first: false, at5: true, sent: false });
  });

  it('takes a part of a split section as that section', () => {
    expect(scoreRecall(['Glossary#building'], ['Glossary#building-part-2'], ['Glossary#building-part-2'])).toEqual({ first: true, at5: true, sent: true });
  });

  it('finds nothing in an empty block', () => {
    expect(scoreRecall(right, [], [])).toEqual({ first: false, at5: false, sent: false });
  });
});

describe('summarizeRecall', () => {
  it('gives each share of the questions', () => {
    const summary = summarizeRecall([
      { first: true, at5: true, sent: true },
      { first: false, at5: true, sent: false },
      { first: false, at5: false, sent: false },
      { first: false, at5: true, sent: true },
    ]);
    expect(summary).toEqual({ questions: 4, first: 0.25, at5: 0.75, sent: 0.5 });
  });

  it('gives zero shares for no questions', () => {
    expect(summarizeRecall([])).toEqual({ questions: 0, first: 0, at5: 0, sent: 0 });
  });
});

describe('mergeRanks', () => {
  it('orders the sections by their places in every list', () => {
    expect(mergeRanks([['a', 'b', 'c'], ['b', 'd', 'a']])).toEqual(['b', 'a', 'd', 'c']);
  });

  it('keeps a section that only one list holds', () => {
    expect(mergeRanks([['a'], ['b']]).sort()).toEqual(['a', 'b']);
  });

  it('keeps the order of a single list', () => {
    expect(mergeRanks([['c', 'a', 'b'], []])).toEqual(['c', 'a', 'b']);
  });
});

describe('rankByVector', () => {
  const v = (...values: number[]) => Float32Array.from(values);

  it('orders ids by the dot product with the query, best first', () => {
    const ranked = rankByVector(v(1, 0), [{ id: 'far', vector: v(0, 1) }, { id: 'near', vector: v(1, 0) }, { id: 'mid', vector: v(0.6, 0.8) }]);
    expect(ranked.map((r) => r.id)).toEqual(['near', 'mid', 'far']);
  });

  it('scores an id with several vectors by its best one, and lists it once', () => {
    const ranked = rankByVector(v(1, 0), [{ id: 'split', vector: v(0.8, 0.6) }, { id: 'one', vector: v(0.6, 0.8) }, { id: 'split', vector: v(0, 1) }]);
    expect(ranked.map((r) => r.id)).toEqual(['split', 'one']);
    expect(ranked[0].score).toBeCloseTo(0.8);
  });
});

describe('readPicks', () => {
  const lines = ['Library › How to Make a Group', 'Library › Groups', 'Settings › Output', 'World Editor: Traits › Groups', 'Memory › The Memory Tab', 'Memory › Kept vs Sent', 'Tools › Try It'];

  it('reads the copied lines of the reply as list positions, in the order of the reply', () => {
    expect(readPicks('Settings › Output\nLibrary › How to Make a Group', lines)).toEqual([2, 0]);
  });

  it('reads a line through a list marker, another case and other punctuation', () => {
    expect(readPicks('1. library > how to make a group\n- **Memory › The Memory Tab**', lines)).toEqual([0, 4]);
  });

  it('reads a line with no page when one section alone has that heading', () => {
    expect(readPicks('Kept vs Sent', lines)).toEqual([5]);
  });

  it('drops a heading that two pages have, a line the list does not hold, and a repeat', () => {
    expect(readPicks('Groups\nLibrary › Tiles\nSettings › Output\nSettings › Output', lines)).toEqual([2]);
  });

  it('keeps five picks at most', () => {
    expect(readPicks(lines.join('\n'), lines)).toEqual([0, 1, 2, 3, 4]);
  });

  it('reads no pick from a reply that copies no line', () => {
    expect(readPicks('None of the sections answer it.', lines)).toEqual([]);
  });
});

describe('chunksOf', () => {
  it('packs whole blocks into chunks under the limit', () => {
    expect(chunksOf('aaaa\n\nbbbb\n\ncccc\n\ndddd', 11)).toEqual(['aaaa\n\nbbbb', 'cccc\n\ndddd']);
  });

  it('keeps a block that is over the limit whole, in a chunk of its own', () => {
    expect(chunksOf('aa\n\nbbbbbbbbbbbbbbbb\n\ncc', 6)).toEqual(['aa', 'bbbbbbbbbbbbbbbb', 'cc']);
  });

  it('gives no chunk for no text', () => {
    expect(chunksOf('', 10)).toEqual([]);
  });
});

describe('withKeywords', () => {
  const pages = {
    Library: '# Library\n\nYour tiles.\n\n## How to Make a Group\n\n<!-- keywords: collection -->\n\n1. Select **New Group**.\n\n## Groups\n\nA group holds tiles.\n',
  };

  it('makes the search find a section by an added phrase, through the real index', () => {
    const before = createDocsIndex({ pages });
    expect(before.search('folder').map((s) => s.id)).toEqual([]);
    const { pages: grown, unknown } = withKeywords(pages, { 'Library#how-to-make-a-group': ['folder', 'bundle'] });
    expect(unknown).toEqual([]);
    const after = createDocsIndex({ pages: grown });
    expect(after.search('folder')[0]?.id).toBe('Library#how-to-make-a-group');
    // The authored line still counts, and the section text the model reads is unchanged.
    expect(after.search('collection')[0]?.id).toBe('Library#how-to-make-a-group');
    expect(after.get(['Library#how-to-make-a-group'])[0].markdown).toBe(before.get(['Library#how-to-make-a-group'])[0].markdown);
  });

  it('reports an id that names no heading and leaves the pages as they are', () => {
    const { pages: grown, unknown } = withKeywords(pages, { 'Library#no-such-heading': ['folder'], 'Nowhere#x': ['y'] });
    expect(unknown).toEqual(['Library#no-such-heading', 'Nowhere#x']);
    expect(grown).toEqual(pages);
  });

  it('adds nothing for an empty list', () => {
    expect(withKeywords(pages, { 'Library#groups': [] }).pages).toEqual(pages);
  });
});
