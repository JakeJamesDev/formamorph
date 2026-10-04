// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { DEFAULT_MASCOT_RIG, composeMascot, type MascotImageRef, type MascotRig } from '@/lib/formaquestion/mascot';
import { mascotImageUrl } from '@/lib/formaquestion/mascotAssets';
import { DEFAULT_MASCOT_TRANSITION, type MascotTransition } from '@/lib/formaquestion/mascotTransition';
import { addMascotImage, clearMascotImages } from '@/lib/formaquestion/mascotImageStore';
import { mascotImageRefs } from '@/lib/formaquestion/mascotRigEdits';
import { MascotPiece } from './MascotPiece';
import { stubReducedMotion } from '@/test/reducedMotion';

const drawn = () => [...document.querySelectorAll<HTMLImageElement>('[data-fq-piece="mascot"] img')].map((img) => img.getAttribute('src'));

let created: string[];
let revoked: string[];

beforeEach(async () => {
  await clearMascotImages();
  created = [];
  revoked = [];
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
    const url = `blob:mascot/${created.length + 1}`;
    created.push(url);
    return url;
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => { revoked.push(url); });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** The default rig with a stored overlay on the Thinking state and a stored base. */
async function storedRig(): Promise<MascotRig> {
  const base = await addMascotImage(new Blob(['base'], { type: 'image/png' }));
  const hand = await addMascotImage(new Blob(['hand'], { type: 'image/png' }));
  return {
    ...DEFAULT_MASCOT_RIG,
    base: { kind: 'stored', id: base },
    layers: DEFAULT_MASCOT_RIG.layers.map((row) => (row.id === 'thinking' ? { ...row, images: [{ kind: 'stored', id: hand }] } : row)),
  };
}

const piece = (rig: MascotRig, phase: 'initial' | 'thinking') => (
  <MascotPiece images={composeMascot(rig, phase, null)} hold={mascotImageRefs(rig)} size={null} onBase={() => undefined} />
);

describe('MascotPiece', () => {
  it('draws stored images from object URLs', async () => {
    const rig = await storedRig();
    render(piece(rig, 'thinking'));
    await waitFor(() => expect(drawn().filter((src) => src?.startsWith('blob:'))).toHaveLength(2));
    expect(drawn()[0]).toMatch(/^blob:/);
  });

  it('keeps a held image resolved across a change of look, so it draws at once', async () => {
    const rig = await storedRig();
    const { rerender } = render(piece(rig, 'initial'));
    await waitFor(() => expect(created).toHaveLength(2));
    rerender(piece(rig, 'thinking'));
    // The base and the hand, with no read in between.
    expect(drawn().filter((src) => src?.startsWith('blob:'))).toHaveLength(2);
    rerender(piece(rig, 'initial'));
    expect(created).toHaveLength(2);
    expect(revoked).toEqual([]);
  });

  it('revokes each object URL at unmount', async () => {
    const { unmount } = render(piece(await storedRig(), 'thinking'));
    await waitFor(() => expect(created).toHaveLength(2));
    unmount();
    expect(revoked.sort()).toEqual(created.sort());
  });
});

describe('MascotPiece transition', () => {
  const JELLY = DEFAULT_MASCOT_TRANSITION;
  const DISSOLVE: MascotTransition = { ...DEFAULT_MASCOT_TRANSITION, mode: 'dissolve' };
  const lookOf = (phase: 'initial' | 'thinking' | 'answering', face: string | null = null) => composeMascot(DEFAULT_MASCOT_RIG, phase, face);
  const urls = (images: readonly MascotImageRef[]) => images.map(mascotImageUrl);
  const moving = (images: readonly MascotImageRef[], transition?: MascotTransition) => (
    <MascotPiece images={images} hold={mascotImageRefs(DEFAULT_MASCOT_RIG)} transition={transition} size={{ w: 300, h: 400 }} onBase={() => undefined} />
  );
  const pieceEl = () => document.querySelector<HTMLElement>('[data-fq-piece="mascot"]')!;
  /** Each look on screen, bottom first: its images and its opacity. */
  const looks = () => [...pieceEl().querySelectorAll<HTMLElement>('[data-fq-look]')].map((look) => ({
    images: [...look.querySelectorAll('img')].map((img) => img.getAttribute('src')),
    opacity: Number(look.style.opacity),
  }));
  /** The painted height and width scale; no transform is one. */
  const scale = () => {
    const match = /scale\(([^,]+), ([^)]+)\)/.exec(pieceEl().style.transform);
    return match ? { x: Number(match[1]), y: Number(match[2]) } : { x: 1, y: 1 };
  };
  const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('scales from the bottom center and keeps the old look until the dip, then draws only the new one', () => {
    const { rerender } = render(moving(lookOf('initial'), JELLY));
    expect(pieceEl().className).toContain('origin-bottom');
    rerender(moving(lookOf('thinking'), JELLY));
    expect(looks()).toEqual([{ images: urls(lookOf('initial')), opacity: 1 }, { images: urls(lookOf('thinking')), opacity: 0 }]);

    advance(48);
    expect(scale().y).toBeLessThan(1);
    expect(scale().x).toBeGreaterThan(1);
    expect(looks().map((look) => look.opacity)).toEqual([1, 0]);

    // The dip lands at 100 ms at the defaults.
    advance(64);
    expect(looks()).toEqual([{ images: urls(lookOf('thinking')), opacity: 1 }]);
    expect(scale().y).toBeLessThan(1);
    advance(96);
    expect(scale().y).toBeGreaterThan(1);
    advance(300);
    expect(pieceEl().style.transform).toBe('');
    expect(looks()).toEqual([{ images: urls(lookOf('thinking')), opacity: 1 }]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('swaps at once with no transition, and under the reduced-motion preference', () => {
    const { rerender } = render(moving(lookOf('initial')));
    rerender(moving(lookOf('thinking')));
    expect(looks()).toEqual([{ images: urls(lookOf('thinking')), opacity: 1 }]);

    stubReducedMotion();
    cleanup();
    const reduced = render(moving(lookOf('initial'), JELLY));
    reduced.rerender(moving(lookOf('thinking'), JELLY));
    expect(looks()).toEqual([{ images: urls(lookOf('thinking')), opacity: 1 }]);
    expect(pieceEl().style.transform).toBe('');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cross-fades the old look out as the new one fades in, at full size, and keeps every look showing when it changes again', () => {
    const { rerender } = render(moving(lookOf('initial'), DISSOLVE));
    rerender(moving(lookOf('thinking'), DISSOLVE));
    advance(128);
    const [under, over] = looks();
    expect(over.opacity).toBeGreaterThan(0.3);
    expect(over.opacity).toBeLessThan(0.7);
    // The looks blend additively, so their shares make one whole.
    expect(under.opacity + over.opacity).toBeCloseTo(1, 6);
    expect(pieceEl().querySelector<HTMLElement>('[data-fq-look]')!.className).toContain('mix-blend-plus-lighter');
    expect(pieceEl().style.transform).toBe('');

    // A change mid-run keeps both looks as they are and fades the newest in as they fade out.
    rerender(moving(lookOf('answering', 'happy'), DISSOLVE));
    expect(looks()).toEqual([
      { images: urls(lookOf('initial')), opacity: under.opacity },
      { images: urls(lookOf('thinking')), opacity: over.opacity },
      { images: urls(lookOf('answering', 'happy')), opacity: 0 },
    ]);
    advance(128);
    const shares = looks().map((look) => look.opacity);
    expect(shares[0] / shares[1]).toBeCloseTo(under.opacity / over.opacity, 6);
    expect(shares.reduce((sum, share) => sum + share, 0)).toBeCloseTo(1, 6);
    advance(144);
    expect(looks()).toEqual([{ images: urls(lookOf('answering', 'happy')), opacity: 1 }]);
    // A resting look paints plain.
    expect(pieceEl().querySelector<HTMLElement>('[data-fq-look]')!.className).not.toContain('mix-blend-plus-lighter');
  });

  it('starts a change mid-Jelly from the height on screen, with no jump', () => {
    const { rerender } = render(moving(lookOf('initial'), JELLY));
    rerender(moving(lookOf('thinking'), JELLY));
    advance(192);
    const before = scale().y;
    expect(before).toBeGreaterThan(1.1);
    rerender(moving(lookOf('answering'), JELLY));
    // The new look waits for the new dip, over the one on screen.
    expect(looks().map((look) => look.images)).toEqual([urls(lookOf('thinking')), urls(lookOf('answering'))]);
    advance(16);
    expect(Math.abs(scale().y - before)).toBeLessThan(0.02);
  });

  it('plays from the replay look to its images on each new id, and only then', () => {
    const replay = (id: number) => ({ id, from: lookOf('thinking'), transition: JELLY });
    const shown = (id: number) => (
      <MascotPiece images={lookOf('answering')} replay={replay(id)} size={{ w: 300, h: 400 }} onBase={() => undefined} />
    );
    const { rerender } = render(shown(0));
    expect(looks()).toEqual([{ images: urls(lookOf('answering')), opacity: 1 }]);
    rerender(shown(1));
    expect(looks()).toEqual([{ images: urls(lookOf('thinking')), opacity: 1 }, { images: urls(lookOf('answering')), opacity: 0 }]);
    advance(500);
    expect(looks()).toEqual([{ images: urls(lookOf('answering')), opacity: 1 }]);
    rerender(shown(1));
    expect(looks()).toHaveLength(1);
  });

  it('leaves no frame running at unmount mid-run', () => {
    const { rerender, unmount } = render(moving(lookOf('initial'), JELLY));
    rerender(moving(lookOf('thinking'), JELLY));
    advance(48);
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
