import { useCallback, useMemo, type ReactNode } from 'react';
import PromptField from './PromptField';
import ChipInput from './ChipInput';
import { usePlaceholderChipVocabulary } from '@/lib/chipVocabulary';
import { directChipTargets } from '@/lib/placeholders';
import { useEditorPreviewRolls } from '@/contexts/EditorPreviewRollsContext';
import type { Placeholder } from '@/types';
import { PLACEHOLDER_TRIGGER, placeholderHint } from '@/lib/placeholderInsert';

/**
 * A chip editor for world text that can embed placeholders. Reuses the prompt chip editor with the
 * placeholder token family: the toolbar inserts the world's placeholders, and a Wildcard chip's pop-out
 * offers World | Unique (only once it has 2+ values). Stores the same token-string as the rest of the field.
 *
 * A Preview tab (from `PromptField`) swaps each chip for its author-time value — Variable → its value,
 * Wildcard → a pick (World shared per placeholder, Unique per placement) — read from the editor's shared
 * preview rolls, so every field shows the same value until the toolbar's Reroll draws again. The resolved
 * text is tinted the chip's own color, like the prompt previews.
 */
const PlaceholderField = ({ value, onChange, placeholders, ownerId, markdown = false, resizable = false, placeholder, className, readOnly = false, label, labelAside, ariaLabel }: {
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
      onReroll={hasPlaceholders ? reroll : undefined}
      insertOwnerId={ownerId}
      label={label}
      labelAside={labelAside}
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
export const PlaceholderNameField = ({ value, onChange, placeholders, ownerId, placeholder, ariaLabel, className, readOnly = false }: {
  value: string;
  onChange: (v: string) => void;
  placeholders: Placeholder[];
  /** The entity or book whose field this is — see `ownerId` on `PlaceholderField`. */
  ownerId?: string;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  readOnly?: boolean;
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
    />
  );
};
