import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { PictureImg } from './PictureImg';
import { DEFAULT_MASCOT_TRANSITION, type MascotTransition } from '@/lib/formaquestion/mascotTransition';
import { DEFAULT_LAYER_TRANSITION, type LayeredPicture, type ResolvedLayer } from '@/lib/layeredImages';

const stack = (layers: LayeredPicture['layers'], entryId = 'rig'): LayeredPicture => ({ kind: 'layered', entryId, canvas: 'data:base', layers });
const box = (root: ParentNode, id: string) => root.querySelector<HTMLElement>(`[data-layer="${id}"]`)!;
const layer = (id: string, blend: ResolvedLayer['blend'], data: string): ResolvedLayer => ({ id, opacity: 1, blend, transition: DEFAULT_LAYER_TRANSITION, data });

describe('PictureImg with a Layered Image', () => {
  it('draws each blend mode on its Layer, Add as plus-lighter and Normal as none', () => {
    const { container } = render(<PictureImg alt="" src={stack([
      layer('n', 'normal', 'data:n'), layer('m', 'multiply', 'data:m'), layer('s', 'screen', 'data:s'), layer('a', 'add', 'data:a'),
    ])} />);
    expect(['n', 'm', 's', 'a'].map((id) => box(container, id).style.mixBlendMode)).toEqual(['', 'multiply', 'screen', 'plus-lighter']);
  });

  it('tints a Layer with a color-matrix filter that scales each channel and leaves alpha alone', () => {
    const { container } = render(<PictureImg alt="" src={stack([{ ...layer('t', 'normal', 'data:t'), opacity: 0.6, tint: '#cc3300' }])} />);
    const shown = box(container, 't');
    const filterId = /url\(#(.+)\)/.exec(shown.querySelector<HTMLElement>('img')!.style.filter)?.[1];
    const filter = shown.querySelector(`filter[id="${filterId}"]`)!;
    expect(shown.style.opacity).toBe('0.6');
    expect(filter.getAttribute('color-interpolation-filters')).toBe('sRGB');
    expect(filter.querySelector('feColorMatrix')!.getAttribute('values')!.trim().split(/\s+/).map(Number))
      .toEqual([0.8, 0, 0, 0, 0, 0, 0.2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0]);
  });

  it('draws an untinted Layer with no filter', () => {
    const { container } = render(<PictureImg alt="" src={stack([layer('p', 'normal', 'data:p')])} />);
    expect(box(container, 'p').querySelector('filter')).toBeNull();
    expect(box(container, 'p').querySelector<HTMLElement>('img')!.style.filter).toBe('');
  });

  it('loads a cropped picture\'s hidden canvas eagerly, so a lazy caller still learns its size', () => {
    const { container } = render(<PictureImg alt="" crop loading="lazy" src={stack([layer('p', 'normal', 'data:p')])} />);
    const canvas = [...container.querySelectorAll('img')].find((img) => img.getAttribute('src') === 'data:base')!;
    expect(canvas.className).toBe('hidden');
    expect(canvas.getAttribute('loading')).toBe('eager');
    expect(box(container, 'p').querySelector('img')!.getAttribute('loading')).toBe('lazy');
  });

  it('isolates the picture so a blend never reaches what sits behind it', () => {
    const { container } = render(<PictureImg alt="" src={stack([layer('p', 'add', 'data:p')])} />);
    expect(container.querySelector('[data-layered-picture]')!.className).toContain('isolate');
  });
});

describe('PictureImg Variant changes', () => {
  afterEach(() => { vi.useRealTimers(); });

  const looks = (root: ParentNode, id: string) =>
    [...box(root, id).querySelectorAll<HTMLElement>('[data-layer-look]')].map((look) => ({ src: look.querySelector('img')!.getAttribute('src'), opacity: look.style.opacity }));
  const squash = (root: ParentNode) => root.querySelector<HTMLElement>('[data-layer-stack]')!.style.transform;
  const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
  const withMode = (mode: MascotTransition['mode']): MascotTransition => ({ ...DEFAULT_MASCOT_TRANSITION, mode });
  const face = (data: string, transition = DEFAULT_LAYER_TRANSITION): ResolvedLayer => ({ ...layer('face', 'normal', data), transition });
  const body = layer('body', 'normal', 'data:body');

  it('cross-fades only the changed Dissolve Layer, then rests on the new Variant', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    const { container, rerender } = render(<PictureImg alt="" src={stack([body, face('data:smile')])} />);
    rerender(<PictureImg alt="" src={stack([body, face('data:frown')])} />);
    advance(125);
    const mid = looks(container, 'face');
    expect(mid.map((look) => look.src)).toEqual(['data:smile', 'data:frown']);
    expect(Number(mid[1].opacity)).toBeGreaterThan(0.2);
    expect(Number(mid[1].opacity)).toBeLessThan(0.8);
    expect(looks(container, 'body')).toEqual([{ src: 'data:body', opacity: '1' }]);
    expect(squash(container)).toBe('');
    advance(200);
    expect(looks(container, 'face')).toEqual([{ src: 'data:frown', opacity: '1' }]);
  });

  it('squashes the whole picture for a Jelly Layer and swaps it at the dip', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    const jelly = withMode('jelly');
    const { container, rerender } = render(<PictureImg alt="" src={stack([body, face('data:smile', jelly)])} />);
    rerender(<PictureImg alt="" src={stack([body, face('data:frown', jelly)])} />);
    advance(32);
    expect(squash(container)).toMatch(/^scale\(/);
    expect(looks(container, 'face').at(-1)).toEqual({ src: 'data:frown', opacity: '0' });
    advance(500);
    expect(squash(container)).toBe('');
    expect(looks(container, 'face')).toEqual([{ src: 'data:frown', opacity: '1' }]);
  });

  it('fades a Dissolve Layer during the one squash that a Jelly Layer in the same change plays', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    const jelly = withMode('jelly');
    const hat = (data: string): ResolvedLayer => ({ ...layer('hat', 'normal', data), transition: jelly });
    const { container, rerender } = render(<PictureImg alt="" src={stack([body, face('data:smile'), hat('data:cap')])} />);
    rerender(<PictureImg alt="" src={stack([body, face('data:frown'), hat('data:crown')])} />);
    advance(125);
    expect(squash(container)).toMatch(/^scale\(/);
    const fade = looks(container, 'face');
    expect(fade.map((look) => look.src)).toEqual(['data:smile', 'data:frown']);
    expect(Number(fade[1].opacity)).toBeGreaterThan(0.2);
    expect(Number(fade[1].opacity)).toBeLessThan(0.8);
    // Past the dip, so the Jelly Layer has swapped with no fade.
    expect(looks(container, 'hat')).toEqual([{ src: 'data:crown', opacity: '1' }]);
    advance(500);
    expect(squash(container)).toBe('');
    expect(looks(container, 'face')).toEqual([{ src: 'data:frown', opacity: '1' }]);
  });

  it('swaps at once for None, a first picture and another Layered Image', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    const { container, rerender } = render(<PictureImg alt="" src={stack([face('data:smile', withMode('none'))])} />);
    expect(looks(container, 'face')).toEqual([{ src: 'data:smile', opacity: '1' }]);
    rerender(<PictureImg alt="" src={stack([face('data:frown', withMode('none'))])} />);
    expect(looks(container, 'face')).toEqual([{ src: 'data:frown', opacity: '1' }]);
    rerender(<PictureImg alt="" src={stack([face('data:wink')], 'other')} />);
    expect(looks(container, 'face')).toEqual([{ src: 'data:wink', opacity: '1' }]);
  });
});
