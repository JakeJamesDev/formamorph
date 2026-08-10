import { useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useEditingDraft } from '@/lib/useEditingDraft';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { KeywordChips } from '@/components/KeywordChips';
import { usePlaceholderStore } from '@/contexts/PlaceholderStoreContext';
import { placeholderWeight, placeholderChances, isWeighted } from '@/lib/placeholders';
import type { Placeholder } from '@/types';

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

/** Right-panel editor for a placeholder: a name and its values. The behavior is inferred from the value
 *  count — 1 value is a fixed Variable, 2+ is a random Wildcard — surfaced as a live hint. Clicking a value
 *  opens its draw weight; the eye reveals every value's resulting chance. Writes back through the scoped
 *  `PlaceholderStore` (the world's, or the library item's isolated store). */
const PlaceholderManager = ({ placeholder }: { placeholder: Placeholder }) => {
  const { updatePlaceholder } = usePlaceholderStore();
  const { draft: editing, apply } = useEditingDraft(placeholder, updatePlaceholder);
  const [openValue, setOpenValue] = useState<string | null>(null);
  const [showChances, setShowChances] = useState(false);
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

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Name</Label>
        <Input value={editing.name} onChange={(e) => apply({ name: e.target.value })} placeholder="e.g. Eye Color" />
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label>Values</Label>
          {/* Only offered once a weight is non-default — with a uniform list there is nothing to reveal. */}
          {weighted && count > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              aria-pressed={showChances}
              aria-label={showChances ? 'Hide roll chances' : 'Show roll chances'}
              title={showChances ? 'Hide roll chances' : 'Show roll chances'}
              onClick={() => setShowChances((s) => !s)}
            >
              {showChances ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </Button>
          )}
        </div>
        <Popover open={openValue !== null} onOpenChange={(o) => !o && setOpenValue(null)}>
          <PopoverAnchor virtualRef={anchor} />
          <KeywordChips
            keywords={editing.values}
            onChange={setValues}
            placeholder="e.g. Red — press Enter for each"
            onChipClick={count > 1 ? (v) => { anchor.current = chipEls.current.get(v) ?? null; setOpenValue(v); } : undefined}
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
          <PopoverContent className="w-60 space-y-2" align="start">
            {openValue !== null && (
              <>
                <p className="truncate text-label font-medium">{openValue}</p>
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
        <p className="text-helper text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
};

export default PlaceholderManager;
