import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { Chip } from '@/components/Chip';
import { chipTokenKey } from '@/lib/promptVariables';
import { CHIP_TOKEN_ATTR } from '@/lib/editorFieldFocus';
import type { ChipVocabulary } from '@/lib/chipVocabulary';

/**
 * One chip token drawn as its pill: the shared chip shape, the vocabulary's accent, and the
 * `Name (Variant)` label composition.
 *
 * Presentational and read-only — the editor wraps it in the pop-out, the drag handle and the remove (×);
 * the Request Anatomy wraps it in a button onto the editor. Both render this, so a chip cannot read one
 * way in the field the player typed it into and another in the request it produced.
 *
 * Refs and unknown props pass through to the outer span, since the editor hands it straight to a Radix
 * `asChild` trigger.
 */

// `vocab` is also an RDFa span attribute, so it is dropped from the passthrough rather than shadowed.
export interface TokenChipProps extends Omit<ComponentPropsWithoutRef<'span'>, 'title' | 'children' | 'vocab'> {
  token: string;
  vocab: ChipVocabulary;
  /** Hover text, where the caller has something to say the vocabulary does not (a jump destination). */
  title?: string;
  onRemove?: (label: string) => void;
  grabbable?: boolean;
}

export const TokenChip = forwardRef<HTMLSpanElement, TokenChipProps>(function TokenChip(
  { token, vocab, title, onRemove, grabbable, className, ...rest },
  ref,
) {
  const color = vocab.color(token);
  // Reflect the mode in the chip text so it's readable at a glance, not only in the pop-out.
  const variantLabel = vocab.variantLabel(token);
  const name = vocab.label(token);
  // What the chip will become, for the tooltip — the label already says which placeholder it is.
  const hint = vocab.hint?.(token);
  return (
    <span
      ref={ref}
      {...{ [CHIP_TOKEN_ATTR]: chipTokenKey(token) }}
      {...rest}
      className={className ?? 'inline-block align-baseline'}
    >
      <Chip
        label={variantLabel ? `${name} (${variantLabel})` : name}
        removeLabel={name}
        title={title ?? (hint ? `${name} — ${hint}` : undefined)}
        onRemove={onRemove}
        grabbable={grabbable}
        style={color ? { backgroundColor: color, color: '#000' } : undefined}
      />
    </span>
  );
});
