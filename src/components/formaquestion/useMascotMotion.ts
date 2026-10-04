import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MascotImageRef } from '@/lib/formaquestion/mascot';
import { mascotTransitionAt, type MascotTransition } from '@/lib/formaquestion/mascotTransition';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';

/** One look the piece draws. Looks stack bottom first; the top one is the newest. */
export interface ShownLook {
  readonly id: number;
  readonly images: readonly MascotImageRef[];
}

/** A run of the transition from what the piece shows to `images`, started by a new `id`. */
export interface MascotReplay {
  readonly id: number;
  readonly from: readonly MascotImageRef[];
  readonly transition: MascotTransition;
}

const lookKey = (images: readonly MascotImageRef[]): string =>
  images.map((ref) => (ref.kind === 'bundled' ? `b:${ref.name}` : `s:${ref.id}`)).join('\n');

/**
 * The looks a Mascot piece draws while its composition changes, and the refs that paint each frame. A change
 * of `images` plays `transition`; unset, or under the system's reduced-motion preference, the look swaps at
 * once. A change mid-run starts over from the frame on screen: the height eases on from where it is, and every
 * look still showing fades out as the new one fades in. Frames paint through the refs, not through renders.
 */
export function useMascotMotion(images: readonly MascotImageRef[], transition: MascotTransition | undefined, replay: MascotReplay | undefined) {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState<readonly ShownLook[]>(() => [{ id: 0, images }]);
  const nextId = useRef(1);
  const pieceRef = useRef<HTMLDivElement | null>(null);
  const looks = useRef(new Map<number, HTMLDivElement>());
  // What is on screen now: each look's opacity and the piece's height scale.
  const opacity = useRef(new Map<number, number>([[0, 1]]));
  const height = useRef(1);
  const frame = useRef(0);
  const key = lookKey(images);
  const lastKey = useRef(key);
  const lastReplay = useRef(replay?.id);

  const paintPiece = (scaleX: number, scaleY: number) => {
    height.current = scaleY;
    const piece = pieceRef.current;
    if (piece) piece.style.transform = scaleX === 1 && scaleY === 1 ? '' : `scale(${scaleX}, ${scaleY})`;
  };

  const paintLook = (id: number, value: number) => {
    opacity.current.set(id, value);
    const look = looks.current.get(id);
    if (look) look.style.opacity = String(value);
  };

  const newLook = (lookImages: readonly MascotImageRef[]): ShownLook => {
    const look = { id: nextId.current, images: lookImages };
    nextId.current += 1;
    return look;
  };

  const settle = (look: ShownLook) => {
    opacity.current = new Map([[look.id, 1]]);
    setShown([look]);
  };

  const run = (below: readonly ShownLook[], to: readonly MascotImageRef[], motion: MascotTransition | undefined) => {
    cancelAnimationFrame(frame.current);
    const incoming = newLook(to);
    if (!motion || motion.mode === 'none' || reduced) {
      paintPiece(1, 1);
      settle(incoming);
      return;
    }
    // The looks blend additively, so their opacities are shares of one whole: each fades out as the new one fades in.
    const kept = below
      .map((look) => ({ look, share: opacity.current.get(look.id) ?? 0 }))
      .filter(({ share }) => share > 0);
    opacity.current.set(incoming.id, 0);
    setShown([...kept.map(({ look }) => look), incoming]);
    const fromHeight = height.current;
    const start = performance.now();
    let collapsed = false;
    const tick = () => {
      const at = mascotTransitionAt(performance.now() - start, motion, fromHeight);
      const share = at.swapped ? at.opacity : 0;
      paintPiece(at.scaleX, at.scaleY);
      for (const { look, share: was } of kept) paintLook(look.id, was * (1 - share));
      paintLook(incoming.id, share);
      if (!collapsed && share >= 1) {
        collapsed = true;
        settle(incoming);
      }
      if (!at.done) frame.current = requestAnimationFrame(tick);
    };
    tick();
  };

  // Before paint, so the new look never flashes ahead of its run.
  useLayoutEffect(() => {
    if (replay && replay.id !== lastReplay.current) {
      lastReplay.current = replay.id;
      lastKey.current = key;
      const from = newLook(replay.from);
      opacity.current = new Map([[from.id, 1]]);
      run([from], images, replay.transition);
      return;
    }
    if (key === lastKey.current) return;
    lastKey.current = key;
    run(shown, images, transition);
    // A run starts on a new look or a new replay only; the rest is read as it stands then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, replay?.id]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // A fresh callback per render: React detaches and reattaches it, and the look takes its opacity again.
  const lookRef = (id: number) => (element: HTMLDivElement | null) => {
    if (!element) {
      looks.current.delete(id);
      return;
    }
    looks.current.set(id, element);
    element.style.opacity = String(opacity.current.get(id) ?? 1);
  };

  return { shown, pieceRef, lookRef };
}
