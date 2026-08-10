import { useMemo, useState, type ReactNode } from 'react';
import PromptField from './PromptField';
import ChipInput from './ChipInput';
import { usePlaceholderChipVocabulary } from '@/lib/chipVocabulary';
import { buildPlaceholderPreview } from '@/lib/placeholders';
import type { Placeholder } from '@/types';
import { PLACEHOLDER_TRIGGER, placeholderHint } from '@/lib/placeholderInsert';

/**
 * A chip editor for world text that can embed placeholders. Reuses the prompt chip editor with the
 * placeholder token family: the toolbar inserts the world's placeholders, and a Wildcard chip's pop-out
 * offers World | Unique (only once it has 2+ values). Stores the same token-string as the rest of the field.
 *
 * A Preview tab (from `PromptField`) swaps each chip for its author-time value — Variable → its value,
 * Wildcard → a random pick (World shared per placeholder, Unique per placement) — re-rolled each time the
 * tab is opened. The resolved text is tinted the chip's own color, like the prompt previews.
 */
const PlaceholderField = ({ value, onChange, placeholders, markdown = false, resizable = false, placeholder, className, readOnly = false, label, labelAside }: {
  value: string;
  onChange: (v: string) => void;
  placeholders: Placeholder[];
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
}) => {
  const vocab = usePlaceholderChipVocabulary(placeholders);
  // Bumped on each Preview open to re-roll Wildcards.
  const [rollNonce, setRollNonce] = useState(0);
  const previewValues = useMemo(
    () => buildPlaceholderPreview(value, placeholders),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rollNonce forces a fresh roll on each Preview open
    [value, placeholders, rollNonce],
  );
  // The Edit/Preview toggle only makes sense once the world/item defines placeholders to insert; with none,
  // this is a plain text field (no preview). Gated on the defined list, not on chips in this field's text.
  const hasPlaceholders = placeholders.length > 0;
  return (
    <PromptField
      value={value}
      onChange={onChange}
      vocabulary={vocab}
      previewValues={hasPlaceholders ? previewValues : undefined}
      onPreviewOpen={hasPlaceholders ? () => setRollNonce((n) => n + 1) : undefined}
      label={label}
      labelAside={labelAside}
      markdown={markdown}
      resizable={resizable}
      placeholder={placeholder}
      className={className}
      readOnly={readOnly}
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
export const PlaceholderNameField = ({ value, onChange, placeholders, placeholder, ariaLabel, className, readOnly = false }: {
  value: string;
  onChange: (v: string) => void;
  placeholders: Placeholder[];
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  readOnly?: boolean;
}) => {
  const vocab = usePlaceholderChipVocabulary(placeholders);
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
