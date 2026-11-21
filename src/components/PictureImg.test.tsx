import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { PictureImg } from './PictureImg';
import type { LayeredPicture } from '@/lib/layeredImages';

const stack = (layers: LayeredPicture['layers']): LayeredPicture => ({ kind: 'layered', entryId: 'rig', canvas: 'data:base', layers });
const box = (root: ParentNode, id: string) => root.querySelector<HTMLElement>(`[data-layer="${id}"]`)!;

describe('PictureImg with a Layered Image', () => {
  it('draws each blend mode on its Layer, Add as plus-lighter and Normal as none', () => {
    const { container } = render(<PictureImg alt="" src={stack([
      { id: 'n', opacity: 1, blend: 'normal', data: 'data:n' },
      { id: 'm', opacity: 1, blend: 'multiply', data: 'data:m' },
      { id: 's', opacity: 1, blend: 'screen', data: 'data:s' },
      { id: 'a', opacity: 1, blend: 'add', data: 'data:a' },
    ])} />);
    expect(['n', 'm', 's', 'a'].map((id) => box(container, id).style.mixBlendMode)).toEqual(['', 'multiply', 'screen', 'plus-lighter']);
  });

  it('tints a Layer with a color-matrix filter that scales each channel and leaves alpha alone', () => {
    const { container } = render(<PictureImg alt="" src={stack([{ id: 't', opacity: 0.6, blend: 'normal', tint: '#cc3300', data: 'data:t' }])} />);
    const layer = box(container, 't');
    const filterId = /url\(#(.+)\)/.exec(layer.querySelector<HTMLElement>('img')!.style.filter)?.[1];
    const filter = layer.querySelector(`filter[id="${filterId}"]`)!;
    expect(layer.style.opacity).toBe('0.6');
    expect(filter.getAttribute('color-interpolation-filters')).toBe('sRGB');
    expect(filter.querySelector('feColorMatrix')!.getAttribute('values')!.trim().split(/\s+/).map(Number))
      .toEqual([0.8, 0, 0, 0, 0, 0, 0.2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0]);
  });

  it('draws an untinted Layer with no filter', () => {
    const { container } = render(<PictureImg alt="" src={stack([{ id: 'p', opacity: 1, blend: 'normal', data: 'data:p' }])} />);
    expect(box(container, 'p').querySelector('filter')).toBeNull();
    expect(box(container, 'p').querySelector<HTMLElement>('img')!.style.filter).toBe('');
  });

  it('isolates the picture so a blend never reaches what sits behind it', () => {
    const { container } = render(<PictureImg alt="" src={stack([{ id: 'p', opacity: 1, blend: 'add', data: 'data:p' }])} />);
    expect(container.querySelector('[data-layered-picture]')!.className).toContain('isolate');
  });
});
