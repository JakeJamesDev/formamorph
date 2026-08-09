# EditorRow — one chrome for every World Editor list row

## Problem

Four hand-rolled row components draw the same chrome and have drifted:

| Row | File | Drift |
|---|---|---|
| `SortableRow` | `src/components/SortableList.tsx` | no `gap-1` (fixed in working tree), no label truncation, no `shrink-0` guards |
| `TreeRow` | `src/managers/SortableTree.tsx` | no truncation, no `shrink-0` on buttons |
| `EntryRow` | `src/managers/DictionaryTree.tsx` | most complete — truncation + `shrink-0` everywhere |
| `BookRow` | `src/managers/DictionaryTree.tsx` | complete, but different actions + a count badge |

Every future chrome decision (spacing, hit size, truncation, selected colors) currently has to be made four times.

## Shape

One **presentational** component. It draws; it does not drag. Each caller keeps its own
`useSortable` hook and DnD context — the modifiers and collision logic in `SortableTree`
and `DictionaryTree` are load-bearing and do not move.

New file: `src/components/EditorRow.tsx`.

```tsx
interface EditorRowAction {
  icon: ReactNode;          // e.g. <Copy className="h-4 w-4" />
  title: string;            // tooltip + accessible name
  onClick: () => void;      // row already stops propagation
}

interface EditorRowProps {
  // -- sortable plumbing, passed straight from the caller's useSortable --
  setNodeRef: (el: HTMLElement | null) => void;
  style: CSSProperties;             // caller computes transform/transition/opacity/paddingLeft
  gripProps: HTMLAttributes<HTMLElement>;  // {...attributes, ...listeners}
  gripTitle: string;                // each surface words its drag hint differently

  // -- selection --
  selected: boolean;
  onSelect: () => void;

  // -- slots, leading to trailing --
  lead?: 'chevron' | 'spacer';      // chevron needs the collapse trio below; omit = no slot
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  collapseLabels?: [string, string]; // aria [expand, collapse]
  checkbox?: { checked: boolean; onChange: (v: boolean) => void };  // enabled toggle
  icon?: ReactNode;                 // e.g. folder glyph on group rows
  label: ReactNode;
  labelClass?: string;              // 'font-medium' on group/book headers
  meta?: ReactNode;                 // BookRow's entry count
  actions: EditorRowAction[];

  className?: string;               // BookRow's rounded-t-md override, faded state
}
```

### Chrome EditorRow owns (the point of the exercise)

- Container: `p-2 cursor-pointer rounded-md transition-colors flex items-center gap-1`
  plus `selected ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'`.
  Click = `stopPropagation` + `onSelect`.
- Grip: `shrink-0 cursor-grab touch-none px-1`, muted/primary-foreground by selection,
  `GripVertical h-4 w-4`, click stops propagation.
- Chevron: bare `<button>` with `shrink-0`, `ChevronRight/ChevronDown h-4 w-4`;
  `spacer` renders `<span className="w-4 shrink-0" aria-hidden />`.
- Checkbox: `mx-1 shrink-0`, propagation stopped, enable/disable titles.
- Label: `min-w-0 flex-grow truncate` — **truncation becomes universal** (today only the
  Dictionary rows have it; long names currently squash the buttons on other tabs).
- Meta: `shrink-0 text-meta`, selection-aware muting.
- Actions: ghost `size="icon"` Buttons, `shrink-0`, selection-aware color, propagation stopped.

### What stays with the callers

- All `useSortable` / `useDroppable` wiring, transforms, and the drag-modifier comments.
- Faded/disabled opacity (it rides the caller's `style` or `className` today; keep it there).
- `SortableTree`'s depth `paddingLeft` (comes in via `style`).
- `DictionaryTree`'s zones, droppables, and Simple-mode flattening — untouched.

## Migration (4 call sites)

1. **`SortableRow`** → wrapper: actions = duplicate/delete, no lead, optional checkbox.
   Its public props don't change, so `WorldEditor.renderItemList` and `PlaceholderList`
   are untouched.
2. **`TreeRow`** → wrapper: maps `TreeRowSpec` onto slots (`lead`, `icon`, `labelClass`,
   duplicate/delete). `TreeRowSpec` and the adapter interface stay as-is — Entity/Location/
   Trait trees never know.
3. **`EntryRow`** → wrapper: checkbox gated on `advanced`, duplicate/delete.
4. **`BookRow`** → wrapper: lead chevron, checkbox, `meta` count, actions =
   add-entry/delete, `className="rounded-t-md"` + faded override. Zones render below,
   outside EditorRow.

## Intentional changes (everything else renders identically)

- Label truncation on all tabs, not just Dictionary.
- `shrink-0` on every grip/button, so a long name can never crush the actions.
- `SortableRow` picks up `gap-1` (already in the working tree).

## Done bar

- Four gates green.
- Drag re-verified per surface in the preview: flat reorder (Stats), tree nest via
  horizontal drag (Traits — the depth-nesting trap), cross-book entry drag (Dictionary).
- Visual: DOM-measure one row per surface before/after — identical box metrics except the
  intentional changes above.
- A component test for EditorRow's slots (checkbox propagation stopped, actions fire,
  chevron toggles) — mutation-checked.
