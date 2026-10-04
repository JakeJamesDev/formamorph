// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { DEFAULT_MASCOT_RIG, composeMascot, type MascotRig } from '@/lib/formaquestion/mascot';
import { addMascotImage, clearMascotImages } from '@/lib/formaquestion/mascotImageStore';
import { mascotImageRefs } from '@/lib/formaquestion/mascotRigEdits';
import { MascotPiece } from './MascotPiece';

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
  <MascotPiece images={composeMascot(rig, phase, null)} hold={mascotImageRefs(rig)} size={null} onAspect={() => undefined} />
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
