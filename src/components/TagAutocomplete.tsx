import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { loadDanbooruTags } from '@/lib/danbooruTags';

const SUGGESTION_LIMIT = 10;
const MIN_QUERY = 1; // require at least one typed character before suggesting (an empty tag shows nothing)

// The tag the caret sits in. `start`/`end` bound the whole tag (last comma/newline before, spaces skipped →
// next comma/newline) so a selection replaces all of it; `token` is only the part left of the caret, which is
// what we match on (so `red r|ibbon` still suggests from `red r`, matching what the user sees while typing).
function activeToken(value: string, caret: number): { start: number; end: number; token: string } {
  const before = value.slice(0, caret);
  const boundary = Math.max(before.lastIndexOf(','), before.lastIndexOf('\n'));
  let start = boundary + 1;
  while (start < caret && value[start] === ' ') start++;
  const rel = value.slice(caret).search(/[,\n]/);
  const end = rel === -1 ? value.length : caret + rel;
  return { start, end, token: value.slice(start, caret) };
}

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
  const loadedRef = useRef(false);
  const [options, setOptions] = useState<string[]>([]);
  const [caret, setCaret] = useState(0);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const suggestions = useMemo(() => {
    if (!options.length) return [];
    const q = activeToken(value, caret).token.trim().toLowerCase();
    if (q.length < MIN_QUERY) return []; // empty token ⇒ nothing until a character is typed
    const starts: string[] = [];
    const contains: string[] = [];
    for (const o of options) {
      const lo = o.toLowerCase();
      if (lo.startsWith(q)) starts.push(o);
      else if (lo.includes(q)) contains.push(o);
      if (starts.length >= SUGGESTION_LIMIT) break; // enough prefix hits; skip the rest
    }
    return [...starts, ...contains].slice(0, SUGGESTION_LIMIT); // both already in popularity order
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

  const focusLoad = () => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    loadDanbooruTags().then(setOptions).catch(() => { /* offline/SFW build: no suggestions */ });
  };

  const select = (tag: string) => {
    const node = textareaRef.current;
    const at = node?.selectionStart ?? value.length;
    const { start, end } = activeToken(value, at);
    // Replace the whole tag. Append ", " only when it's the last tag; otherwise keep the existing separator.
    const isLast = end >= value.length;
    const insert = isLast ? `${tag}, ` : tag;
    const next = value.slice(0, start) + insert + value.slice(end);
    const caret = start + insert.length;
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
        onFocus={() => { focusLoad(); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 100)}
        onKeyDown={onKeyDown}
      />
      {open && suggestions.length > 0 && (
        <div
          onMouseDown={(e) => { if (e.target === e.currentTarget) e.preventDefault(); }}
          className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {suggestions.map((s, i) => (
            <button
              type="button"
              key={s}
              onMouseDown={(e) => { e.preventDefault(); select(s); }}
              onMouseEnter={() => setActive(i)}
              className={`flex w-full items-center rounded-sm px-2 py-1.5 text-sm text-left ${i === active ? 'bg-accent text-accent-foreground' : ''}`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
