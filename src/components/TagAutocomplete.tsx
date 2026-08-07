import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { SuggestionList } from '@/components/SuggestionList';
import { useDanbooruTags } from '@/lib/useDanbooruTags';
import { rankTagSuggestions, activeTagToken, replaceActiveTag } from '@/lib/tagSuggest';

const SUGGESTION_LIMIT = 10;
const MIN_QUERY = 1; // require at least one typed character before suggesting (an empty tag shows nothing)

/**
 * Image-Tags textarea with inline Danbooru autocomplete. As you type a tag (the token after the last
 * comma/newline), a dropdown suggests real tags ranked by popularity; picking one completes the current
 * token with "<tag>, ". The tag list lazy-loads on first focus; value stays a comma-separated string.
 */
export function TagAutocomplete({ value, onChange, placeholder, id, rows }: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  rows?: number;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingSelectionRef = useRef<{ start: number; end: number } | null>(null);
  const [everFocused, setEverFocused] = useState(false); // defer the fetch until the field is first used
  const options = useDanbooruTags(everFocused);
  const [caret, setCaret] = useState(0);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const suggestions = useMemo(() => {
    if (!options.length) return [];
    const q = activeTagToken(value, caret).token.trim().toLowerCase();
    if (q.length < MIN_QUERY) return []; // empty token ⇒ nothing until a character is typed
    return rankTagSuggestions(options, q, SUGGESTION_LIMIT);
  }, [options, value, caret]);

  // Restore the caret after a programmatic insert (the value is controlled, so set it post-render).
  useLayoutEffect(() => {
    const pending = pendingSelectionRef.current;
    const node = textareaRef.current;
    if (!pending || !node) return;
    pendingSelectionRef.current = null;
    node.focus();
    node.setSelectionRange(pending.start, pending.end);
  });

  const select = (tag: string) => {
    const node = textareaRef.current;
    const at = node?.selectionStart ?? value.length;
    const { value: next, caret } = replaceActiveTag(value, at, tag);
    pendingSelectionRef.current = { start: caret, end: caret };
    onChange(next);
    setCaret(caret);
    setOpen(true); // stay open so arrow keys keep working and the next tag can be picked
    setActive(0);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!open || !suggestions.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      const choice = suggestions[active];
      if (choice) { e.preventDefault(); select(choice); }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); setCaret(e.target.selectionStart ?? 0); setActive(0); setOpen(true); }}
        onSelect={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
        onFocus={() => { setEverFocused(true); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 100)}
        onKeyDown={onKeyDown}
      />
      {open && suggestions.length > 0 && (
        <SuggestionList items={suggestions} active={active} onPick={select} onHover={setActive} className="w-full" />
      )}
    </div>
  );
}
