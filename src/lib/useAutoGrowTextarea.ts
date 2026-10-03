import { useLayoutEffect, useRef, useState } from 'react';

/**
 * A one-line textarea that grows with its text while it has focus, up to `maxHeight`, then scrolls. Without
 * focus it is one line again, with its text kept and clipped. `height` is the field's current height, for a
 * wrapper that holds the field's place in the layout. Spread `fieldProps` on the textarea.
 */
export function useAutoGrowTextarea(value: string, lineHeight: number, maxHeight: number) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);
  const [height, setHeight] = useState(lineHeight);

  // Runs on every value and focus change, so growth tracks typing.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!focused) {
      el.style.height = '';
      el.style.overflowY = 'hidden';
      setHeight(lineHeight);
      return;
    }
    el.style.height = 'auto';
    const h = Math.min(Math.max(el.scrollHeight, lineHeight), maxHeight);
    el.style.height = `${h}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
    setHeight(h);
  }, [value, focused, lineHeight, maxHeight]);

  return {
    height,
    focused,
    /** Wraps while grown. Clipped to its first line while one line. */
    stateClass: focused ? 'whitespace-pre-wrap' : 'overflow-hidden whitespace-nowrap',
    fieldProps: {
      ref,
      rows: 1,
      onFocus: () => setFocused(true),
      onBlur: () => setFocused(false),
    },
  };
}
