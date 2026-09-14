import { describe, it, expect, beforeEach } from 'vitest';
import { EMPTY_SOURCE_CHECK, readSourceCheck, writeSourceCheck } from './sourceCheckStore';

const KEY = 'FORMAMORPH_sourceCheckState';

const record = {
  checkedAt: '2026-09-13T10:00:00.000Z',
  results: { 'src-a': 'not_found' as const },
  required: ['src-a'],
};

describe('sourceCheckStore', () => {
  beforeEach(() => localStorage.clear());

  it('reads back what it wrote', () => {
    writeSourceCheck('w1', record);
    expect(readSourceCheck('w1')).toEqual(record);
  });

  it('keeps one world’s check apart from another’s', () => {
    writeSourceCheck('w1', record);
    writeSourceCheck('w2', { ...record, results: { 'src-b': 'ok' } });
    expect(readSourceCheck('w1').results).toEqual({ 'src-a': 'not_found' });
    expect(readSourceCheck('w2').results).toEqual({ 'src-b': 'ok' });
  });

  it('reads an unknown world as no answer', () => {
    expect(readSourceCheck('nobody')).toEqual(EMPTY_SOURCE_CHECK);
    expect(readSourceCheck(null)).toEqual(EMPTY_SOURCE_CHECK);
  });

  it('drops an answer nobody recognizes, so a hand edit cannot invent a missing source', () => {
    localStorage.setItem(KEY, JSON.stringify({
      w1: { checkedAt: 5, results: { 'src-a': 'gone', 'src-b': 'not_found' }, required: [7, 'src-b'] },
    }));
    expect(readSourceCheck('w1')).toEqual({
      checkedAt: '', results: { 'src-b': 'not_found' }, required: ['src-b'],
    });
  });

  it('reads a corrupt record as no answer', () => {
    localStorage.setItem(KEY, '{ not json');
    expect(readSourceCheck('w1')).toEqual(EMPTY_SOURCE_CHECK);
  });
});
