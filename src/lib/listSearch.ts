import type { Placeholder } from '@/types';
import { chipPlaceholderNames, labelPlaceholders, type ChipNameOptions } from '@/lib/placementLetters';
import { describePlaceholders } from '@/lib/placeholders';

/** What a list search reads a row's name through: its placeholders and, on a world, the chip naming context. */
export type ListSearchNames = { placeholders: readonly Placeholder[] } & Pick<ChipNameOptions, 'letters' | 'owners'>;

/**
 * Whether a row named `name` matches a list search. Matches what the author reads: the row's label, the
 * names of the placeholders behind its chips, and their described values. A name holding a chip is stored
 * as a token, so matching the raw value would mean typing a UUID. An empty term matches every row.
 */
export function matchesListSearch(name: string, term: string, names: ListSearchNames): boolean {
  const needle = term.toLowerCase();
  if (!needle) return true;
  const { placeholders, letters, owners } = names;
  const hit = (text: string) => text.toLowerCase().includes(needle);
  return hit(labelPlaceholders(name, placeholders, { letters, owners }))
    || chipPlaceholderNames(name, placeholders, { owners }).some(hit)
    || hit(describePlaceholders(name, placeholders));
}
