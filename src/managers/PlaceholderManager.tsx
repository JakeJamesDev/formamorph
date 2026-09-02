import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ChevronDown, ChevronsDownUp, ChevronsUpDown, Dices, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { useEditingDraft } from '@/lib/useEditingDraft';
import { randomUUID } from '@/lib/uuid';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { KeywordChips } from '@/components/KeywordChips';
import { HintInfo } from '@/components/SettingsRows';
import PlaceholderField from '@/components/prompt/PlaceholderField';
import { usePlaceholderStore } from '@/contexts/PlaceholderStoreContext';
import { Chip } from '@/components/Chip';
import {
  placeholderWeight, placeholderChances, placeholderValueLine, parsePlaceholderText,
  reconcilePlaceholderValues, prunePlaceholderWeights, pruneSharedWeights, mergePlaceholderWeights,
  lonePlaceholderToken, drawPlaceholderSpans, placeholderIsChoice, placeholderRandomizes, type PlaceholderSpan,
} from '@/lib/placeholders';
import { placeholderRowChance, qualifiedPlaceholderName } from '@/lib/placeholderTree';
import { accentAtChance, chanceChipStyle, relativeChance } from '@/lib/chanceColor';
import { placeholderAccent, usePlaceholderChipVocabulary } from '@/lib/chipVocabulary';
import { TINT_MARK_CLASS, tintMarkStyle } from '@/lib/previewTint';
import { cn } from '@/lib/utils';
import type { Placeholder, PlaceholderValue } from '@/types';
import { Tip } from '@/components/ui/tooltip';

/** Which of the two value-editing styles a placeholder is being edited in. Session-only — nothing about it
 *  is stored, so a placeholder is re-read on every open rather than remembered. */
type ValueStyle = 'chips' | 'multiline';

/** What a placeholder is, as the selector states it. Stored as `roll`. */
type PlaceholderKind = 'wildcard' | 'object';

// The brief line under the selector decides; this defines. Kept out of the state line so a Wildcard's own
// row reads as one short sentence.
const KIND_INFO = `**Wildcard** randomizes — one of its values is picked, and every chip of it shows that pick.

**Object** holds — all of its values apply, joined together wherever it is placed.

- With one value the two coincide: it is a **Variable**, and always resolves to that value.
- A Variable whose one value holds Wildcard chips is a template: it rolls those chips, and picks World or Unique like a Wildcard.
- A chip that can roll chooses **World** (one pick shared everywhere) or **Unique** (its own).
- A value that is exactly one chip nests that placeholder under this one, addressable as \`Owner › Name\`.`;

/** One multiline box: its text as typed, under an id of its own so a box survives being emptied, renamed,
 *  or collapsed — none of which the value string it holds could key. */
interface ValueBox {
  id: string;
  text: string;
}

const toBoxes = (values: readonly PlaceholderValue[]): ValueBox[] =>
  values.map(({ text }) => ({ id: randomUUID(), text }));

/**
 * The value list a set of boxes stands for: outer whitespace trimmed (the internal newlines are the whole
 * point), a box that reads as empty left out, and a repeat of an earlier value collapsed into it. Values
 * stay unique by text, which is the invariant the chip row holds too — it can only draw a list whose
 * entries are distinct.
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

/**
 * Right-panel editor for a placeholder: what kind of thing it is, its name, and its values. The kind
 * selector declares Wildcard or Object explicitly; an untouched placeholder shows the kind its value count
 * already implies, so no shipped world needs migrating. Values are edited either as chips (short values:
 * click one for its draw weight, the eye reveals every chance) or as one markdown box per value
 * (paragraph-length values), and either way they may hold placeholder chips of their own. Writes back
 * through the scoped `PlaceholderStore` (the world's, or the library item's isolated store).
 *
 * The same panel serves a **shared row** — a placeholder held by something that does not own it. There the
 * name, the kind and the values belong to the original and are locked; only the draw weights are the row's
 * own, and they are written as an override on the holder rather than onto the original.
 */
const PlaceholderManager = ({ placeholder, rowId, share }: {
  placeholder: Placeholder;
  /** The tree row this panel opens on — the chain of placeholder ids that reached it. What a nested value's
   *  effective chance is read against; absent, the placeholder reads as top level. */
  rowId?: string;
  /** Where this row's draw weights live, when the row is a shared one — see `sharedWeightSite`. */
  share?: { ownerId: string; key: string };
}) => {
  const { placeholders, updatePlaceholder } = usePlaceholderStore();
  const { draft: editing, apply } = useEditingDraft(placeholder, updatePlaceholder);
  const [openValue, setOpenValue] = useState<string | null>(null);
  const [showChances, setShowChances] = useState(false);
  // One sample draw, shown until the next click or until the values it drew from change. Never stored.
  const [sample, setSample] = useState<PlaceholderSpan[] | null>(null);
  // A value the chip row can't hold decides the style on open; from there it is the author's pick.
  const [style, setStyle] = useState<ValueStyle>(
    () => (placeholder.values.some((v) => v.text.includes('\n')) ? 'multiline' : 'chips'),
  );
  const [boxes, setBoxes] = useState<ValueBox[]>(() => toBoxes(placeholder.values));
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set<string>());
  // The boxes are the editing truth only for the edits they made themselves. Someone else writing this
  // placeholder — the find bar replaces inside values, an import absorbs into them — leaves a list the boxes
  // no longer stand for, and the next keystroke in any box would paste the stale one back over it.
  // Fresh boxes carry fresh ids, so the collapse set no longer names any of them and the re-read list opens
  // expanded — which is what an author whose text just changed under them should be shown.
  useEffect(() => {
    const texts = placeholder.values.map((v) => v.text);
    setBoxes((prev) => (sameValues(boxValues(prev), texts) ? prev : toBoxes(placeholder.values)));
  }, [placeholder.values]);
  const vocab = usePlaceholderChipVocabulary(placeholders, placeholder.id);
  /** One value as a line a plain-text surface can show: a chip in it is named rather than spelled out as
   *  the token behind it, which is what a value list holding chips would otherwise print. */
  const valueLine = (value: string) =>
    placeholderValueLine(
      parsePlaceholderText(value).map((s) => (s.type === 'text' ? s.value : vocab.label(s.token))).join(''),
    );
  // The weight pop-out hangs off whichever chip was clicked, tracked by element rather than by wrapping the
  // open one: a wrapper that appears on click replaces the chip's DOM node mid-gesture, and the second
  // click of a double-click then lands on a different element, so double-click-to-rename never fired.
  const chipEls = useRef(new Map<string, HTMLElement>());
  const anchor = useRef<HTMLElement | null>(null);

  const count = editing.values.length;
  // A shared row whose holder went missing is no row at all, so the panel falls back to the plain editor
  // rather than writing an override into nothing.
  const owner = share ? placeholders.find((p) => p.id === share.ownerId) : undefined;
  const locked = !!share && !!owner;
  const override = locked ? owner.sharedWeights?.[share.key] : undefined;
  // Deny-list: the row's map lies over the original's, so a value neither one names still weighs 1.
  const effective = mergePlaceholderWeights(editing.weights, override);
  const chances = placeholderChances(editing, effective);
  // Both value editors work in text — it is what the author types and what a chip is keyed by — while
  // weights and chances key by the value's id. This is the one crossing between the two.
  const byText = new Map(editing.values.map((v) => [v.text, v]));
  // How likely this row is reached at all — the chance of every value walked to get here. What a nested
  // value's own chance is multiplied by, so a 10% branch inside a 50% branch reads as the 5% it is.
  const rowChance = useMemo(
    () => (rowId ? placeholderRowChance(placeholders, rowId) : 100),
    [placeholders, rowId],
  );
  // A value's chance of being drawn here. An Object applies every value, so each is certain.
  const localChance = (value: string) =>
    (placeholderIsChoice(editing) ? chances[byText.get(value)?.id ?? ''] ?? 0 : 100);
  // A stale sample must never read as saved state: the moment the pool it drew from changes, it goes.
  useEffect(() => setSample(null), [editing.values, editing.weights, override]);
  // An untouched placeholder reads as a Wildcard: that is what 2+ values already do, and what one value
  // does either way. Nothing is written until the author presses the selector.
  const kind: PlaceholderKind = (editing.roll ?? true) ? 'wildcard' : 'object';
  // Only a placeholder that draws has weights worth showing; an Object applies every value.
  const weighable = placeholderIsChoice(editing);
  // A one-value Variable whose value holds wildcard chips still rolls — the chips do — so its chip offers
  // World | Unique like a Wildcard's. Read against the draft, so a chip just typed in flips the line at once.
  const rollingVariable = count === 1 && placeholderRandomizes(
    [editing, ...placeholders.filter((p) => p.id !== editing.id)], editing.id,
  );
  const state =
    count === 0
      ? 'No values yet — this resolves to nothing.'
      : rollingVariable
        ? 'A Variable: its one value is a template. It rolls its chips, and picks World or Unique like a Wildcard.'
        : count === 1
          ? 'A Variable: always resolves to its one value.'
          : kind === 'wildcard'
          ? `Picks one of ${count} values.`
          : `Shows all ${count} values.`;

  // A value keeps its id across a rename, so its weight follows it with nothing to carry. Only the values
  // an edit dropped need clearing out.
  const setValues = (texts: string[]) => {
    const values = reconcilePlaceholderValues(editing.values, texts);
    apply({
      values,
      weights: prunePlaceholderWeights(editing.weights, values),
      // A dropped value takes the shared row it held, and with it the weights that row carried.
      sharedWeights: pruneSharedWeights(editing.sharedWeights, values),
    });
  };

  /** Write the row's own weight for a value, as an override on the holder. A weight matching what the
   *  original already draws by is written as nothing, so the row goes back to following it. */
  const setSharedWeight = (value: PlaceholderValue, weight: number) => {
    if (!locked) return;
    const map = { ...(override ?? {}) };
    if (weight === placeholderWeight(editing, value)) delete map[value.id];
    else map[value.id] = weight;
    const { sharedWeights: held, ...rest } = owner;
    const next = { ...(held ?? {}) };
    if (Object.keys(map).length) next[share.key] = map;
    else delete next[share.key];
    updatePlaceholder({ ...rest, ...(Object.keys(next).length ? { sharedWeights: next } : {}) });
  };

  const setWeight = (value: string, weight: number) => {
    const v = byText.get(value);
    if (!v) return;
    if (locked) return setSharedWeight(v, weight);
    const weights = { ...(editing.weights ?? {}) };
    if (weight === 1) delete weights[v.id];
    else weights[v.id] = weight;
    apply({ weights: Object.keys(weights).length ? weights : undefined });
  };

  const weightOf = (value: string) => {
    const v = byText.get(value);
    return v ? placeholderWeight(editing, v, effective) : 1;
  };
  const pct = (v: string) => `${Math.round(chances[byText.get(v)?.id ?? ''] ?? 0)}%`;

  /** The accent of a value that is exactly one chip of a placeholder that still exists — what makes it a
   *  reference chip. A chip of a deleted placeholder reads as plain text, number and color alike. */
  const referenceAccent = (value: string) => {
    const lone = lonePlaceholderToken(value);
    return lone ? vocab.color(lone) : undefined;
  };
  /** The chance a chip carries: a reference chip shows how likely its whole branch is — its own chance
   *  under this row's — and a plain value its own, so the number and the color read the same figure. */
  const chipChance = (value: string) =>
    (referenceAccent(value) ? (localChance(value) * rowChance) / 100 : localChance(value));
  const chipPct = (v: string) => `${Math.round(chipChance(v))}%`;

  /** How a value chip wears its chance: relative to the strongest sibling, so color says which value is
   *  favored while the number says how likely. Local chances suffice — the row factor is common to every
   *  sibling, so it cancels out. A plain value fades toward the benched look; a reference chip keeps its
   *  placeholder's accent and loses saturation. */
  const localChances = editing.values.map((v) => localChance(v.text));
  const chipStyle = (value: string): CSSProperties => {
    const rel = relativeChance(localChance(value), localChances);
    const accent = referenceAccent(value);
    return accent ? accentAtChance(accent, rel) : chanceChipStyle(rel);
  };

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

  /** The draw-weight pop-out, shared by the chip row and a shared row's read-only list — one anchor, one
   *  set of copy, whichever list is drawn. */
  const weightPopover = (
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
          <p className="truncate text-label font-medium">{valueLine(openValue)}</p>
          <Label className="text-meta text-muted-foreground">Draw Weight</Label>
          <Input
            type="number"
            min={0}
            step={1}
            autoFocus
            aria-label="Draw weight"
            value={weightOf(openValue)}
            onChange={(e) => setWeight(openValue, Math.max(0, Math.round(Number(e.target.value) || 0)))}
          />
          <p className="text-meta text-muted-foreground">
            {(chances[byText.get(openValue)?.id ?? ''] ?? 0) === 0
              ? 'Benched — never rolled, but kept in the list.'
              : `Rolls ${pct(openValue)} of the time. Weights are relative: 2 is twice as likely as 1.`}
          </p>
        </>
      )}
    </PopoverContent>
  );

  return (
    <div className="space-y-4">
      {locked && (
        <p className="rounded-md border border-dashed px-2 py-1.5 text-helper text-muted-foreground">
          Shared row. The name, the kind and the values come from the original.{' '}
          {kind === 'object'
            ? 'An Object applies every value and never draws, so there is nothing to weigh here.'
            : 'The draw weights are this row’s own — benching a value here changes nothing anywhere else.'}
        </p>
      )}
      <div className="space-y-2">
        <Label>Name</Label>
        <Input
          value={editing.name}
          onChange={(e) => apply({ name: e.target.value })}
          disabled={locked}
          placeholder="e.g. Eye Color"
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label>Kind</Label>
          <HintInfo>{KIND_INFO}</HintInfo>
        </div>
        <ToggleGroup
          type="single"
          value={kind}
          disabled={locked}
          // Clicking the item already on clears a single ToggleGroup's value. A placeholder is always one
          // kind or the other, so an empty result is ignored rather than written back.
          onValueChange={(v) => {
            if (!v) return;
            apply({ roll: v === 'wildcard' });
            // An Object has no eye to turn the numbers back off and no chip to close the pop-out from.
            if (v === 'object') { setOpenValue(null); setShowChances(false); }
          }}
          aria-label="Placeholder kind"
          className="h-8"
        >
          <ToggleGroupItem value="wildcard" className="h-6 px-2 text-helper">Wildcard</ToggleGroupItem>
          <ToggleGroupItem value="object" className="h-6 px-2 text-helper">Object</ToggleGroupItem>
        </ToggleGroup>
        <p className="text-helper text-muted-foreground">{state}</p>
      </div>
      {/* One sample of what this placeholder produces, nested chips and all, without placing it anywhere.
          Only where there is something to draw from — an empty placeholder would sample nothing. */}
      {count > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Tip tip="Roll a sample of this placeholder" labelsChild={false}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-helper"
                onClick={() => setSample(drawPlaceholderSpans(editing, placeholders, effective))}
              >
                <Dices className="mr-1 h-3.5 w-3.5" aria-hidden />
                Roll
              </Button>
            </Tip>
            {sample !== null && (
              <p
                role="status"
                aria-label="Sample roll"
                className="min-w-0 flex-1 whitespace-pre-wrap break-words rounded-md border bg-muted/30 px-2 py-1 text-label"
              >
                {/* Each direct chip's run reads in its placeholder's tint, the same mark the Preview pane
                    paints, so the field says which placeholder produced which words. */}
                {sample.length
                  ? sample.map((span, i) =>
                    span.placeholderId ? (
                      <Tip key={i} tip={qualifiedPlaceholderName(placeholders, span.placeholderId, editing.id)} labelsChild={false}>
                        <mark className={TINT_MARK_CLASS} style={tintMarkStyle(placeholderAccent(span.placeholderId))}>
                          {span.text}
                        </mark>
                      </Tip>
                    ) : (
                      <span key={i}>{span.text}</span>
                    ))
                  : <span className="text-muted-foreground">(nothing)</span>}
              </p>
            )}
          </div>
        </div>
      )}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label>Values</Label>
          {/* Chips carry their chance in color always; the eye adds the number. Chips only: the multiline
              boxes carry a chance apiece, so there is nothing left to reveal. */}
          {style === 'chips' && weighable && (
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
            {!locked && style === 'multiline' && boxes.length > 1 && (
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
            {/* A shared row edits no text, so the two text editors have nothing to choose between. */}
            {!locked && (
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
            )}
          </div>
        </div>
        {locked ? (
        <Popover open={openValue !== null} onOpenChange={(o) => !o && setOpenValue(null)}>
          <PopoverAnchor virtualRef={anchor} />
          <SharedValues
            values={editing.values}
            line={valueLine}
            style={chipStyle}
            suffix={showChances ? (v) => `(${chipPct(v)})` : undefined}
            register={(v, el) => { if (el) chipEls.current.set(v, el); else chipEls.current.delete(v); }}
            onOpen={weighable ? (v) => {
              anchor.current = chipEls.current.get(v) ?? null;
              setOpenValue((prev) => (prev === v ? null : v));
            } : undefined}
          />
          {weightPopover}
        </Popover>
        ) : style === 'multiline' ? (
          <MultilineValues
            boxes={boxes}
            collapsed={collapsed}
            placeholders={placeholders}
            ownerId={placeholder.id}
            line={valueLine}
            weight={weighable ? weightOf : undefined}
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
            keywords={editing.values.map((v) => v.text)}
            onChange={setValues}
            placeholders={placeholders}
            ownerId={placeholder.id}
            // A value that is only a chip is a part of this placeholder, so it reads as the part it names
            // rather than as what that part will become.
            lonePlaceholderAsPath
            placeholder="e.g. Red — press Enter for each"
            // Toggles, like the placeholder chips' own pop-out: without this, clicking the open chip
            // re-opened it and the only way out was clicking somewhere else entirely.
            onChipClick={weighable ? (v) => {
              anchor.current = chipEls.current.get(v) ?? null;
              setOpenValue((prev) => (prev === v ? null : v));
            } : undefined}
            chipSuffix={showChances ? (v) => `(${chipPct(v)})` : undefined}
            chipStyle={chipStyle}
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
          {weightPopover}
        </Popover>
        )}
      </div>
    </div>
  );
};

/**
 * A shared row's value list: the same chips, with nothing to type into and nothing to remove — the values
 * belong to the original. A click still opens the draw-weight pop-out, which is the one thing this row owns;
 * an Object never draws, so it gets plain chips instead.
 */
const SharedValues = ({ values, line, style, suffix, register, onOpen }: {
  values: readonly PlaceholderValue[];
  line: (value: string) => string;
  /** Each chip's colors — its draw chance, worn the way the editable row wears it. */
  style: (value: string) => CSSProperties;
  suffix?: (value: string) => string | undefined;
  /** Reports each chip's element, so the pop-out can hang off the one that was clicked. */
  register: (value: string, el: HTMLElement | null) => void;
  /** Omitted where there is no weight to set — an Object, or a list too short to weigh. */
  onOpen?: (value: string) => void;
}) => (
  <div className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-background/80 p-2">
    {values.length === 0 && <span className="text-helper text-muted-foreground">No values.</span>}
    {values.map((v) => {
      const label = line(v.text);
      const chip = (
        <Chip
          label={suffix?.(v.text) ? <>{label} {suffix(v.text)}</> : label}
          removeLabel={label}
          style={style(v.text)}
          tip={onOpen ? 'Click to set this row’s draw weight' : 'From the original'}
        />
      );
      return onOpen ? (
        <button
          key={v.id}
          type="button"
          ref={(el) => register(v.text, el)}
          className="inline-flex"
          aria-label={`Draw weight for ${label}`}
          onClick={() => onOpen(v.text)}
        >
          {chip}
        </button>
      ) : (
        <span key={v.id} className="inline-flex">{chip}</span>
      );
    })}
  </div>
);

/** The multiline style: one bordered card per value, each holding the markdown field the readme uses. A card
 *  collapses to its first line with its weight and remove still live, so a long list stays tunable while
 *  scannable. `weight` is omitted when nothing is drawn — one value, or an Object — and the chance goes
 *  with it. */
const MultilineValues = ({
  boxes, collapsed, placeholders, ownerId, line, weight, chance, onToggleCollapsed, onText, onWeight, onRemove, onAdd,
}: {
  boxes: ValueBox[];
  collapsed: ReadonlySet<string>;
  placeholders: Placeholder[];
  /** The placeholder these boxes are the values of — see `ownerId` on `PlaceholderField`. */
  ownerId: string;
  /** One value as the collapsed card's summary line — see the manager's `valueLine`. */
  line: (value: string) => string;
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
                  {line(value) || 'Empty value'}
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
              <PlaceholderField
                value={box.text}
                onChange={(text) => onText(box.id, text)}
                placeholders={placeholders}
                ownerId={ownerId}
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
