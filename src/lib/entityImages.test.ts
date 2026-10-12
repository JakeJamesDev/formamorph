import { describe, it, expect } from 'vitest';
import type { TraitRequirementRow } from '@/types';
import { entityImageData, entityImages, primaryImage, migrateEntityImages } from './entityImages';

const KNIGHT: TraitRequirementRow[] = [{ all: [{ kind: 'trait', id: 'knight' }] }];

describe('entityImages', () => {
  it('reads the gallery', () => {
    expect(entityImages({ images: [{ data: 'a' }, { data: 'b', requires: KNIGHT }] }))
      .toEqual([{ data: 'a' }, { data: 'b', requires: KNIGHT }]);
  });

  it('reads a gallery of data strings as images with no rule', () => {
    expect(entityImages({ images: ['a', 'b'] })).toEqual([{ data: 'a' }, { data: 'b' }]);
  });

  it('reads a pre-gallery single portrait as a one-picture gallery', () => {
    expect(entityImages({ image: 'a' })).toEqual([{ data: 'a' }]);
  });

  it('prefers the gallery when a record somehow carries both', () => {
    expect(entityImages({ images: [{ data: 'new' }], image: 'old' })).toEqual([{ data: 'new' }]);
  });

  it('drops blanks so callers never render an empty src', () => {
    expect(entityImages({ images: ['a', '', { data: '' }, { data: 'b' }] })).toEqual([{ data: 'a' }, { data: 'b' }]);
    expect(entityImages({ image: '' })).toEqual([]);
    expect(entityImages(undefined)).toEqual([]);
    expect(entityImages(null)).toEqual([]);
  });

  it('stores an empty rule as no rule', () => {
    expect(entityImages({ images: [{ data: 'a', requires: [] }] })).toEqual([{ data: 'a' }]);
  });
});

describe('entityImageData', () => {
  it('is the pictures alone, in author order', () => {
    expect(entityImageData({ images: [{ data: 'a', requires: KNIGHT }, 'b'] })).toEqual(['a', 'b']);
  });
});

describe('primaryImage', () => {
  it('is the first slot, so reordering the gallery changes it', () => {
    expect(primaryImage({ images: [{ data: 'a' }, { data: 'b' }] })).toBe('a');
    expect(primaryImage({ images: [{ data: 'b' }, { data: 'a' }] })).toBe('b');
  });

  it('is slot 0 even when slot 0 carries a rule', () => {
    expect(primaryImage({ images: [{ data: 'a', requires: KNIGHT }, { data: 'b' }] })).toBe('a');
  });

  it('is undefined for an entity with no pictures', () => {
    expect(primaryImage({ images: [] })).toBeUndefined();
    expect(primaryImage(undefined)).toBeUndefined();
  });
});

describe('migrateEntityImages', () => {
  it('folds the legacy portrait into the gallery and drops the old key', () => {
    const out = migrateEntityImages({ id: 'e', image: 'a' });
    expect(out).toEqual({ id: 'e', images: [{ data: 'a' }] });
    expect('image' in out).toBe(false);
  });

  it('wraps every data string in place, in order', () => {
    expect(migrateEntityImages({ id: 'e', images: ['a', 'b'] })).toEqual({ id: 'e', images: [{ data: 'a' }, { data: 'b' }] });
  });

  it('is idempotent — a second pass returns the very same object', () => {
    const once = migrateEntityImages({ id: 'e', images: ['a', 'b'] });
    expect(migrateEntityImages(once)).toBe(once);
    const folded = migrateEntityImages({ id: 'e', image: 'a' });
    expect(migrateEntityImages(folded)).toBe(folded);
  });

  it('leaves an already-migrated entity untouched by reference, rules and all', () => {
    const entity = { id: 'e', images: [{ data: 'a', requires: KNIGHT }, { data: 'b' }] };
    expect(migrateEntityImages(entity)).toBe(entity);
  });

  it('stores no empty array for an entity that never had a picture', () => {
    const out = migrateEntityImages({ id: 'e', image: '' });
    expect('images' in out).toBe(false);
    expect('image' in out).toBe(false);
  });

  it('keeps every other field', () => {
    expect(migrateEntityImages({ id: 'e', name: 'Wren', image: 'a' })).toEqual({
      id: 'e',
      name: 'Wren',
      images: [{ data: 'a' }],
    });
  });
});
