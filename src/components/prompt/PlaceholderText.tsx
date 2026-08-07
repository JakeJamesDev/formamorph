import { useMemo, type ReactNode } from 'react';
import { placeholderVocabulary } from '@/lib/chipVocabulary';
import { hasPlaceholders, parsePlaceholderText, decodePlaceholderToken, placeholderValueSummary } from '@/lib/placeholders';
import { cn } from '@/lib/utils';
import type { Placeholder } from '@/types';

/**
 * Authored text with its placeholders drawn as chips rather than spelled out — for the read-only surfaces
 * that show a name: the editor trees, the flat item lists, and a committed alias or keyword.
 *
 * A pill names the placeholder and carries the values on hover, which is the opposite of an *open* field:
 * there the chip shows what it will become, because you are looking at the sentence it lands in. Colors are
 * the same per-placeholder accents the palette uses, so a pill and the chip you dragged in match.
 *
 * Text with no chips renders as plain text and costs one regex test, so this is safe to use for every row.
 */
const PlaceholderText = ({ text, placeholders, className }: {
  text: string;
  placeholders: Placeholder[];
  /** Applied to each pill, e.g. to shrink them inside an already-small chip. */
  className?: string;
}) => {
  const vocab = useMemo(() => placeholderVocabulary(placeholders), [placeholders]);
  const byId = useMemo(() => new Map(placeholders.map((p) => [p.id, p])), [placeholders]);

  if (!text || !hasPlaceholders(text)) return <>{text}</>;

  return (
    <>
      {parsePlaceholderText(text).map((seg, i): ReactNode => {
        if (seg.type === 'text') return <span key={i}>{seg.value}</span>;
        const decoded = decodePlaceholderToken(seg.token);
        const ph = decoded && byId.get(decoded.id);
        // A chip whose definition is gone: say so rather than rendering nothing, which is what the plain-text
        // form does and what makes a broken reference invisible in a list.
        if (!ph) {
          return (
            <span
              key={i}
              title="This placeholder no longer exists — it will resolve to nothing"
              className={cn('mx-0.5 rounded px-1 text-[0.85em] ring-1 ring-destructive/50 text-destructive', className)}
            >
              ?
            </span>
          );
        }
        // The name, so a row stays the same width whatever the value list does. What it becomes is one
        // hover away, in the same form the chips inside a field use.
        const values = ph.values.length ? placeholderValueSummary(ph) : 'no values';
        return (
          <span
            key={i}
            title={`${ph.name} — ${values}${decoded.mode === 'unique' ? ' (Unique)' : ''}`}
            className={cn('mx-0.5 rounded px-1 text-[0.85em] font-medium', className)}
            style={{ backgroundColor: vocab.color(seg.token), color: '#000' }}
          >
            {ph.name}
          </span>
        );
      })}
    </>
  );
};

export default PlaceholderText;
