import { hasPlaceholders } from '@/lib/placeholders';
import type { Placeholder } from '@/types';

/** A tree row input for the chip vocabulary: the placeholders when one of the row's texts holds a chip, so
 *  only such rows redraw when a placeholder changes. */
export const chipInput = (placeholders: readonly Placeholder[], ...texts: (string | undefined)[]): readonly Placeholder[] | null =>
  (texts.some((t) => t && hasPlaceholders(t)) ? placeholders : null);
