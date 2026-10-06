import { describe, it, expect } from 'vitest';
import { measurePublishBytes } from '@/lib/publishLimits';
import { createJsonByteCounter } from './benchPass';

describe('createJsonByteCounter', () => {
  it('counts what JSON.stringify writes, in UTF-8', () => {
    const count = createJsonByteCounter();
    const values: unknown[] = [
      {},
      [],
      'plain',
      { version: '3.2.0', worldOverview: { name: 'Fen — “Sedge” 🐸', tags: [], gone: undefined } },
      { entities: [{ id: 'e1', name: 'Maren', aliases: ['the visitor'], skip: undefined }, { id: 'e2', name: 'Wick' }] },
      { list: [1, 'two', null, undefined, true, { deep: [{ deeper: '∂' }] }], fn: () => 1, n: 0, empty: '' },
      { 'key "quoted"': [{ id: 'x', 'ünï': 'value\nwith\tescapes' }] },
    ];
    for (const value of values) expect(count(value)).toBe(measurePublishBytes(value));
  });

  it('counts a record again only once an edit replaces it', () => {
    const count = createJsonByteCounter();
    let reads = 0;
    const kept = { id: 'e1', get name() { reads += 1; return 'Maren'; } };
    const world = { entities: [kept, { id: 'e2', name: 'Wick' }] };
    const expected = measurePublishBytes(world);
    reads = 0;
    expect(count(world)).toBe(expected);
    expect(reads).toBe(1);

    const edited = { entities: [kept, { id: 'e2', name: 'Wick the Elder, keeper of lamps' }] };
    const editedBytes = measurePublishBytes(edited);
    reads = 0;
    expect(count(edited)).toBe(editedBytes);
    expect(reads).toBe(0);
  });
});
