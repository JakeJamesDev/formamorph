import { useEffect, useState } from 'react';

/**
 * Keeps a conditionally rendered surface mounted for `ms` after `open` turns false, so a closing
 * animation has something to play on. Mounting follows `open` synchronously, so a surface that opens
 * in the same commit as a sibling dialog keeps its place in the DOM order.
 */
export function useLingeringMount(open: boolean, ms: number): boolean {
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);
  useEffect(() => {
    if (open) return;
    const timer = setTimeout(() => setMounted(false), ms);
    return () => clearTimeout(timer);
  }, [open, ms]);
  return open || mounted;
}
