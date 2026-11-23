import { describe, it, expect } from 'vitest';
import type { GalleryImage, GalleryLink, LayeredMediaEntry, MediaList, WorldOverview } from '@/types';
import { checkMaskAspects, maskAspectSources } from './maskAspects';
import type { RuleWorld } from './rules';

const SIZES: Record<string, { width: number; height: number }> = {
  'data:photo': { width: 1600, height: 900 },
  'data:canvas': { width: 800, height: 800 },
  'data:wide': { width: 1600, height: 900 },
  'data:wideish': { width: 1620, height: 900 },
  'data:square': { width: 512, height: 512 },
};
const sizeOf = (data: string) => SIZES[data];

const mask = (id: string, data: string) => ({ id, name: `Mask ${id}`, kind: 'mask' as const, data });
const rig: LayeredMediaEntry = {
  id: 'rig', name: 'Rig', kind: 'layered', layers: [{ id: 'base', name: 'Base', variants: [{ mediaId: 'canvasImage' }] }],
};
const media: MediaList = {
  canvasImage: { id: 'canvasImage', name: 'Canvas', kind: 'image', data: 'data:canvas' },
  photoImage: { id: 'photoImage', name: 'Photo', kind: 'image', data: 'data:photo' },
  wide: mask('wide', 'data:wide'), wideish: mask('wideish', 'data:wideish'), square: mask('square', 'data:square'), rig,
};
const worldOf = (images: (GalleryLink | GalleryImage)[], list: MediaList = media): RuleWorld => ({
  worldOverview: { name: 'Sedge Landing', description: '', systemPrompt: 'Narrate.', readme: 'Primer.', mediaList: list } as WorldOverview,
  stats: [], locations: [{ id: 'harbor', name: 'Harbor Steps', isStarting: true, images }],
  entities: [], traits: [], statUpdates: [], dictionaries: [], placeholders: [],
});

describe('mask aspect finding', () => {
  it('flags a mask of another shape, naming the location, slot and mask', () => {
    const found = checkMaskAspects(worldOf([{ data: 'data:photo', weatherMask: 'square' }]), sizeOf);
    expect(found).toHaveLength(1);
    expect(found[0].ruleId).toBe('mask-aspect-mismatch');
    expect(found[0].message).toContain('Harbor Steps');
    expect(found[0].message).toContain('image 1');
    expect(found[0].message).toContain('Mask square');
    expect(found[0].items).toEqual([{ id: 'harbor', name: 'Harbor Steps', section: 'locations' }]);
  });

  it('flags a linked picture the same way', () => {
    expect(checkMaskAspects(worldOf([{ mediaId: 'photoImage', weatherMask: 'square' }]), sizeOf)).toHaveLength(1);
  });

  it('is quiet for a matching mask, a small difference and a world with no masks', () => {
    expect(checkMaskAspects(worldOf([{ data: 'data:photo', weatherMask: 'wide' }]), sizeOf)).toEqual([]);
    expect(checkMaskAspects(worldOf([{ data: 'data:photo', weatherMask: 'wideish' }]), sizeOf)).toEqual([]);
    expect(checkMaskAspects(worldOf([{ data: 'data:photo' }]), sizeOf)).toEqual([]);
  });

  it('compares a Layered Image slot with its canvas', () => {
    expect(checkMaskAspects(worldOf([{ mediaId: 'rig', weatherMask: 'wide' }]), sizeOf)).toHaveLength(1);
    expect(checkMaskAspects(worldOf([{ mediaId: 'rig', weatherMask: 'square' }]), sizeOf)).toEqual([]);
  });

  it('compares an embedded Layered Image slot with its canvas, and names the slot', () => {
    const layered = { name: 'Rig', layers: [{ id: 'base', name: 'Base', variants: [{ data: 'data:canvas' }] }] };
    const found = checkMaskAspects(worldOf([{ data: 'data:photo' }, { layered, weatherMask: 'wide' }]), sizeOf);
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain('image 2');
  });

  it('reads a link to a missing mask as no mask, and waits for unknown sizes', () => {
    expect(checkMaskAspects(worldOf([{ data: 'data:photo', weatherMask: 'gone' }]), sizeOf)).toEqual([]);
    expect(checkMaskAspects(worldOf([{ data: 'data:photo', weatherMask: 'square' }]), () => undefined)).toEqual([]);
  });

  it('lists the data to decode: each checked mask and picture', () => {
    expect(maskAspectSources(worldOf([{ data: 'data:photo', weatherMask: 'square' }, { data: 'data:photo' }])))
      .toEqual(['data:square', 'data:photo']);
  });
});
