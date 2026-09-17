import { describe, it, expect } from 'vitest';
import { caretEdge, splitEdges } from './valueEdges';

describe('splitEdges', () => {
  it('splits leading and trailing runs off the value', () => {
    expect(splitEdges(' \tword word  ')).toEqual({ before: ' \t', value: 'word word', after: '  ' });
  });

  it('leaves a value with no edge whitespace whole', () => {
    expect(splitEdges('word word')).toEqual({ before: '', value: 'word word', after: '' });
  });

  it('keeps punctuation at either end in the value', () => {
    expect(splitEdges('"word." ')).toEqual({ before: '', value: '"word."', after: ' ' });
    expect(splitEdges(' ,word')).toEqual({ before: ' ', value: ',word', after: '' });
  });

  it('gives a whitespace-only value to one side, trailing by default', () => {
    expect(splitEdges('  ')).toEqual({ before: '', value: '', after: '  ' });
    expect(splitEdges('  ', 'start')).toEqual({ before: '  ', value: '', after: '' });
  });

  it('splits an empty value into nothing', () => {
    expect(splitEdges('')).toEqual({ before: '', value: '', after: '' });
  });

  it('leaves line breaks in the value', () => {
    expect(splitEdges('\nword\n ')).toEqual({ before: '', value: '\nword\n', after: ' ' });
  });
});

describe('caretEdge', () => {
  it('is at the end anywhere inside the trailing run', () => {
    for (const caret of [4, 5, 6]) expect(caretEdge('word  ', caret)).toEqual({ atStart: false, atEnd: true });
    expect(caretEdge('word  ', 3)).toEqual({ atStart: false, atEnd: false });
  });

  it('is at the start anywhere inside the leading run', () => {
    for (const caret of [0, 1, 2]) expect(caretEdge('  word', caret)).toEqual({ atStart: true, atEnd: false });
    expect(caretEdge('  word', 3)).toEqual({ atStart: false, atEnd: false });
  });

  it('is at an edge only on the value ends when there is no whitespace', () => {
    expect(caretEdge('word', 0)).toEqual({ atStart: true, atEnd: false });
    expect(caretEdge('word', 4)).toEqual({ atStart: false, atEnd: true });
    expect(caretEdge('word', 2)).toEqual({ atStart: false, atEnd: false });
  });

  it('treats punctuation at an end as value, not edge', () => {
    expect(caretEdge('word.', 4)).toEqual({ atStart: false, atEnd: false });
    expect(caretEdge('word. ', 5)).toEqual({ atStart: false, atEnd: true });
  });

  it('is at both edges in an empty value', () => {
    expect(caretEdge('', 0)).toEqual({ atStart: true, atEnd: true });
  });

  it('is at both edges anywhere in a whitespace-only value', () => {
    expect(caretEdge('  ', 0)).toEqual({ atStart: true, atEnd: true });
    expect(caretEdge('  ', 1)).toEqual({ atStart: true, atEnd: true });
    expect(caretEdge('  ', 2)).toEqual({ atStart: true, atEnd: true });
  });
});
