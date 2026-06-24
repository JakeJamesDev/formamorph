import { useMemo, useState } from "react";
import { X } from "lucide-react";

/**
 * Chip input with autocomplete. Type to filter `options` (closest match), Enter or click a
 * suggestion to add a chip; free text not in `options` is allowed. Chips have only an X (no
 * reordering). Suggestions are added on mousedown so the click registers before the input blurs.
 */
export function TokenAutocomplete({ values, onChange, options, placeholder }: {
  values: string[];
  onChange: (values: string[]) => void;
  options: string[];
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const suggestions = useMemo(() => {
    const q = text.trim().toLowerCase();
    if (!q) return [];
    const selected = new Set(values.map((v) => v.toLowerCase()));
    return options
      .filter((o) => !selected.has(o.toLowerCase()) && o.toLowerCase().includes(q))
      .sort((a, b) => {
        const aw = a.toLowerCase().startsWith(q) ? 0 : 1;
        const bw = b.toLowerCase().startsWith(q) ? 0 : 1;
        return aw - bw || a.localeCompare(b);
      })
      .slice(0, 8);
  }, [text, options, values]);

  const add = (val: string) => {
    const v = val.trim();
    if (!v) return;
    if (!values.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...values, v]);
    setText("");
    setActive(0);
    setOpen(false);
  };
  const remove = (val: string) => onChange(values.filter((x) => x !== val));

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      add(open && suggestions[active] ? suggestions[active] : text);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Backspace" && !text && values.length) {
      remove(values[values.length - 1]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-1 rounded-md border border-input bg-background px-2 py-1 min-w-[180px]">
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">
            {v}
            <button type="button" onClick={() => remove(v)} className="hover:text-destructive" aria-label={`Remove ${v}`}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={text}
          onChange={(e) => { setText(e.target.value); setOpen(true); setActive(0); }}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 100)}
          placeholder={values.length ? "" : placeholder}
          className="flex-1 min-w-[80px] bg-transparent outline-none text-xs py-0.5"
        />
      </div>
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full min-w-[180px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          {suggestions.map((s, i) => (
            <button
              type="button"
              key={s}
              onMouseDown={(e) => { e.preventDefault(); add(s); }}
              onMouseEnter={() => setActive(i)}
              className={`flex w-full items-center rounded-sm px-2 py-1.5 text-sm text-left ${i === active ? "bg-accent text-accent-foreground" : ""}`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
