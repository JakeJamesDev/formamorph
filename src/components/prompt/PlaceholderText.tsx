import { useMemo, type ReactNode } from 'react';
import { Tip } from '@/components/ui/tooltip';
import { placeholderVocabulary } from '@/lib/chipVocabulary';
import { hasPlaceholders, parsePlaceholderText, decodePlaceholderToken, placeholderValueSummary } from '@/lib/placeholders';
import { cn } from '@/lib/utils';
import type { Placeholder } from '@/types';

/**
 * Authored text with its placeholders drawn as chips rather than spelled out — for the read-only surfaces
 * that show a name: the editor trees, the flat item lists, and a committed alias or keyword.
 *
 * A pill shows what the name will become and carries the placeholder's own name on hover — the opposite of
 * a chip in an *open* field, which names the placeholder so it stays one word wide inside a sentence.
 * Colors are the same per-placeholder accents the palette uses, so a pill and the chip you inserted match.
 *
 * A chip whose definition was deleted renders a red `?`. Deliberately unlike {@link describePlaceholders},
 * which resolves the same case to `''` because a text surface has nowhere to hang the explanation.
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
            <Tip key={i} tip="This placeholder no longer exists — it will resolve to nothing" labelsChild={false}>
              <span
                className={cn('mx-0.5 rounded px-1 text-[0.85em] ring-1 ring-destructive/50 text-destructive', className)}
              >
                ?
              </span>
            </Tip>
          );
        }
        // Values, not the name: a row is showing what this thing will be called, so the pill previews it.
        // A placeholder with nothing to draw from falls back to its name, since an empty pill says nothing.
        const values = ph.values.length ? placeholderValueSummary(ph) : ph.name;
        return (
          // Inline in a row's label, dozens to a list: no tab stop, matching the chips it reads as.
          <Tip
            key={i}
            tip={`${ph.name}${ph.values.length ? '' : ' — no values'}${decoded.mode === 'unique' ? ' (Unique)' : ''}`}
            labelsChild={false}
          >
            <span
              className={cn('mx-0.5 rounded px-1 text-[0.85em] font-medium', className)}
              style={{ backgroundColor: vocab.color(seg.token), color: '#000' }}
            >
              {values}
            </span>
          </Tip>
        );
      })}
    </>
  );
};

export default PlaceholderText;
