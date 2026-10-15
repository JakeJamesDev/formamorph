import { useCallback, type KeyboardEvent } from "react";

interface SuggestionKeysOptions {
  /** How many suggestions the list holds; ArrowDown stops on the last row. */
  count: number;
  setActive: (update: (active: number) => number) => void;
  onEnter: () => void;
  /** Tab accepts like Enter when `tabAccepts` allows it; without it Tab always moves focus. */
  onTab?: () => void;
  /** The caller's rule for when Tab accepts (default: always). */
  tabAccepts?: boolean;
  /** Gets the event so the caller decides whether Escape also stops a surrounding dialog's own handling. */
  onEscape: (e: KeyboardEvent<HTMLInputElement>) => void;
  /** Runs on ArrowDown, so a closed list can open. */
  onArrowDown?: () => void;
}

/**
 * Keyboard contract shared by the chip typeaheads: ArrowUp/ArrowDown move the highlight, Enter and Tab
 * accept, Escape dismisses. Enter during IME composition finishes the word and is left alone.
 * Returns a key handler that reports whether it consumed the event; other keys stay with the caller.
 */
export function useSuggestionKeys({ count, setActive, onEnter, onTab, tabAccepts = true, onEscape, onArrowDown }: SuggestionKeysOptions) {
  return useCallback((e: KeyboardEvent<HTMLInputElement>): boolean => {
    if (e.key === "Enter") {
      if (e.nativeEvent.isComposing) return false;
      e.preventDefault();
      onEnter();
    } else if (e.key === "Tab" && onTab && tabAccepts) {
      e.preventDefault();
      onTab();
    } else if (e.key === "Escape") {
      onEscape(e);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      onArrowDown?.();
      setActive((a) => Math.min(a + 1, Math.max(count - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else {
      return false;
    }
    return true;
  }, [count, setActive, onEnter, onTab, tabAccepts, onEscape, onArrowDown]);
}
