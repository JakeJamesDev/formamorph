import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import PromptField from './PromptField';
import ChipInput from './ChipInput';
import { usePlaceholderChipVocabulary } from '@/lib/chipVocabulary';
import { decodePlaceholderToken, directChipTargets, placeholderIsChoice, type DrawPinSource } from '@/lib/placeholders';
import { useEditorPreviewRolls } from '@/contexts/EditorPreviewRollsContext';
import { usePlaceholderStoreOptional } from '@/contexts/PlaceholderStoreContext';
import type { Placeholder, PlaceholderValue } from '@/types';
import { PLACEHOLDER_TRIGGER, placeholderHint } from '@/lib/placeholderInsert';
import type { OpenValueView, StepDirection } from './openValueContext';

/** What a header says about an open value: its verbose name, and the mark for a value that is not an ordinary one. */
function openValueNames(values: Placeholder['values'] | undefined, index: number, pinned = false): Pick<OpenValueView, 'label' | 'mark'> {
  const label = index >= 0 ? `Value ${index + 1}` : '';
  if (pinned) return { label, mark: 'Pinned' };
  return values?.length ? { label } : { label, mark: 'No Values' };
}

/** The value `direction` steps to from `index`, wrapping. Off the list, a step enters it at either end. */
const stepIndex = (index: number, direction: StepDirection, count: number): number =>
  index < 0 ? (direction === 1 ? 0 : count - 1) : (index + direction + count) % count;

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
  const vocab = usePlaceholderChipVocabulary(placeholders, ownerId);
  const rolls = useEditorPreviewRolls();
  // Re-read on every reroll: the store's identity carries its version.
  const previewValues = useMemo(() => rolls.preview(value, placeholders), [rolls, value, placeholders]);
  // An Object draws nothing, so the value its chip opens on is this field's own, by token.
  const [objectIndexByToken, setObjectIndexByToken] = useState<Record<string, number>>({});
  // A value edit goes through the same store a chip rename does. Writes made since the store last rendered
  // build on each other, so two writes in one tick never drop the first.
  const store = usePlaceholderStoreOptional();
  const storeRef = useRef(store);
  const unrendered = useRef(new Map<string, Placeholder>());
  if (storeRef.current?.placeholders !== store?.placeholders) unrendered.current.clear();
  storeRef.current = store;
  const canWrite = !!store && !readOnly;
  const editValue = useCallback((placeholderId: string, valueId: string, edit: (v: PlaceholderValue) => PlaceholderValue) => {
    const bound = storeRef.current;
    const ph = unrendered.current.get(placeholderId) ?? bound?.placeholders.find((p) => p.id === placeholderId);
    if (!bound || !ph) return;
    const next = { ...ph, values: ph.values.map((v) => (v.id === valueId ? edit(v) : v)) };
    unrendered.current.set(placeholderId, next);
    bound.updatePlaceholder(next);
  }, []);
  const openValues = useMemo(() => {
    const writer = (placeholderId: string, valueId: string | undefined) =>
      (canWrite && valueId
        ? {
          write: (text: string) => editValue(placeholderId, valueId, (v) => ({ ...v, text })),
          valueKey: `${placeholderId}\n${valueId}`,
        }
        : {});
    // An off-list pin's text belongs to the value that laid it, so an edit rewrites that pin entry and the
    // pinned placeholder gains no value. Every chip reading the pin shares one key, so copies still mirror.
    const pinWriter = (pinnedId: string, source: DrawPinSource | undefined) =>
      (canWrite && source
        ? {
          write: (text: string) => editValue(source.placeholderId, source.valueId, (v) => ({
            ...v,
            pins: (v.pins ?? []).map((p) => (p.placeholderId === pinnedId ? { ...p, value: text } : p)),
          })),
          valueKey: `${source.placeholderId}\n${source.valueId}\npin:${pinnedId}`,
        }
        : {});
    const byId = new Map(placeholders.map((p) => [p.id, p]));
    const out: Record<string, OpenValueView> = {};
    for (const [token, open] of Object.entries(rolls.open(value, placeholders))) {
      const ph = byId.get(open.placeholderId);
      const values = ph?.values ?? [];
      const placement = decodePlaceholderToken(token);
      // A pin decides the value, so a step would write a roll nothing reads.
      if (!ph || !placement || values.length < 2 || open.pinned) {
        const index = values.findIndex((v) => v.id === open.valueId);
        out[token] = {
          text: open.text,
          ...openValueNames(values, index, open.pinned),
          // A pin on no value of its own is edited where it was laid; every other value is edited in place.
          ...(index >= 0 ? writer(open.placeholderId, values[index].id) : pinWriter(open.placeholderId, open.pinSource)),
        };
        continue;
      }
      if (!placeholderIsChoice(ph)) {
        const index = (objectIndexByToken[token] ?? 0) % values.length;
        out[token] = {
          text: values[index].text,
          ...openValueNames(values, index),
          ...writer(ph.id, values[index].id),
          pager: {
            index,
            count: values.length,
            step: (direction) => setObjectIndexByToken((prev) => ({ ...prev, [token]: stepIndex(index, direction, values.length) })),
          },
        };
        continue;
      }
      // A World drill target rolls under its own id; a Unique one rolls under a chain key no placement names.
      const rolled = placement.path?.length
        ? placement.mode === 'world' && { ...placement, id: ph.id }
        : placement;
      const index = open.valueId ? values.findIndex((v) => v.id === open.valueId) : -1;
      out[token] = {
        text: open.text,
        ...openValueNames(values, index),
        ...writer(ph.id, values[index]?.id),
        ...(rolled && {
          pager: {
            index,
            count: values.length,
            step: (direction: StepDirection) => rolls.setRoll(rolled, values[stepIndex(index, direction, values.length)].id),
          },
        }),
      };
    }
    return out;
  }, [rolls, value, placeholders, objectIndexByToken, canWrite, editValue]);
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
      previewValues={hasPlaceholders ? previewValues : undefined}
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
