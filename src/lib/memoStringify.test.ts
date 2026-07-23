import { describe, it, expect } from 'vitest';
import { memoStringify } from './memoStringify';

const s = (v: unknown) => memoStringify(v, new WeakMap());

describe('memoStringify — byte-parity with JSON.stringify', () => {
  const cases: unknown[] = [
    null,
    true,
    false,
    0,
    -1.5,
    NaN,
    Infinity,
    -Infinity,
    'plain',
    'has "quotes" and \n newline \t tab and unicode ✓ 日',
    'data:image/webp;base64,UklGRhoAAABXRUJQ==',
    [],
    {},
    [1, 'two', null, true],
    { a: 1, b: 'x', c: null, d: false },
    { nested: { deep: [{ k: 'v' }, { k: 2 }] }, list: [[], [1, [2, [3]]]] },
    { keyOrder: 3, a: 1, z: 2 }, // insertion order preserved
    { und: undefined, fn: () => 1, ok: 1 }, // undefined/function keys omitted
    [undefined, () => 1, 3], // holes render as null
    { '': 'empty key', 'weird\nkey': 1 },
    { big: 'x'.repeat(5000) },
  ];

  it.each(cases.map((c, i) => [i, c] as const))('matches JSON.stringify for case %i', (_i, value) => {
    expect(s(value)).toBe(JSON.stringify(value));
  });

  it('reuses the cache for unchanged sub-objects and reflects edits', () => {
    const cache = new WeakMap<object, string>();
    const child = { image: 'data:base64,AAAA', name: 'A' };
    const root = { entities: [child, { name: 'B' }] };
    const first = memoStringify(root, cache);
    expect(first).toBe(JSON.stringify(root));
    expect(cache.get(child)).toBe(JSON.stringify(child)); // child cached

    // A new root that keeps `child` by reference but edits sibling B → still correct.
    const root2 = { entities: [child, { name: 'B2' }] };
    expect(memoStringify(root2, cache)).toBe(JSON.stringify(root2));
  });
});
