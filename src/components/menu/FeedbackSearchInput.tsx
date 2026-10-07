import { useEffect, useRef, useState } from "react";
import { SearchField } from "@/components/ui/search-field";
import { cn } from "@/lib/utils";

/** How long typing must pause before the list searches. */
export const FEEDBACK_SEARCH_DELAY_MS = 300;
/** Mirrors the server's cap, so the field never holds text the server would cut. */
export const FEEDBACK_SEARCH_MAX = 200;

interface FeedbackSearchInputProps {
  /** The search the list runs now. A change from outside replaces the typed text. */
  value: string;
  /** Called with trimmed text when the search should change. */
  onSearch: (text: string) => void;
  /** Accessible name and placeholder. */
  label: string;
  /** Classes for the wrapper, which grows to the row's free width unless these say otherwise. */
  className?: string;
}

/** A feedback list's search bar: searches after a pause in typing, and clears at once. */
export function FeedbackSearchInput({ value, onSearch, label, className }: FeedbackSearchInputProps) {
  const [text, setText] = useState(value);
  const lastSent = useRef(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };

  useEffect(() => cancel, []);

  useEffect(() => {
    if (value === lastSent.current) return;
    cancel();
    lastSent.current = value;
    setText(value);
  }, [value]);

  const apply = (next: string) => {
    cancel();
    const term = next.trim();
    if (term === lastSent.current) return;
    lastSent.current = term;
    onSearch(term);
  };

  const change = (next: string) => {
    setText(next);
    cancel();
    if (!next.trim()) {
      apply('');
      return;
    }
    timer.current = setTimeout(() => apply(next), FEEDBACK_SEARCH_DELAY_MS);
  };

  return (
    <SearchField
      aria-label={label}
      placeholder={label}
      maxLength={FEEDBACK_SEARCH_MAX}
      value={text}
      onChange={change}
      onKeyDown={(event) => { if (event.key === 'Enter') apply(text); }}
      className={cn('flex-1 min-w-[12rem]', className)}
    />
  );
}
