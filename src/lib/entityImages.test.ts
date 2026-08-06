import { describe, it, expect } from 'vitest';
import { entityImages, primaryImage, migrateEntityImages } from './entityImages';

describe('entityImages', () => {
  it('reads the gallery', () => {
    expect(entityImages({ images: ['a', 'b'] })).toEqual(['a', 'b']);
  });

  it('reads a pre-gallery single portrait as a one-picture gallery', () => {
    expect(entityImages({ image: 'a' })).toEqual(['a']);
  });

  it('prefers the gallery when a record somehow carries both', () => {
    expect(entityImages({ images: ['new'], image: 'old' })).toEqual(['new']);
  });

  it('drops blanks so callers never render an empty src', () => {
    expect(entityImages({ images: ['a', '', 'b'] })).toEqual(['a', 'b']);
    expect(entityImages({ image: '' })).toEqual([]);
    expect(entityImages(undefined)).toEqual([]);
    expect(entityImages(null)).toEqual([]);
  });
});

describe('primaryImage', () => {
  it('is the first slot, so reordering the gallery changes it', () => {
    expect(primaryImage({ images: ['a', 'b'] })).toBe('a');
    expect(primaryImage({ images: ['b', 'a'] })).toBe('b');
  });

  it('is undefined for an entity with no pictures', () => {
    expect(primaryImage({ images: [] })).toBeUndefined();
    expect(primaryImage(undefined)).toBeUndefined();
  });
});

describe('migrateEntityImages', () => {
  it('folds the legacy portrait into the gallery and drops the old key', () => {
    const out = migrateEntityImages({ id: 'e', image: 'a' });
    expect(out).toEqual({ id: 'e', images: ['a'] });
    expect('image' in out).toBe(false);
  });

  it('is idempotent — a second pass returns the very same object', () => {
    const once = migrateEntityImages({ id: 'e', image: 'a' });
    expect(migrateEntityImages(once)).toBe(once);
  });

  it('leaves an already-migrated entity untouched by reference', () => {
    const entity = { id: 'e', images: ['a', 'b'] };
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
      images: ['a'],
    });
  });
});
