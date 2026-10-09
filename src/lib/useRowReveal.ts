import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import { useSettingsOptional } from '@/contexts/SettingsContext';
import { revealActive, revealAnimName, revealVars } from './narrationRevealConfig';

/** One row's entrance, and the least time between two rows' starts, in ms. The gap lets a row settle,
 *  mostly, before the next one moves: the box enters with row one and holds the rest. */
export const ROW_REVEAL_DURATION = 400;
export const ROW_REVEAL_STAGGER = 300;

/** Whether `next` adds rows to `prev`: earlier rows unchanged, the last one at most still being written. */
export function rowsGrew(prev: readonly string[], next: readonly string[]): boolean {
  if (next.length < prev.length) return false;
  return prev.every((row, i) => (i === prev.length - 1 ? next[i].startsWith(row) : next[i] === row));
}

/**
 * The narration's reveal effects for a list of rows. A row that arrives while the list is on screen plays
 * them, each starting at least a stagger after the one before, however they arrive; rows present at mount, or a list that changes rather
 * than grows, show at once. Returns each row's style.
 */
export function useRowReveal(rows: readonly string[]): (index: number) => CSSProperties | undefined {
  // Outside the app's settings, such as the design-system reference, rows show at once.
  const settings = useSettingsOptional();
  const committed = useRef(rows);
  // Each animated row's delay, fixed at its arrival so a later render can't restart it.
  const delays = useRef(new Map<number, number>());
  const lastStart = useRef(Number.NEGATIVE_INFINITY);

  if (rowsGrew(committed.current, rows)) {
    const now = performance.now();
    for (let i = committed.current.length; i < rows.length; i++) {
      if (delays.current.has(i)) continue;
      const start = Math.max(now, lastStart.current + ROW_REVEAL_STAGGER);
      delays.current.set(i, Math.round(start - now));
      lastStart.current = start;
    }
  } else {
    delays.current.clear();
    lastStart.current = Number.NEGATIVE_INFINITY;
  }
  useLayoutEffect(() => { committed.current = rows; });

  if (!settings || !revealActive(settings.revealSpec)) return () => undefined;
  const { revealSpec, revealEasing, revealMinDuration } = settings;
  const duration = Math.max(ROW_REVEAL_DURATION, revealMinDuration);
  const animation = `sd-${revealAnimName(revealSpec)} ${duration}ms ${revealEasing}`;
  const vars = revealVars(revealSpec) as CSSProperties;
  return (index) => {
    const delay = delays.current.get(index);
    if (delay === undefined) return undefined;
    return { ...vars, transformOrigin: 'var(--rl-origin, center)', animation: `${animation} ${delay}ms both` };
  };
}
