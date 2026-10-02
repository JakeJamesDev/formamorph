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
  /** Bumped to reload the list in place. */
  const [nonce, setNonce] = useState(0);
  /** On the element that holds the list; it finds the viewport that scrolls it. */
  const listRef = useRef<HTMLDivElement>(null);
  const savedScroll = useRef<number | null>(null);

  const refresh = () => setNonce((n) => n + 1);

  const open = (id: string) => {
    savedScroll.current = viewportOf(listRef.current)?.scrollTop ?? null;
    setOpenId(id);
  };

  // Reloads too: not every change in a thread reports itself, and the rows stayed on screen meanwhile.
  const back = () => {
    setOpenId(null);
    refresh();
  };

  // Before paint, so the list never shows at the thread's offset first.
  useLayoutEffect(() => {
    if (openId !== null || savedScroll.current === null) return;
    const viewport = viewportOf(listRef.current);
    if (viewport) viewport.scrollTop = savedScroll.current;
    savedScroll.current = null;
  }, [openId]);

  return { page, setPage, openId, open, back, nonce, refresh, listRef };
}
