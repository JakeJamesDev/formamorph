import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { Virtualizer } from '@tanstack/react-virtual';
import { jumpTarget, latestPlacement } from '@/lib/chatJump';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';
import type { ChatMessage } from '@/types';

// A code scroll counts as landed after this many still frames on its target.
const SETTLE_FRAMES = 2;
// A code scroll that stops short of its target (clamped, or cut off) counts as done after this many still frames.
const STALL_FRAMES = 20;
// A pin or a jump stops re-aiming after this many frames if its target never holds.
const MAX_REAIM_FRAMES = 120;
// A target within this many pixels counts as reached.
const ON_TARGET_PX = 2;

// Input that means the player moves the view: any of these ends the code's hold on the scroll.
const PLAYER_SCROLL_EVENTS = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;
const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ']);

/** The scroll offset of an element inside the scroller. */
function offsetIn(scroller: HTMLElement, el: Element): number {
  return el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
}

function maxScroll(scroller: HTMLElement): number {
  return Math.max(0, scroller.scrollHeight - scroller.clientHeight);
}

/**
 * Chat's scroll control: pins a submitted turn to the viewport top, names the turn that takes the minimum
 * height, drives Jump to Latest, and tells scrolls the code starts from player scrolls. Turns carry
 * `data-index`, and each turn's content ends at a `[data-content-end]` marker.
 */
export function useChatPin({ scroller, virtualizer, history, gameKey, lastIndex }: {
  scroller: RefObject<HTMLDivElement | null>;
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  history: ChatMessage[];
  gameKey: string | null;
  lastIndex: number;
}) {
  const reducedMotion = usePrefersReducedMotion();
  // A new object per submit, so the same index pinned twice still scrolls twice.
  const [pin, setPin] = useState<{ index: number } | null>(null);
  const [placement, setPlacement] = useState<'above' | 'inside' | 'below'>('inside');
  const lastIndexRef = useRef(lastIndex);
  lastIndexRef.current = lastIndex;
  const behavior: ScrollBehavior = reducedMotion ? 'auto' : 'smooth';

  // One code scroll in flight at a time: its target, and the frame loop that watches it land.
  const programmatic = useRef<{ target: number; frame: number } | null>(null);
  const aimFrame = useRef(0);

  const endProgrammatic = useCallback(() => {
    if (programmatic.current) cancelAnimationFrame(programmatic.current.frame);
    programmatic.current = null;
  }, []);

  /** Hand the view to the player: a smooth scroll the code started would otherwise glide on over their input. */
  const yieldToPlayer = useCallback(() => {
    cancelAnimationFrame(aimFrame.current);
    const el = scroller.current;
    if (el && programmatic.current) el.scrollTo({ top: el.scrollTop, behavior: 'instant' });
    endProgrammatic();
  }, [scroller, endProgrammatic]);

  /** Scroll the view from code. The scroll events it causes are not player scrolls. */
  const scrollFromCode = useCallback((top: number, how: ScrollBehavior) => {
    const el = scroller.current;
    if (!el) return;
    endProgrammatic();
    const target = Math.min(Math.max(0, top), maxScroll(el));
    const state = { target, frame: 0 };
    programmatic.current = state;
    let last = el.scrollTop;
    let still = 0;
    const watch = () => {
      const now = el.scrollTop;
      still = now === last ? still + 1 : 0;
      last = now;
      const landed = Math.abs(now - state.target) < ON_TARGET_PX && still >= SETTLE_FRAMES;
      if (landed || still >= STALL_FRAMES) { programmatic.current = null; return; }
      state.frame = requestAnimationFrame(watch);
    };
    el.scrollTo({ top: target, behavior: how });
    state.frame = requestAnimationFrame(watch);
  }, [scroller, endProgrammatic]);

  const isProgrammaticScroll = useCallback(() => programmatic.current !== null, []);

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const end = el.querySelector(`[data-index="${lastIndexRef.current}"] [data-content-end]`);
    setPlacement(latestPlacement(end ? offsetIn(el, end) : null, { top: el.scrollTop, bottom: el.scrollTop + el.clientHeight }));
  }, [scroller]);

  // Mounting or unmounting the latest turn changes the rendered range without a scroll or a resize.
  const items = virtualizer.getVirtualItems();
  const rangeKey = items.length ? `${items[0].index}-${items[items.length - 1].index}/${lastIndex}` : '';
  useLayoutEffect(measure, [measure, rangeKey]);

  // Measure after a scroll or a resize of the viewport or the content; stop code scrolls on player input.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let frame = 0;
    const scheduleMeasure = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const onPlayerInput = (e: Event) => {
      // A press on the content is a click; the scrollbar is a sibling of the scroller, inside its frame.
      if (e.type === 'pointerdown' && el.contains(e.target as Node)) return;
      if (e instanceof KeyboardEvent && !SCROLL_KEYS.has(e.key)) return;
      yieldToPlayer();
    };
    const resize = new ResizeObserver(scheduleMeasure);
    resize.observe(el);
    if (el.firstElementChild) resize.observe(el.firstElementChild);
    el.addEventListener('scroll', scheduleMeasure, { passive: true });
    // The frame holds the scroller and its scrollbar, so a press on the bar reaches this listener too.
    const frameEl = el.parentElement ?? el;
    for (const type of PLAYER_SCROLL_EVENTS) frameEl.addEventListener(type, onPlayerInput, { passive: true });
    return () => {
      resize.disconnect();
      el.removeEventListener('scroll', scheduleMeasure);
      for (const type of PLAYER_SCROLL_EVENTS) frameEl.removeEventListener(type, onPlayerInput);
      cancelAnimationFrame(frame);
      cancelAnimationFrame(aimFrame.current);
      endProgrammatic();
    };
  }, [scroller, measure, endProgrammatic, yieldToPlayer]);

  // A submit and a Re-generate Narration both end the history on a new action message.
  const lastMessage = history[history.length - 1];
  const seen = useRef({ lastMessage, gameKey });
  useLayoutEffect(() => {
    const prev = seen.current;
    seen.current = { lastMessage, gameKey };
    if (gameKey !== prev.gameKey) { setPin(null); return; }
    if (gameKey === null || lastMessage === prev.lastMessage || lastMessage?.role !== 'user') return;
    setPin({ index: lastIndex });
  }, [lastMessage, gameKey, lastIndex]);

  // Pin once the submitted turn renders with its minimum height, so the list is tall enough to reach it.
  // The effect reads the motion preference and helpers through a ref: only a new pin scrolls.
  const pinDeps = useRef({ behavior, virtualizer, scrollFromCode });
  pinDeps.current = { behavior, virtualizer, scrollFromCode };
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!pin || !el) return;
    const deps = pinDeps.current;
    cancelAnimationFrame(aimFrame.current);
    const aim = (frames: number) => {
      const turn = el.querySelector(`[data-index="${pin.index}"]`);
      if (turn) { deps.scrollFromCode(offsetIn(el, turn), deps.behavior); return; }
      // Scrolled far into history: land on the turn's estimated offset so it mounts, then aim at it.
      deps.scrollFromCode(deps.virtualizer.getOffsetForIndex(pin.index, 'start')?.[0] ?? maxScroll(el), 'auto');
      if (frames < MAX_REAIM_FRAMES) aimFrame.current = requestAnimationFrame(() => aim(frames + 1));
    };
    aim(0);
    return () => cancelAnimationFrame(aimFrame.current);
  }, [pin, scroller]);

  /** Scroll to the newest content, re-aiming until the target holds while the turns above it measure. */
  const jumpToLatest = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    cancelAnimationFrame(aimFrame.current);
    let frames = 0;
    let stable = 0;
    const aim = () => {
      if (!programmatic.current) {
        const index = lastIndexRef.current;
        const turn = el.querySelector(`[data-index="${index}"]`);
        const end = turn?.querySelector('[data-content-end]');
        if (!turn || !end) {
          stable = 0;
          scrollFromCode(virtualizer.getOffsetForIndex(index, 'end')?.[0] ?? maxScroll(el), 'auto');
        } else {
          const target = jumpTarget({
            turnTop: offsetIn(el, turn), contentEnd: offsetIn(el, end), viewportHeight: el.clientHeight, maxScroll: maxScroll(el),
          });
          if (Math.abs(el.scrollTop - target) < ON_TARGET_PX) stable += 1;
          else { stable = 0; scrollFromCode(target, behavior); }
        }
      }
      if (stable <= SETTLE_FRAMES && ++frames < MAX_REAIM_FRAMES) aimFrame.current = requestAnimationFrame(aim);
    };
    aim();
  }, [scroller, virtualizer, scrollFromCode, behavior]);

  return {
    pinnedIndex: pin?.index ?? null,
    showJump: gameKey !== null && placement !== 'inside',
    newTextBelow: placement === 'below',
    jumpToLatest,
    isProgrammaticScroll,
  };
}
