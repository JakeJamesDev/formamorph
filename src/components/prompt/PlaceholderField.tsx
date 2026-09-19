import { useCallback, useMemo, useRef, type ReactNode } from 'react';
import PromptField from './PromptField';
import ChipInput from './ChipInput';
import { usePlaceholderChipVocabulary } from '@/lib/chipVocabulary';
import { decodePlaceholderToken, directChipTargets } from '@/lib/placeholders';
import { hasUserMacro } from '@/lib/userMacro';
import {
  allPinRows, canCommitPinSource, commitPinSource, pinsTargeting, sameSource, updatePinAt,
  type PinEditorWorld, type PinSourceRef, type PinWriters,
} from '@/lib/placeholderPins';
import { isPinStop, openStopIndex, placeholderStops, type PinStop, type PlaceholderStop } from '@/lib/placeholderStops';
import { useEditorPreviewRolls } from '@/contexts/EditorPreviewRollsContext';
import { useGameDataOptional } from '@/contexts/GameDataContext';
import { usePlaceholderStoreOptional } from '@/contexts/PlaceholderStoreContext';
import type { Placeholder } from '@/types';
import { PLACEHOLDER_TRIGGER, placeholderHint } from '@/lib/placeholderInsert';
import type { OpenValueView, StepDirection } from './openValueContext';

/** The header's verbose name for a stop: its place among the values, or the source that pins it. */
const stopLabel = (stop: PlaceholderStop): string =>
  (isPinStop(stop) ? `Pinned by ${stop.row.label}` : `Value ${stop.index + 1}`);

/** The stop `direction` steps to from `index`, wrapping. */
const stepIndex = (index: number, direction: StepDirection, count: number): number =>
  (index + direction + count) % count;

/**
 * A chip editor for world text that can embed placeholders. Reuses the prompt chip editor with the
 * placeholder token family: the toolbar inserts the world's placeholders, and a Wildcard chip's pop-out
 * offers World | Unique (only once it has 2+ values). Stores the same token-string as the rest of the field.
 *
 * A Preview tab (from `PromptField`) swaps each chip for its author-time value — Variable → its value,
 * Wildcard → a pick (World shared per placeholder, Unique per placement) — read from the editor's shared
 * preview rolls, so every field shows the same value until the toolbar's Reroll draws again. The resolved
 * text is tinted the chip's own color, like the prompt previews. A Values tab opens each chip in place on
 * the value its Preview drew.
 */
const PlaceholderField = ({ value, onChange, placeholders, ownerId, markdown = false, resizable = false, placeholder, className, readOnly = false, label, labelAside, hint, ariaLabel }: {
  value: string;
  onChange: (v: string) => void;
  placeholders: Placeholder[];
  /** Whose field this is. For a placeholder's own value list: a placeholder created from here is born
   *  owned by it, its owned rows read bare, and the palette leaves out anything that would loop back to it.
   *  For an entity's or book's field: its scoped placeholders read bare and come first, and one created
   *  from here lands in its list. */
  ownerId?: string;
  /** The field's caption, rendered by the field itself so it can share a row (see `PromptField`). */
  label?: ReactNode;
  /** Rendered at the end of the caption's row. Needs `label`. */
  labelAside?: ReactNode;
  /** One line under the caption, above the editor (see `PromptField`). */
  hint?: ReactNode;
  /** Prose field: adds a markdown toolbar and renders the Preview as markdown (see `PromptField`). */
  markdown?: boolean;
  /** Let the author drag the field taller/shorter (see `PromptField`). */
  resizable?: boolean;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
  /** Names the editor for assistive tech, for a field whose caption is not its own `label`. */
  ariaLabel?: string;
}) => {
  const vocab = usePlaceholderChipVocabulary(placeholders, ownerId, { playerName: true });
  const rolls = useEditorPreviewRolls();
  // The world's pins, which the chevrons step onto and a stepped-to stop may name. Without a world bound
  // (a library item) the only pins are the ones this field's own placeholders' values carry.
  const game = useGameDataOptional();
  const pinRows = useMemo(
    () => allPinRows({ traits: game?.traits, locations: game?.locations, stats: game?.stats, placeholders }),
    [game?.traits, game?.locations, game?.stats, placeholders],
  );
  // Re-read on every reroll: the store's identity carries its version.
  const previewValues = useMemo(() => rolls.preview(value, placeholders, pinRows), [rolls, value, placeholders, pinRows]);
  // A value edit goes through the same store a chip rename does, and a pin edit through the writer its source
  // kind uses on the pin editors. Writes made since the world last rendered build on each other, so two in
  // one tick never drop the first.
  const store = usePlaceholderStoreOptional();
  const writers: PinWriters = useMemo(() => ({
    updateTrait: game?.updateTrait,
    updateLocation: game?.updateLocation,
    updateStat: game?.updateStat,
    updatePlaceholder: store?.updatePlaceholder,
  }), [game?.updateTrait, game?.updateLocation, game?.updateStat, store?.updatePlaceholder]);
  const writersRef = useRef(writers);
  writersRef.current = writers;
  // The world as this field last wrote it, until a render brings the lists it was built from up to date.
  const pending = useRef<{ from: readonly unknown[]; world: PinEditorWorld } | null>(null);
  const rendered = useRef<PinEditorWorld>({ placeholders: [] });
  rendered.current = { traits: game?.traits, locations: game?.locations, stats: game?.stats, placeholders: store?.placeholders ?? [] };
  const listsOf = (world: PinEditorWorld) => [world.traits, world.locations, world.stats, world.placeholders];
  const renderedLists = listsOf(rendered.current);
  if (pending.current?.from.some((list, i) => list !== renderedLists[i])) pending.current = null;
  const commit = useCallback((next: PinEditorWorld, source: PinSourceRef) => {
    pending.current = { from: listsOf(rendered.current), world: next };
    commitPinSource(next, source, writersRef.current);
  }, []);
  const writeValue = useCallback((placeholderId: string, valueId: string, text: string) => {
    const world = pending.current?.world ?? rendered.current;
    const ph = world.placeholders.find((p) => p.id === placeholderId);
    if (!ph) return;
    const updated = { ...ph, values: ph.values.map((v) => (v.id === valueId ? { ...v, text } : v)) };
    const next = { ...world, placeholders: world.placeholders.map((p) => (p.id === placeholderId ? updated : p)) };
    commit(next, { kind: 'value', placeholderId, valueId });
  }, [commit]);
  // The pin is read again at its place on its source, so a second keystroke finds the text the first wrote.
  const writePin = useCallback((targetId: string, stop: PinStop, text: string) => {
    const world = pending.current?.world ?? rendered.current;
    const row = pinsTargeting(world, targetId).filter((r) => sameSource(r.source, stop.row.source))[stop.place];
    if (!row) return;
    const next = updatePinAt(world, row.source, row.pin, { ...row.pin, value: text });
    if (next !== world) commit(next, row.source);
  }, [commit]);
  const openValues = useMemo(() => {
    const byId = new Map(placeholders.map((p) => [p.id, p]));
    const out: Record<string, OpenValueView> = {};
    for (const [token, open] of Object.entries(rolls.open(value, placeholders, pinRows))) {
      const ph = byId.get(open.placeholderId);
      const placement = decodePlaceholderToken(token);
      if (!ph || !placement) continue;
      // A World drill target steps under its own id; a Unique one under a chain key no placement names.
      const stepsUnder = placement.path?.length
        ? placement.mode === 'world' ? { ...placement, id: ph.id } : null
        : placement;
      const stops = placeholderStops(ph, pinRows);
      const { index, drawPinned } = openStopIndex(stops, open, stepsUnder ? rolls.chosenStop(stepsUnder) : undefined);
      const stop = stops[index];
      if (!stop) {
        out[token] = { text: open.text, label: '', mark: 'No Values' };
        continue;
      }
      const pin = isPinStop(stop);
      const writable = !readOnly && (pin ? canCommitPinSource(stop.row.source, writers) : !!writers.updatePlaceholder);
      out[token] = {
        text: stop.text,
        label: stopLabel(stop),
        ...(drawPinned && { mark: 'Pinned' as const }),
        ...(writable && {
          write: isPinStop(stop)
            ? (text: string) => writePin(ph.id, stop, text)
            : (text: string) => writeValue(ph.id, stop.valueId, text),
          // Every copy open on one stop shares its key, so they mirror.
          valueKey: `${ph.id}:${stop.key}`,
        }),
        ...(stepsUnder && stops.length > 1 && {
          pager: {
            index,
            count: stops.length,
            unit: pin ? 'Pin' as const : 'Value' as const,
            step: (direction: StepDirection) => rolls.choose(stepsUnder, stops[stepIndex(index, direction, stops.length)].key),
          },
        }),
      };
    }
    return out;
  }, [rolls, value, placeholders, pinRows, readOnly, writers, writePin, writeValue]);
  const reroll = useCallback(
    () => rolls.reroll(directChipTargets([value]), placeholders),
    [rolls, value, placeholders],
  );
  // With no placeholders defined this is a plain text field: no values to preview with, so none are passed.
  // PromptField adds the per-field gate — even with values on offer, Preview disables until a chip is in
  // the text.
  const hasPlaceholders = placeholders.length > 0;
  return (
    <PromptField
      value={value}
      onChange={onChange}
      vocabulary={vocab}
      // The Player Name chip previews as its label, so it needs no placeholder behind it.
      previewValues={hasPlaceholders || hasUserMacro(value) ? previewValues : undefined}
      openValues={hasPlaceholders ? openValues : undefined}
      onReroll={hasPlaceholders ? reroll : undefined}
      insertOwnerId={ownerId}
      label={label}
      labelAside={labelAside}
      hint={hint}
      markdown={markdown}
      resizable={resizable}
      placeholder={placeholder}
      className={className}
      readOnly={readOnly}
      ariaLabel={ariaLabel}
      insertTrigger={PLACEHOLDER_TRIGGER}
    />
  );
};

export default PlaceholderField;

/**
 * The name-field form: one line, shaped like an ordinary input, chips inline. A name is a label a few words
 * long, so it gets none of the prose editor's tabs, toolbars or preview pane — the typeahead and the panel's
 * shared palette are the whole insert story.
 *
 * With no placeholders defined this is a plain text box: the vocabulary has nothing to offer, so the hint
 * and the menu both stay away.
 */
export const PlaceholderNameField = ({
  value, onChange, placeholders, ownerId, placeholder, ariaLabel, className, readOnly = false, onFocus, onBlur, onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholders: Placeholder[];
  /** The entity or book whose field this is — see `ownerId` on `PlaceholderField`. */
  ownerId?: string;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  readOnly?: boolean;
  /** Focus arriving, focus leaving, and Enter — what a rename offer reads an edit's start and end from. */
  onFocus?: () => void;
  onBlur?: () => void;
  onSubmit?: () => void;
}) => {
  const vocab = usePlaceholderChipVocabulary(placeholders, ownerId);
  const enabled = placeholders.length > 0 && !readOnly;
  return (
    <ChipInput
      value={value}
      onChange={onChange}
      vocabulary={vocab}
      placeholder={placeholderHint(placeholder, enabled)}
      ariaLabel={ariaLabel}
      className={className}
      readOnly={readOnly}
      trigger={enabled ? PLACEHOLDER_TRIGGER : undefined}
      onFocus={onFocus}
      onBlur={onBlur}
      onSubmit={onSubmit}
    />
  );
};
