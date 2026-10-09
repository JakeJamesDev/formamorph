import { useCallback, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { applySlashCompletion, slashCompletion } from './slashCommands';

/** The x offset, inside `field`, where `text` typed from the field's start ends. */
function textEndX(field: HTMLTextAreaElement, text: string): number {
  const style = getComputedStyle(field);
  const probe = document.createElement('span');
  probe.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${style.font};letter-spacing:${style.letterSpacing}`;
  probe.textContent = text;
  document.body.appendChild(probe);
  const width = probe.getBoundingClientRect().width;
  probe.remove();
  return (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.borderLeftWidth) || 0) + width - field.scrollLeft;
}

/**
 * Slash-command completion for a text field: the words that complete the one under the caret, the
 * highlighted row, and where the list sits. `onKeyDown` takes the keys the open list uses and reports
 * whether it did, so the field's own Enter only sends when the list is shut.
 */
export function useSlashCompletion(field: RefObject<HTMLTextAreaElement | null>, value: string, setValue: (value: string) => void) {
  const [caret, setCaret] = useState(value.length);
  const [active, setActive] = useState(0);
  // Escape shuts the list until the text changes.
  const [dismissedAt, setDismissedAt] = useState<string | null>(null);
  const pendingCaret = useRef<number | null>(null);

  const completion = useMemo(() => slashCompletion(value, Math.min(caret, value.length)), [value, caret]);
  const items = useMemo(() => (dismissedAt === value ? [] : completion?.items ?? []), [dismissedAt, value, completion]);
  const open = items.length > 0;
  const shown = Math.min(active, Math.max(0, items.length - 1));

  const readCaret = useCallback(() => {
    const el = field.current;
    if (el) setCaret(el.selectionStart ?? el.value.length);
  }, [field]);

  // New text starts the list at its top row; an accepted word moves the caret after the render that puts it in.
  useLayoutEffect(() => {
    setActive(0);
    const el = field.current;
    if (!el || pendingCaret.current === null) return;
    el.setSelectionRange(pendingCaret.current, pendingCaret.current);
    setCaret(pendingCaret.current);
    pendingCaret.current = null;
  }, [value, field]);

  const accept = useCallback((word: string) => {
    if (!completion) return;
    const next = applySlashCompletion(value, completion, word);
    pendingCaret.current = next.caret;
    setActive(0);
    setValue(next.value);
  }, [completion, value, setValue]);

  const onKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (!open || e.nativeEvent.isComposing) return false;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((shown + step + items.length) % items.length);
      return true;
    }
    if ((e.key === 'Enter' && !e.shiftKey) || (e.key === 'Tab' && !e.shiftKey)) {
      e.preventDefault();
      accept(items[shown]);
      return true;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setDismissedAt(value);
      return true;
    }
    return false;
  }, [open, items, shown, accept, value]);

  const left = open && completion && field.current ? textEndX(field.current, value.slice(0, completion.start)) : 0;

  return { items, active: shown, setActive, accept, onKeyDown, readCaret, left };
}
