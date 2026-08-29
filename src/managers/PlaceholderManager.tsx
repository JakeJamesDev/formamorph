import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronsDownUp, ChevronsUpDown, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { useEditingDraft } from '@/lib/useEditingDraft';
import { randomUUID } from '@/lib/uuid';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { KeywordChips } from '@/components/KeywordChips';
import PromptField from '@/components/prompt/PromptField';
import { usePlaceholderStore } from '@/contexts/PlaceholderStoreContext';
import { placeholderWeight, placeholderChances, placeholderValueLine, isWeighted } from '@/lib/placeholders';
import { plainVocabulary } from '@/lib/chipVocabulary';
import { cn } from '@/lib/utils';
import type { Placeholder } from '@/types';
import { Tip } from '@/components/ui/tooltip';

/**
 * Carry per-value weights across an edit to the value list. A same-length change is a rename or a reorder
 * (chip edits keep position), so a value with no weight of its own inherits whatever sat in its slot;
 * otherwise weights simply follow their value and dropped values lose theirs.
 */
function remapWeights(
  prev: string[],
  next: string[],
  weights: Record<string, number> | undefined,
): Record<string, number> | undefined {
  if (!weights) return undefined;
  const out: Record<string, number> = {};
  next.forEach((v, i) => {
    const w = weights[v] ?? (prev.length === next.length ? weights[prev[i]] : undefined);
    if (w != null) out[v] = w;
  });
  return Object.keys(out).length ? out : undefined;
}

/** Which of the two value-editing styles a placeholder is being edited in. Session-only — nothing about it
 *  is stored, so a placeholder is re-read on every open rather than remembered. */
type ValueStyle = 'chips' | 'multiline';

/** One multiline box: its text as typed, under an id of its own so a box survives being emptied, renamed,
 *  or collapsed — none of which the value string it holds could key. */
interface ValueBox {
  id: string;
  text: string;
}

const toBoxes = (values: string[]): ValueBox[] => values.map((text) => ({ id: randomUUID(), text }));

/**
 * The value list a set of boxes stands for: outer whitespace trimmed (the internal newlines are the whole
 * point), a box that reads as empty left out, and a repeat of an earlier value collapsed into it. Those are
 * the same exact-string invariants the chip path holds — weights are keyed by value, and the chip row can
 * only draw a list whose entries are distinct.
 */
const boxValues = (boxes: ValueBox[]): string[] => {
  const out: string[] = [];
  for (const { text } of boxes) {
    const v = text.trim();
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
};

const sameValues = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/** Right-panel editor for a placeholder: a name and its values. The behavior is inferred from the value
 *  count — 1 value is a fixed Variable, 2+ is a random Wildcard — surfaced as a live hint. Values are edited
 *  either as chips (short values: click one for its draw weight, the eye reveals every chance) or as one
 *  markdown box per value (paragraph-length values). Writes back through the scoped `PlaceholderStore`
 *  (the world's, or the library item's isolated store). */
const PlaceholderManager = ({ placeholder }: { placeholder: Placeholder }) => {
  const { updatePlaceholder } = usePlaceholderStore();
  const { draft: editing, apply } = useEditingDraft(placeholder, updatePlaceholder);
  const [openValue, setOpenValue] = useState<string | null>(null);
  const [showChances, setShowChances] = useState(false);
  // A value the chip row can't hold decides the style on open; from there it is the author's pick.
  const [style, setStyle] = useState<ValueStyle>(
    () => (placeholder.values.some((v) => v.includes('\n')) ? 'multiline' : 'chips'),
  );
  const [boxes, setBoxes] = useState<ValueBox[]>(() => toBoxes(placeholder.values));
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set<string>());
  // The boxes are the editing truth only for the edits they made themselves. Someone else writing this
  // placeholder — the find bar replaces inside values, an import absorbs into them — leaves a list the boxes
  // no longer stand for, and the next keystroke in any box would paste the stale one back over it.
  // Fresh boxes carry fresh ids, so the collapse set no longer names any of them and the re-read list opens
  // expanded — which is what an author whose text just changed under them should be shown.
  useEffect(() => {
    setBoxes((prev) => (sameValues(boxValues(prev), placeholder.values) ? prev : toBoxes(placeholder.values)));
  }, [placeholder.values]);
  // Placeholder values are literal text — resolution is single-pass, so a chip inside one would never
  // expand. Same reason the chip palette is suppressed for them.
  const plainVocab = useMemo(() => plainVocabulary(), []);
  // The weight pop-out hangs off whichever chip was clicked, tracked by element rather than by wrapping the
  // open one: a wrapper that appears on click replaces the chip's DOM node mid-gesture, and the second
  // click of a double-click then lands on a different element, so double-click-to-rename never fired.
  const chipEls = useRef(new Map<string, HTMLElement>());
  const anchor = useRef<HTMLElement | null>(null);

  const count = editing.values.length;
  const weighted = isWeighted(editing);
  const chances = placeholderChances(editing);
  const hint =
    count === 0
      ? 'No values yet — this resolves to nothing until you add one.'
      : count === 1
        ? 'One value → a Variable: always resolves to this value. Reuse it, edit it here once.'
        : `${count} values → a Wildcard: resolves to a random value. Each chip chooses World (same everywhere) or Unique (its own roll).`;

  const setValues = (values: string[]) =>
    apply({ values, weights: remapWeights(editing.values, values, editing.weights) });

  const setWeight = (value: string, weight: number) => {
    const weights = { ...(editing.weights ?? {}) };
    if (weight === 1) delete weights[value];
    else weights[value] = weight;
    apply({ weights: Object.keys(weights).length ? weights : undefined });
  };

  const pct = (v: string) => `${Math.round(chances[v] ?? 0)}%`;

  /** Every box edit lands here: the boxes are what the author sees, the value list is what they stand for. */
  const writeBoxes = (next: ValueBox[]) => {
    setBoxes(next);
    setValues(boxValues(next));
  };

  const pickStyle = (next: ValueStyle) => {
    // Reseeded rather than kept: the chip row may have added, renamed or reordered values since.
    if (next === 'multiline') {
      setBoxes(toBoxes(editing.values));
      setCollapsed(new Set<string>());
    }
    setStyle(next);
  };

  const toggleCollapsed = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const anyOpen = boxes.some((b) => !collapsed.has(b.id));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Name</Label>
        <Input value={editing.name} onChange={(e) => apply({ name: e.target.value })} placeholder="e.g. Eye Color" />
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label>Values</Label>
          {/* Only offered once a weight is non-default — with a uniform list there is nothing to reveal.
              Chips only: the multiline boxes carry a chance apiece, so there is nothing left to reveal. */}
          {style === 'chips' && weighted && count > 1 && (
            <Tip tip={showChances ? 'Hide roll chances' : 'Show roll chances'}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                aria-pressed={showChances}
                onClick={() => setShowChances((s) => !s)}
              >
                {showChances ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
            </Tip>
          )}
          <div className="ml-auto flex items-center gap-1">
            {style === 'multiline' && boxes.length > 1 && (
              <Tip tip={anyOpen ? 'Collapse all values' : 'Expand all values'}>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setCollapsed(anyOpen ? new Set(boxes.map((b) => b.id)) : new Set<string>())}
                >
                  {anyOpen ? <ChevronsDownUp className="h-3.5 w-3.5" /> : <ChevronsUpDown className="h-3.5 w-3.5" />}
                </Button>
              </Tip>
            )}
            <ToggleGroup
              type="single"
              value={style}
              // A single ToggleGroup clears its value when the active item is clicked again; one of the two
              // styles is always in force, so an empty result is ignored rather than applied.
              onValueChange={(v) => { if (v) pickStyle(v as ValueStyle); }}
              aria-label="Value editor style"
              className="h-8"
            >
              <ToggleGroupItem value="chips" className="h-6 px-2 text-helper">Chips</ToggleGroupItem>
              <ToggleGroupItem value="multiline" className="h-6 px-2 text-helper">Multiline</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
        {style === 'multiline' ? (
          <MultilineValues
            boxes={boxes}
            collapsed={collapsed}
            vocabulary={plainVocab}
            weight={count > 1 ? (v) => placeholderWeight(editing, v) : undefined}
            chance={pct}
            onToggleCollapsed={toggleCollapsed}
            onText={(id, text) => writeBoxes(boxes.map((b) => (b.id === id ? { ...b, text } : b)))}
            onWeight={setWeight}
            onRemove={(id) => writeBoxes(boxes.filter((b) => b.id !== id))}
            onAdd={() => writeBoxes([...boxes, { id: randomUUID(), text: '' }])}
          />
        ) : (
        <Popover open={openValue !== null} onOpenChange={(o) => !o && setOpenValue(null)}>
          <PopoverAnchor virtualRef={anchor} />
          <KeywordChips
            keywords={editing.values}
            onChange={setValues}
            placeholder="e.g. Red — press Enter for each"
            // Toggles, like the placeholder chips' own pop-out: without this, clicking the open chip
            // re-opened it and the only way out was clicking somewhere else entirely.
            onChipClick={count > 1 ? (v) => {
              anchor.current = chipEls.current.get(v) ?? null;
              setOpenValue((prev) => (prev === v ? null : v));
            } : undefined}
            chipSuffix={showChances ? (v) => `(${pct(v)})` : undefined}
            // Every chip gets the same wrapper whether or not it is the open one, so its DOM node survives
            // the click that opens the pop-out.
            renderChip={(chip, v) => (
              <span
                className="inline-flex"
                ref={(el) => { if (el) chipEls.current.set(v, el); else chipEls.current.delete(v); }}
              >
                {chip}
              </span>
            )}
          />
          <PopoverContent
            className="w-60 space-y-2"
            align="start"
            // The open chip closes itself on click. Letting the dismiss fire as well would close it on the
            // press and reopen it on the release, which is why clicking it again appeared to do nothing.
            onPointerDownOutside={(e) => {
              if (openValue !== null && chipEls.current.get(openValue)?.contains(e.target as Node)) e.preventDefault();
            }}
          >
            {openValue !== null && (
              <>
                <p className="truncate text-label font-medium">{placeholderValueLine(openValue)}</p>
                <Label className="text-meta text-muted-foreground">Draw Weight</Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  autoFocus
                  value={placeholderWeight(editing, openValue)}
                  onChange={(e) => setWeight(openValue, Math.max(0, Math.round(Number(e.target.value) || 0)))}
                />
                <p className="text-meta text-muted-foreground">
                  {(chances[openValue] ?? 0) === 0
                    ? 'Benched — never rolled, but kept in the list.'
                    : `Rolls ${pct(openValue)} of the time. Weights are relative: 2 is twice as likely as 1.`}
                </p>
              </>
            )}
          </PopoverContent>
        </Popover>
        )}
        <p className="text-helper text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
};

/** The multiline style: one bordered card per value, each holding the markdown field the readme uses. A card
 *  collapses to its first line with its weight and remove still live, so a long list stays tunable while
 *  scannable. `weight` is omitted below two values — there is nothing to weigh against. */
const MultilineValues = ({
  boxes, collapsed, vocabulary, weight, chance, onToggleCollapsed, onText, onWeight, onRemove, onAdd,
}: {
  boxes: ValueBox[];
  collapsed: ReadonlySet<string>;
  vocabulary: ReturnType<typeof plainVocabulary>;
  weight?: (value: string) => number;
  chance: (value: string) => string;
  onToggleCollapsed: (id: string) => void;
  onText: (id: string, text: string) => void;
  onWeight: (value: string, weight: number) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
}) => (
  <div className="space-y-3">
    {boxes.map((box, i) => {
      const open = !collapsed.has(box.id);
      // What this box currently stands for in the value list — the key its weight and chance are read by.
      // A box the author has emptied stands for nothing, so it carries no odds either.
      const value = box.text.trim();
      return (
        <div key={box.id} className="rounded-md border bg-card">
          <div className={cn('flex items-center gap-2 px-2 py-1.5', open && 'border-b')}>
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
              aria-expanded={open}
              aria-label={`${open ? 'Collapse' : 'Expand'} value ${i + 1}`}
              onClick={() => onToggleCollapsed(box.id)}
            >
              <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', !open && '-rotate-90')} />
              <span className="shrink-0 text-helper font-medium text-muted-foreground">Value {i + 1}</span>
              {!open && (
                <span className="min-w-0 truncate text-helper text-muted-foreground/70">
                  {placeholderValueLine(value) || 'Empty value'}
                </span>
              )}
            </button>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              {weight && value && (
                <>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={weight(value)}
                    onChange={(e) => onWeight(value, Math.max(0, Math.round(Number(e.target.value) || 0)))}
                    className="h-6 w-14 px-1.5 text-helper"
                    aria-label={`Draw weight for value ${i + 1}`}
                    title="Draw weight"
                  />
                  <span className="w-10 text-right text-meta text-muted-foreground">{chance(value)}</span>
                </>
              )}
              <Tip tip="Remove value" labelsChild={false}>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  aria-label={`Remove value ${i + 1}`}
                  onClick={() => onRemove(box.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </Tip>
            </div>
          </div>
          {open && (
            <div className="p-2">
              <PromptField
                value={box.text}
                onChange={(text) => onText(box.id, text)}
                vocabulary={vocabulary}
                markdown
                ariaLabel={`Value ${i + 1}`}
                placeholder="Value text — markdown supported"
              />
            </div>
          )}
        </div>
      );
    })}
    <Button type="button" variant="outline" size="sm" className="w-full" onClick={onAdd}>
      <Plus className="mr-1 h-3.5 w-3.5" /> Add Value
    </Button>
  </div>
);

export default PlaceholderManager;
