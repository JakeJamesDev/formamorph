import { describe, it, expect } from 'vitest';
import { CATALOG_KINDS, CARD_TYPE_BY_KIND, KIND_BY_CARD_TYPE, KIND_LABELS, kindOf } from './catalogKinds';

describe('kindOf', () => {
  it('reads a kind the server sent', () => {
    expect(kindOf({ kind: 'entity' })).toBe('entity');
    expect(kindOf({ kind: 'dictionary' })).toBe('dictionary');
    expect(kindOf({ kind: 'world' })).toBe('world');
  });

  it('treats a record with no kind as a world', () => {
    // Catalog entries cached before kinds existed carry no `kind`; they must still render as worlds
    // rather than vanish from every tab until the background refresh lands.
    expect(kindOf({})).toBe('world');
  });

  it('treats an unknown kind as a world rather than dropping it', () => {
    // A newer server could publish a kind this build has never heard of; showing it as a world is wrong
    // but visible, which beats a listing that silently belongs to no tab.
    expect(kindOf({ kind: 'spaceship' })).toBe('world');
    expect(kindOf({ kind: 'all' })).toBe('world'); // 'all' is a query, never a row's kind
  });
});

describe('kind mappings', () => {
  it('round-trips every kind through the local library tab value', () => {
    for (const kind of CATALOG_KINDS) {
      expect(KIND_BY_CARD_TYPE[CARD_TYPE_BY_KIND[kind]]).toBe(kind);
    }
  });

  it('labels every kind', () => {
    for (const kind of CATALOG_KINDS) {
      expect(KIND_LABELS[kind].one).toBeTruthy();
      expect(KIND_LABELS[kind].many).toBeTruthy();
    }
  });

  it('matches the server’s kinds', () => {
    // Mirrors FormamorphServer's config/kinds KINDS — they must not drift.
    expect([...CATALOG_KINDS]).toEqual(['world', 'entity', 'dictionary']);
  });
});
