import { describe, expect, it } from 'vitest';
import { chunksOf, scoreRecall, summarizeRecall } from './help-recall-score';

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
