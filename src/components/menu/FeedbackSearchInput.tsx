import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
}

/** A feedback list's search bar: searches after a pause in typing, and clears at once. */
export function FeedbackSearchInput({ value, onSearch, label }: FeedbackSearchInputProps) {
  const [text, setText] = useState(value);
  const applied = useRef(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const cancel = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };

  useEffect(() => cancel, []);

  useEffect(() => {
    if (value === applied.current) return;
    cancel();
    applied.current = value;
    setText(value);
  }, [value]);

  const apply = (next: string) => {
    cancel();
    const term = next.trim();
    if (term === applied.current) return;
    applied.current = term;
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

  const clear = () => {
    change('');
    inputRef.current?.focus();
  };

  return (
    <div className="relative w-56">
      <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        type="search"
        aria-label={label}
        placeholder={label}
        maxLength={FEEDBACK_SEARCH_MAX}
        value={text}
        onChange={(event) => change(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Enter') apply(text); }}
        className="pl-9 pr-9 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {text && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
          aria-label="Clear Search"
          onClick={clear}
        >
          <X className="h-4 w-4" aria-hidden />
        </Button>
      )}
    </div>
  );
}
