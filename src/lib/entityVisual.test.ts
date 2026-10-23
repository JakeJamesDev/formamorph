import { describe, it, expect } from 'vitest';
import { hasEntityVisual } from './entityVisual';
import type { Entity } from '@/types';

const MODEL = { name: 'statue.glb', type: 'model/gltf-binary', data: 'data:model/gltf-binary;base64,AAAA' };
const IMAGE = 'data:image/webp;base64,AAAA';

const entity = (extra: Partial<Entity>): Entity =>
  ({ id: 'e1', name: 'Sedge', ...extra }) as Entity;

describe('hasEntityVisual', () => {
  it('accepts an image or a model and rejects an entity with neither', () => {
    expect(hasEntityVisual(entity({ images: [{ data: IMAGE }] }))).toBe(true);
    expect(hasEntityVisual(entity({ model: MODEL }))).toBe(true);
    expect(hasEntityVisual(entity({}))).toBe(false);
    expect(hasEntityVisual(undefined)).toBe(false);
  });

  it('rejects a model asset carrying no data, which nothing could load', () => {
    expect(hasEntityVisual(entity({ model: { name: 'statue.glb' } as Entity['model'] }))).toBe(false);
  });
});
