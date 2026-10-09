import { useEffect, useLayoutEffect, useReducer, useRef, type CSSProperties } from 'react';
import { useSettingsOptional } from '@/contexts/SettingsContext';
import { revealActive, revealAnimName, revealVars } from './narrationRevealConfig';
import { getRevealTiming } from './revealTimingStore';
import { splitWords } from './choices';

/** Whether `next` adds rows to `prev`: earlier rows unchanged, the last one at most still being written. */
export function rowsGrew(prev: readonly string[], next: readonly string[]): boolean {
  if (next.length < prev.length) return false;
  return prev.every((row, i) => (i === prev.length - 1 ? next[i].startsWith(row) : next[i] === row));
}

/** How a list of rows streams in: which rows show yet, and each row's and word's entrance. */
export interface RowReveal {
  /** Whether any row is streaming; when not, rows render as plain text. */
  streaming: boolean;
  /** Whether the row has started; a row that hasn't takes no space. */
  shown: (row: number) => boolean;
  /** The row's chrome entrance, or undefined to show it as is. */
  row: (row: number) => CSSProperties | undefined;
  /** One word's entrance, or undefined to show it as is. */
  word: (row: number, word: number) => CSSProperties | undefined;
}

interface RowState {
  start: number;
  /** When each word starts, on the performance clock. */
  targets: number[];
  /** Each word's animation delay, fixed at its first render so a later render can't restart it. */
  delays: Map<number, number>;
}

const STILL: RowReveal = { streaming: false, shown: () => true, row: () => undefined, word: () => undefined };

/**
 * When `enabled`, streams rows in at the narration's pace: a row's words enter one stagger apart with the narration's
 * reveal effects, and each row starts a stagger after the last word of the row before. A row that has
 * not started is not shown, so its chrome never appears ahead of its text. Only growth streams: rows
 * present at mount, or a list that changes rather than grows, show at once.
 */
export function useRowReveal(
  rows: readonly string[], countWords = (row: string) => splitWords(row).length, enabled = true,
): RowReveal {
  const settings = useSettingsOptional();
  const committed = useRef(rows);
  const states = useRef(new Map<number, RowState>());
  const [wakes, wake] = useReducer((n: number) => n + 1, 0);
  const active = enabled && !!settings && revealActive(settings.revealSpec);
  const { stagger, duration } = getRevealTiming();
  const now = performance.now();

  if (!active || !rowsGrew(committed.current, rows)) {
    states.current.clear();
  } else {
    rows.forEach((text, i) => {
      let state = states.current.get(i);
      if (!state) {
        if (i < committed.current.length) return; // on screen before the list grew: shown as is
        const before = states.current.get(i - 1);
        const after = before ? (before.targets.at(-1) ?? before.start) + stagger : now;
        state = { start: Math.max(now, after), targets: [], delays: new Map() };
        states.current.set(i, state);
      }
      // A row still being written gains words; each starts a stagger after the last, and never in the past.
      const count = countWords(text);
      for (let w = state.targets.length; w < count; w++) {
        const prev = state.targets[w - 1];
        state.targets.push(Math.max(now, prev === undefined ? state.start : prev + stagger));
      }
    });
  }
  useLayoutEffect(() => { committed.current = rows; });

  // Render again when the next row is due to start; each wake re-arms, as a timer can fire a hair early.
  const pending = [...states.current.values()].map((s) => s.start).filter((t) => t > now);
  const nextStart = pending.length ? Math.min(...pending) : null;
  useEffect(() => {
    if (nextStart === null) return;
    const timer = setTimeout(wake, Math.max(0, nextStart - performance.now()));
    return () => clearTimeout(timer);
  }, [nextStart, wakes]);

  if (!settings || !active || states.current.size === 0) return STILL;
  const { revealSpec, revealEasing } = settings;
  const vars = revealVars(revealSpec) as CSSProperties;
  const effect = `sd-${revealAnimName(revealSpec)} ${duration}ms ${revealEasing}`;
  // The chrome only fades, so it carries no motion onto the words inside it.
  const chrome = { '--rl-o': '0', animation: `sd-reveal ${duration}ms ${revealEasing} both` } as CSSProperties;
  return {
    streaming: true,
    shown: (row) => {
      const state = states.current.get(row);
      return !state || state.start <= now + 1;
    },
    row: (row) => (states.current.has(row) ? chrome : undefined),
    word: (row, word) => {
      const state = states.current.get(row);
      const target = state?.targets[word];
      if (!state || target === undefined) return undefined;
      let delay = state.delays.get(word);
      if (delay === undefined) {
        delay = Math.max(0, Math.round(target - now));
        state.delays.set(word, delay);
      }
      return { ...vars, display: 'inline-block', whiteSpace: 'pre', transformOrigin: 'var(--rl-origin, center)', animation: `${effect} ${delay}ms both` };
    },
  };
}
