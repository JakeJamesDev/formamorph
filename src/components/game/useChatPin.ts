import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { Virtualizer } from '@tanstack/react-virtual';
import { jumpTarget, jumpVisible } from '@/lib/chatJump';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';
import type { ChatMessage } from '@/types';

// A code scroll counts as landed after this many still frames on its target.
const SETTLE_FRAMES = 2;
// A code scroll that stops short of its target (clamped, or cut off) counts as done after this many still frames.
const STALL_FRAMES = 20;
// Jump to Latest stops re-aiming after this many frames if its target never holds.
const MAX_AIM_FRAMES = 120;
// A target within this many pixels counts as reached.
const ON_TARGET_PX = 2;

// Input that means the player moves the view: any of these ends the code's hold on the scroll.
const PLAYER_SCROLL_EVENTS = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;

/** The scroll offset of an element inside the scroller. */
function offsetIn(scroller: HTMLElement, el: Element): number {
  return el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
}

function maxScroll(scroller: HTMLElement): number {
  return Math.max(0, scroller.scrollHeight - scroller.clientHeight);
}

/**
 * Chat's scroll control: pins a submitted turn to the viewport top, marks it for its minimum height, and
 * drives Jump to Latest. Turns carry `data-index`, and each turn's content ends at a `[data-content-end]` marker.
 */
export function useChatPin({ scroller, virtualizer, history, gameKey, lastIndex }: {
  scroller: RefObject<HTMLDivElement | null>;
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  history: ChatMessage[];
  gameKey: string | null;
  lastIndex: number;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const [pinnedIndex, setPinnedIndex] = useState<number | null>(null);
  const [pinRequest, setPinRequest] = useState(0);
  const [showJump, setShowJump] = useState(false);
  const lastIndexRef = useRef(lastIndex);
  lastIndexRef.current = lastIndex;

  // One code scroll in flight at a time: its target, and the frame loop that watches it land.
  const programmatic = useRef<{ target: number; frame: number } | null>(null);
  const aimFrame = useRef(0);

  const endProgrammatic = useCallback(() => {
    if (programmatic.current) cancelAnimationFrame(programmatic.current.frame);
    programmatic.current = null;
  }, []);

  /** Scroll the view from code. The scroll events it causes are not player scrolls. */
  const scrollFromCode = useCallback((top: number, behavior: ScrollBehavior) => {
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
    el.scrollTo({ top: target, behavior });
    state.frame = requestAnimationFrame(watch);
  }, [scroller, endProgrammatic]);

  const isProgrammaticScroll = useCallback(() => programmatic.current !== null, []);

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const end = el.querySelector(`[data-index="${lastIndexRef.current}"] [data-content-end]`);
    setShowJump(jumpVisible(end ? offsetIn(el, end) : null, { top: el.scrollTop, bottom: el.scrollTop + el.clientHeight }));
  }, [scroller]);

  // A render can mount or unmount the latest turn without a scroll or a size change.
  useLayoutEffect(() => { measure(); });

  // A resize of the viewport or the content moves the latest turn's end.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const onPlayerScroll = (e: Event) => {
      // A press on the content is a click; only a press on the scroller itself grabs the scrollbar.
      if (e.type === 'pointerdown' && e.target !== el) return;
      cancelAnimationFrame(aimFrame.current);
      endProgrammatic();
    };
    const resize = new ResizeObserver(onScroll);
    resize.observe(el);
    if (el.firstElementChild) resize.observe(el.firstElementChild);
    el.addEventListener('scroll', onScroll, { passive: true });
    for (const type of PLAYER_SCROLL_EVENTS) el.addEventListener(type, onPlayerScroll, { passive: true });
    return () => {
      resize.disconnect();
      el.removeEventListener('scroll', onScroll);
      for (const type of PLAYER_SCROLL_EVENTS) el.removeEventListener(type, onPlayerScroll);
      cancelAnimationFrame(frame);
      cancelAnimationFrame(aimFrame.current);
      endProgrammatic();
    };
  }, [scroller, measure, endProgrammatic]);

  // A submit and a Re-generate Narration both end the history on a new action message.
  const lastMessage = history[history.length - 1];
  const seen = useRef({ lastMessage, gameKey });
  useLayoutEffect(() => {
    const prev = seen.current;
    seen.current = { lastMessage, gameKey };
    if (gameKey !== prev.gameKey) { setPinnedIndex(null); return; }
    if (gameKey === null || lastMessage === prev.lastMessage || lastMessage?.role !== 'user') return;
    setPinnedIndex(lastIndex);
    setPinRequest((n) => n + 1);
  }, [lastMessage, gameKey, lastIndex]);

  // Pin once the submitted turn renders with its minimum height, so the list is tall enough to reach it.
  useLayoutEffect(() => {
    if (pinRequest === 0 || pinnedIndex === null) return;
    const el = scroller.current;
    if (!el) return;
    cancelAnimationFrame(aimFrame.current);
    const index = pinnedIndex;
    const pin = (tries: number) => {
      const turn = el.querySelector(`[data-index="${index}"]`);
      if (turn) { scrollFromCode(offsetIn(el, turn), reducedMotion ? 'auto' : 'smooth'); return; }
      // Scrolled far into history: land on the turn's estimated offset so it mounts, then aim at it.
      scrollFromCode(virtualizer.getOffsetForIndex(index, 'start')?.[0] ?? maxScroll(el), 'auto');
      if (tries < MAX_AIM_FRAMES) aimFrame.current = requestAnimationFrame(() => pin(tries + 1));
    };
    pin(0);
    // Only a new pin request scrolls; a resize or a motion preference change does not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinRequest]);

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
          else { stable = 0; scrollFromCode(target, reducedMotion ? 'auto' : 'smooth'); }
        }
      }
      if (stable < SETTLE_FRAMES + 1 && ++frames < MAX_AIM_FRAMES) aimFrame.current = requestAnimationFrame(aim);
    };
    aim();
  }, [scroller, virtualizer, scrollFromCode, reducedMotion]);

  return { pinnedIndex, showJump, jumpToLatest, isProgrammaticScroll, measure };
}
