import { describe, it, expect } from 'vitest';
import { locationImages, migrateLocationImages } from './locationImages';
import { migrateWorld } from './version';
import type { GalleryImage, TraitRequirementRow } from '@/types';

const HURT: TraitRequirementRow[] = [{ all: [{ kind: 'stat', id: 'health', operator: '<', value: 20, unit: 'percent' }] }];

describe('locationImages', () => {
  it('reads the gallery, wrapping data strings and dropping blanks', () => {
    expect(locationImages({ images: ['a', '', { data: 'b', requires: HURT }] })).toEqual([{ data: 'a' }, { data: 'b', requires: HURT }]);
  });

  it('reads a pre-gallery background as slot 0', () => {
    expect(locationImages({ backgroundImage: 'bg' })).toEqual([{ data: 'bg' }]);
    expect(locationImages({ backgroundImage: '' })).toEqual([]);
    expect(locationImages({ backgroundImage: null })).toEqual([]);
  });

  it('prefers a gallery over a stray background', () => {
    expect(locationImages({ images: [{ data: 'new' }], backgroundImage: 'old' })).toEqual([{ data: 'new' }]);
  });

  it('is empty for no location', () => {
    expect(locationImages(undefined)).toEqual([]);
  });
});

describe('migrateLocationImages', () => {
  it('moves the background into slot 0 and drops the old field', () => {
    expect(migrateLocationImages({ id: 'l', name: 'L', backgroundImage: 'bg' })).toEqual({ id: 'l', name: 'L', images: [{ data: 'bg' }] });
  });

  it('drops an empty background without making a gallery', () => {
    expect(migrateLocationImages({ id: 'l', backgroundImage: '' })).toEqual({ id: 'l' });
  });

  it('keeps an existing gallery and its rules over a stray background', () => {
    const images: GalleryImage[] = [{ data: 'a', requires: HURT }, { data: 'b' }];
    expect(migrateLocationImages({ id: 'l', images, backgroundImage: 'old' })).toEqual({ id: 'l', images });
  });

  it('returns the same reference for a location already in the gallery shape', () => {
    const current = { id: 'l', images: [{ data: 'a', requires: HURT }] };
    expect(migrateLocationImages(current)).toBe(current);
    const bare: { id: string; images?: GalleryImage[] } = { id: 'l' };
    expect(migrateLocationImages(bare)).toBe(bare);
  });
});

describe('migrateWorld on location backgrounds', () => {
  const oldWorld = () => ({
    version: '3.0.1',
    worldOverview: { name: 'W' },
    locations: [{ id: 'harbor', name: 'Harbor', backgroundImage: 'data:image/webp;base64,H' }, { id: 'bare', name: 'Bare' }],
    entities: [],
  });

  it('loads an old background into slot 0, and a second load changes nothing', () => {
    const once = migrateWorld(oldWorld());
    expect(once.locations[0]).toMatchObject({ id: 'harbor', images: [{ data: 'data:image/webp;base64,H' }] });
    expect('backgroundImage' in once.locations[0]).toBe(false);
    expect(once.locations[1].images).toBeUndefined();
    const twice = migrateWorld(structuredClone(once));
    expect(twice.locations).toEqual(once.locations);
  });

  it('keeps a gallery and its rules through an export file and back', () => {
    const images: GalleryImage[] = [{ data: 'data:image/webp;base64,A', requires: HURT }, { data: 'data:image/webp;base64,B' }];
    const world = migrateWorld({ ...oldWorld(), locations: [{ id: 'harbor', name: 'Harbor', images }] });
    const imported = migrateWorld(JSON.parse(JSON.stringify(world)));
    expect(imported.locations[0].images).toEqual(images);
  });

  it('migrates a world already stamped with the current version', () => {
    const current = migrateWorld(oldWorld());
    const stray = { ...current, locations: [{ id: 'harbor', name: 'Harbor', backgroundImage: 'X' }] };
    expect(migrateWorld(stray).locations[0].images).toEqual([{ data: 'X' }]);
  });
});
