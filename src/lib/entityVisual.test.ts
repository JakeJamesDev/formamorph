import { describe, it, expect } from 'vitest';
import { hasEntityVisual } from './entityVisual';
import type { Entity } from '@/types';

const MODEL = { name: 'statue.glb', type: 'model/gltf-binary', data: 'data:model/gltf-binary;base64,AAAA' };
const IMAGE = 'data:image/webp;base64,AAAA';

const entity = (extra: Partial<Entity>): Entity =>
  ({ id: 'e1', name: 'Sedge', ...extra }) as Entity;

describe('hasEntityVisual', () => {
  it('accepts an image or a model and rejects an entity with neither', () => {
    expect(hasEntityVisual(entity({ images: [{ data: IMAGE }] }), undefined)).toBe(true);
    expect(hasEntityVisual(entity({ model: MODEL }), undefined)).toBe(true);
    expect(hasEntityVisual(entity({}), undefined)).toBe(false);
    expect(hasEntityVisual(undefined, undefined)).toBe(false);
  });

  it('reads a linked image through the Media List, and a link the list lacks as no image', () => {
    const media = { m: { id: 'm', name: 'Sedge 1', kind: 'image' as const, data: IMAGE } };
    expect(hasEntityVisual(entity({ images: [{ mediaId: 'm' }] }), media)).toBe(true);
    expect(hasEntityVisual(entity({ images: [{ mediaId: 'gone' }] }), media)).toBe(false);
  });

  it('accepts a Layered Image link only while its bottom Layer has an image to size it', () => {
    const rig = (mediaId: string) => ({ id: 'rig', name: 'Rig', kind: 'layered' as const, layers: [{ id: 'l', name: 'Base', variants: [{ mediaId }] }] });
    const image = { id: 'm', name: 'Sedge 1', kind: 'image' as const, data: IMAGE };
    expect(hasEntityVisual(entity({ images: [{ mediaId: 'rig' }] }), { m: image, rig: rig('m') })).toBe(true);
    expect(hasEntityVisual(entity({ images: [{ mediaId: 'rig' }] }), { m: image, rig: rig('gone') })).toBe(false);
  });

  it('rejects a model asset carrying no data, which nothing could load', () => {
    expect(hasEntityVisual(entity({ model: { name: 'statue.glb' } as Entity['model'] }), undefined)).toBe(false);
  });
});
