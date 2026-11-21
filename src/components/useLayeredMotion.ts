import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { mascotTransitionAt, type MascotTransition } from '@/lib/formaquestion/mascotTransition';
import type { LayeredPicture } from '@/lib/layeredImages';
import { stackChange } from '@/lib/layeredTransition';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';

/** One image a Layer draws. A Layer draws one at rest, and the old ones under the new one while it fades. */
export interface LayerLook {
  readonly key: number;
  readonly data: string;
}

type Looks = Readonly<Record<string, readonly LayerLook[]>>;

/** A Layer's run from the looks it showed to `incoming`, or to nothing. */
interface LayerRun {
  start: number;
  mode: 'dissolve' | 'jelly';
  transition: MascotTransition;
  kept: { key: number; share: number }[];
  incoming?: number;
}

interface SquashRun {
  start: number;
  transition: MascotTransition;
  fromHeight: number;
}

/**
 * The looks each Layer of a stack draws while its Variants change, and the refs that paint each frame.
 * A changed Dissolve Layer fades from its old Variant to its new one; changed Jelly Layers swap at the dip of one
 * squash of the whole box (Q17, Q20). A first picture or another Layered Image draws at once. Frames paint
 * through the refs, not through renders.
 */
export function useLayeredMotion(picture: LayeredPicture) {
  const reduced = usePrefersReducedMotion();
  const nextKey = useRef(0);
  const newLook = (data: string): LayerLook => ({ key: nextKey.current++, data });
  const restingLooks = (from: LayeredPicture): Looks =>
    Object.fromEntries(from.layers.map((layer) => [layer.id, layer.data ? [newLook(layer.data)] : []]));

  const [looks, setLooks] = useState<Looks>(() => restingLooks(picture));
  const looksNow = useRef(looks);
  const commit = (next: Looks) => {
    looksNow.current = next;
    setLooks(next);
  };
  const last = useRef(picture);
  const opacity = useRef(new Map<number, number>());
  const elements = useRef(new Map<number, HTMLElement>());
  const boxRef = useRef<HTMLSpanElement | null>(null);
  const height = useRef(1);
  const runs = useRef(new Map<string, LayerRun>());
  const squash = useRef<SquashRun | null>(null);
  const frame = useRef(0);

  const paintBox = (scaleX: number, scaleY: number) => {
    height.current = scaleY;
    const box = boxRef.current;
    if (box) box.style.transform = scaleX === 1 && scaleY === 1 ? '' : `scale(${scaleX}, ${scaleY})`;
  };

  const paintLook = (key: number, value: number) => {
    opacity.current.set(key, value);
    const element = elements.current.get(key);
    if (element) element.style.opacity = String(value);
  };

  const tick = () => {
    const now = performance.now();
    const squashing = squash.current;
    if (squashing) {
      const at = mascotTransitionAt(now - squashing.start, squashing.transition, squashing.fromHeight);
      paintBox(at.scaleX, at.scaleY);
      if (at.done) squash.current = null;
    }
    const settled: [string, readonly LayerLook[]][] = [];
    for (const [layerId, run] of runs.current) {
      const at = mascotTransitionAt(now - run.start, { ...run.transition, mode: run.mode });
      // A Jelly Layer swaps at the dip with no fade.
      const share = run.mode === 'jelly' ? (at.swapped ? 1 : 0) : at.opacity;
      for (const { key, share: was } of run.kept) paintLook(key, was * (1 - share));
      if (run.incoming !== undefined) paintLook(run.incoming, share);
      if (share < 1 && !at.done) continue;
      runs.current.delete(layerId);
      for (const { key } of run.kept) opacity.current.delete(key);
      // A resting look reads as fully shown.
      if (run.incoming !== undefined) opacity.current.delete(run.incoming);
      settled.push([layerId, (looksNow.current[layerId] ?? []).filter((look) => look.key === run.incoming)]);
    }
    if (settled.length) commit({ ...looksNow.current, ...Object.fromEntries(settled) });
    if (squash.current || runs.current.size) frame.current = requestAnimationFrame(tick);
  };

  // Before paint, so a new Variant never flashes ahead of its run.
  useLayoutEffect(() => {
    const from = last.current;
    if (from === picture) return;
    last.current = picture;
    if (from.entryId !== picture.entryId) {
      cancelAnimationFrame(frame.current);
      runs.current.clear();
      squash.current = null;
      opacity.current.clear();
      paintBox(1, 1);
      commit(restingLooks(picture));
      return;
    }
    const change = stackChange(from, picture, reduced);
    const next: Record<string, readonly LayerLook[]> = { ...looksNow.current };
    const start = performance.now();
    const changed = new Set(change?.changes.map((c) => c.layerId));
    let moved = changed.size > 0;
    const forget = (looks: readonly LayerLook[] | undefined) => looks?.forEach((look) => opacity.current.delete(look.key));
    // A Layer the picture no longer holds stops drawing at once.
    const held = new Set(picture.layers.map((layer) => layer.id));
    for (const layerId of Object.keys(next)) {
      if (held.has(layerId)) continue;
      forget(next[layerId]);
      delete next[layerId];
      runs.current.delete(layerId);
      moved = true;
    }
    for (const c of change?.changes ?? []) {
      const incoming = c.to === undefined ? undefined : newLook(c.to);
      if (c.mode === 'none') {
        forget(next[c.layerId]);
        runs.current.delete(c.layerId);
        next[c.layerId] = incoming ? [incoming] : [];
        continue;
      }
      // Every look still showing fades out from where it is as the new one fades in.
      const all = (next[c.layerId] ?? []).map((look) => ({ look, share: opacity.current.get(look.key) ?? 1 }));
      const kept = all.filter(({ share }) => share > 0);
      forget(all.filter(({ share }) => share <= 0).map(({ look }) => look));
      if (incoming) opacity.current.set(incoming.key, 0);
      next[c.layerId] = [...kept.map(({ look }) => look), ...(incoming ? [incoming] : [])];
      runs.current.set(c.layerId, {
        start,
        mode: c.mode,
        // Every Jelly Layer swaps at the one squash's dip.
        transition: c.mode === 'jelly' && change?.squash ? change.squash : c.transition,
        kept: kept.map(({ look, share }) => ({ key: look.key, share })),
        ...(incoming ? { incoming: incoming.key } : {}),
      });
    }
    // A Layer the last picture did not hold draws its image at once.
    for (const layer of picture.layers) {
      if (changed.has(layer.id) || runs.current.has(layer.id)) continue;
      const shown = next[layer.id] ?? [];
      if (shown.at(-1)?.data === layer.data) continue;
      forget(shown);
      next[layer.id] = layer.data ? [newLook(layer.data)] : [];
      moved = true;
    }
    // Callers resolve a fresh picture each render, so an unchanged one must not render again.
    if (!moved) return;
    if (change?.squash) squash.current = { start, transition: change.squash, fromHeight: height.current };
    commit(next);
    cancelAnimationFrame(frame.current);
    if (runs.current.size || squash.current) tick();
    // A run starts on a new picture only; the rest is read as it stands then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picture]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // A fresh callback per render: React detaches and reattaches it, and the look takes its opacity again.
  const lookRef = (key: number) => (element: HTMLElement | null) => {
    if (!element) {
      elements.current.delete(key);
      return;
    }
    elements.current.set(key, element);
    element.style.opacity = String(opacity.current.get(key) ?? 1);
  };

  const looksOf = (layerId: string): readonly LayerLook[] => looks[layerId] ?? [];
  return { looksOf, boxRef, lookRef };
}
