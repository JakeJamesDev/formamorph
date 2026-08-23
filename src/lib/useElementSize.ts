import { useEffect, useState } from 'react';

/** A width and a height in CSS pixels; zeroes until the element has been measured. */
export interface ElementSize {
  width: number;
  height: number;
}

const UNMEASURED: ElementSize = { width: 0, height: 0 };

/**
 * An element's live box, measured rather than assumed.
 *
 * A ref callback rather than a ref object, so the measurement starts the moment the node exists instead
 * of a render later. The size object is kept identical while the numbers are, which is what stops a
 * resize observer that fires on every layout from re-rendering everything downstream of it.
 *
 * @returns The ref callback to hand the element, and its current size
 */
export function useElementSize(): [(node: HTMLElement | null) => void, ElementSize] {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [size, setSize] = useState<ElementSize>(UNMEASURED);

  useEffect(() => {
    if (!node) {
      setSize(UNMEASURED);
      return;
    }

    const measure = () => {
      // Layout sizes rather than the painted box: a dialog's entrance animation scales its content, and
      // `getBoundingClientRect` mid-animation reads ~5% small — which ResizeObserver never corrects,
      // since a transform is not a layout change. `offsetWidth` ignores transforms; jsdom lays nothing
      // out and answers 0 there, so it falls back to the rect its tests stub.
      const box = node.getBoundingClientRect();
      const width = node.offsetWidth || box.width;
      const height = node.offsetHeight || box.height;
      setSize((held) => (held.width === width && held.height === height ? held : { width, height }));
    };

    measure();

    // Guarded: jsdom has no ResizeObserver in every suite, and a component that measures is exercised
    // there — the first measurement above is what those runs get.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(node);

    return () => observer?.disconnect();
  }, [node]);

  return [setNode, size];
}
