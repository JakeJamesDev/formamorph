import { useMemo, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { Chip, SortableChip, splitChipInput } from "./Chip";

const SUGGESTION_LIMIT = 50;

/**
 * Chip input with autocomplete. Type to filter `options` (closest match); Enter or a clicked
 * suggestion adds a chip, and a comma (typed or pasted) adds the segment(s) before it. Free text not
 * in `options` is allowed. Suggestions are added on mousedown so the click registers before blur.
 * - `openOnFocus`: show all available options the moment the field is focused (before typing).
 * - `reorderable`: chips can be dragged to reorder (the X still removes; click vs. drag is distance-gated).
 */
export function TokenAutocomplete({ values, onChange, options, placeholder, openOnFocus = false, reorderable = false }: {
  values: string[];
  onChange: (values: string[]) => void;
  options: string[];
  placeholder?: string;
  openOnFocus?: boolean;
  reorderable?: boolean;
}) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const suggestions = useMemo(() => {
    const q = text.trim().toLowerCase();
    const selected = new Set(values.map((v) => v.toLowerCase()));
    const available = options.filter((o) => !selected.has(o.toLowerCase()));
    if (!q) {
      // Empty field: only surface options when opening on focus is requested.
      return openOnFocus ? available.slice().sort((a, b) => a.localeCompare(b)).slice(0, SUGGESTION_LIMIT) : [];
    }
    return available
      .filter((o) => o.toLowerCase().includes(q))
      .sort((a, b) => {
        const aw = a.toLowerCase().startsWith(q) ? 0 : 1;
        const bw = b.toLowerCase().startsWith(q) ? 0 : 1;
        return aw - bw || a.localeCompare(b);
      })
      .slice(0, openOnFocus ? SUGGESTION_LIMIT : 8);
  }, [text, options, values, openOnFocus]);

  /** Append values that aren't already present (case-insensitive); returns whether anything changed. */
  const addMany = (toAdd: string[]) => {
    const next = [...values];
    for (const raw of toAdd) {
      const v = raw.trim();
      if (v && !next.some((x) => x.toLowerCase() === v.toLowerCase())) next.push(v);
    }
    if (next.length !== values.length) onChange(next);
  };

  const add = (val: string) => {
    addMany([val]);
    setText("");
    setActive(0);
    setOpen(false);
  };
  const remove = (val: string) => onChange(values.filter((x) => x !== val));

  // Split commas out of typed/pasted input: complete segments become chips, the remainder stays typed.
  const handleInput = (raw: string) => {
    const { complete, remainder } = splitChipInput(raw);
    if (complete.length) addMany(complete);
    setText(remainder);
    setOpen(true);
    setActive(0);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active: a, over } = e;
    if (!over || a.id === over.id) return;
    const oldIndex = values.indexOf(a.id as string);
    const newIndex = values.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    onChange(arrayMove(values, oldIndex, newIndex));
  };

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
        {reorderable ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={values} strategy={rectSortingStrategy}>
              {values.map((v) => <SortableChip key={v} id={v} onRemove={remove} />)}
            </SortableContext>
          </DndContext>
        ) : values.map((v) => <Chip key={v} label={v} onRemove={remove} />)}
        <input
          value={text}
          onChange={(e) => handleInput(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 100)}
          placeholder={values.length ? "" : placeholder}
          className="flex-1 min-w-[80px] bg-transparent outline-none text-xs py-0.5"
        />
      </div>
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full min-w-[180px] max-h-56 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
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
