import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { Tip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/** Whether `ref`'s one-line text is cut off, measured again when `text` changes or the element resizes. */
export function useIsCut(ref: RefObject<HTMLElement | null>, text: string): boolean {
  const [cut, setCut] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setCut(el.scrollWidth > el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, text]);
  return cut;
}

/** One line of text that cuts off with "…" and shows its full text in the shared tooltip only while cut. */
export function TruncatedText({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const cut = useIsCut(ref, text);
  return (
    <Tip tip={text} labelsChild={false} disabled={!cut}>
      <span ref={ref} className={cn('min-w-0 truncate', className)}>{text}</span>
    </Tip>
  );
}
