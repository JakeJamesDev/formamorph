import { describe, it, expect } from 'vitest';
import { canonicalStringify } from './canonicalStringify';

const s = (v: unknown) => canonicalStringify(v, new WeakMap());

describe('canonicalStringify — same world, same string', () => {
  it('ignores the order a record’s keys were written in', () => {
    // The editor's managers rebuild records with their own literal key order, which raw JSON treats as a
    // different world and the Save button then offers to save.
    expect(s({ id: '1', name: 'Tiamat', type: 'dragon' })).toBe(s({ type: 'dragon', id: '1', name: 'Tiamat' }));
  });

  it('treats a field that was filled in and cleared as one that was never there', () => {
    // Adding an alias puts an `aliases` key on an entity that had none; removing it leaves `[]` behind.
    expect(s({ id: '1', aliases: [] })).toBe(s({ id: '1' }));
    expect(s({ id: '1', note: '' })).toBe(s({ id: '1' }));
    expect(s({ id: '1', thumbnail: null })).toBe(s({ id: '1' }));
    expect(s({ id: '1', thumbnail: undefined })).toBe(s({ id: '1' }));
  });

  it('sorts keys at every depth, not just the top', () => {
    expect(s({ a: { y: 1, x: 2 } })).toBe(s({ a: { x: 2, y: 1 } }));
  });
});

describe('canonicalStringify — a real change still reads as one', () => {
  it('separates values an author actually chose', () => {
    expect(s({ id: '1', aliases: ['Roz'] })).not.toBe(s({ id: '1' }));
    expect(s({ name: 'Tiamat' })).not.toBe(s({ name: 'Rustjaw' }));
  });

  it('keeps 0 and false, which are values rather than emptiness', () => {
    // A stat floored at 0 or a toggle turned off must not read as a field nobody set.
    expect(s({ min: 0 })).not.toBe(s({}));
    expect(s({ enabled: false })).not.toBe(s({}));
  });

  it('keeps array order, because a list of entities is not a set', () => {
    expect(s(['a', 'b'])).not.toBe(s(['b', 'a']));
  });

  it('separates an emptied list from one that still holds a blank', () => {
    expect(s({ tags: [''] })).not.toBe(s({ tags: [] }));
  });
});

describe('canonicalStringify — caching', () => {
  it('reuses a record’s serialization by identity, leaving unedited base64 alone', () => {
    const cache = new WeakMap<object, string>();
    const shared = { id: '1', image: 'data:image/webp;base64,AAAA' };
    const first = canonicalStringify({ entities: [shared] }, cache);
    // Same reference reached by a different route still hits the cache.
    expect(cache.get(shared)).toBeDefined();
    expect(canonicalStringify({ entities: [shared] }, cache)).toBe(first);
  });
});
