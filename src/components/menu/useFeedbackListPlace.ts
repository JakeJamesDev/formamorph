import { useLayoutEffect, useRef, useState } from "react";

/** The scroll viewport a list sits in. */
const viewportOf = (node: HTMLElement | null): HTMLElement | null =>
  node?.closest<HTMLElement>('[data-radix-scroll-area-viewport]') ?? null;

/**
 * A feedback tab's place in its list: the page, the open thread, and the scroll position to return to.
 * The list stays mounted under an open thread, so Back lands on the same rows at the same offset.
 */
export function useFeedbackListPlace() {
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  /** On the element that holds the list; it finds the viewport that scrolls it. */
  const listRef = useRef<HTMLDivElement>(null);
  const savedScroll = useRef<number | null>(null);

  const open = (id: string) => {
    savedScroll.current = viewportOf(listRef.current)?.scrollTop ?? null;
    setOpenId(id);
  };

  const back = () => setOpenId(null);

  // Before paint, so the list never shows at the thread's offset first.
  useLayoutEffect(() => {
    if (openId !== null || savedScroll.current === null) return;
    const viewport = viewportOf(listRef.current);
    if (viewport) viewport.scrollTop = savedScroll.current;
    savedScroll.current = null;
  }, [openId]);

  /** Wraps a filter's setter so a change starts the list on page 1. */
  const refilter = <T>(set: (value: T) => void) => (value: T) => {
    set(value);
    setPage(1);
  };

  return { page, setPage, openId, open, back, listRef, refilter };
}
