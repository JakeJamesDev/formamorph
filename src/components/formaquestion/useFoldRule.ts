import { useState } from 'react';

/**
 * One foldable block per answer. The block takes `defaultOpen` when `arrived` turns true, so an answer
 * that was still writing at a click starts in the clicked state. A toggle changes this block only,
 * and passes its new state to `onDefault` for the blocks that come later.
 */
export function useFoldRule(arrived: boolean, defaultOpen: boolean, onDefault: (open: boolean) => void) {
  const [own, setOwn] = useState<boolean | null>(null);
  if (arrived && own === null) setOwn(defaultOpen);
  const open = own ?? defaultOpen;
  const toggle = () => {
    setOwn(!open);
    onDefault(!open);
  };
  return { open, toggle };
}
