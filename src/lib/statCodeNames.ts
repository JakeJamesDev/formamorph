import type { Placeholder } from '@/types';
import { decodePlaceholderToken, hasPlaceholders, parsePlaceholderText } from './placeholders';
import { mapPreservingIdentity } from './utils';

/**
 * The one name stat code sees for a stat or a trait.
 *
 * Either name can carry placeholder chips, and a chip reads as a different text in every playthrough. Code
 * has to reach an entry by a name that never moves, so the code name is derived from authoring alone: each
 * chip becomes the placeholder's own name, and the rest of the name is the author's text. A chip-free name
 * is its own code name.
 *
 * Every surface that names one to code — the sandbox, the editor's completions and checks, Test Code, the
 * Test Bench's rules, and the rename offer — reads it from here, so what completes is what runs. The rolled
 * text is still what the prompt, the stat panel, and the turn log show.
 */
export function statCodeName(name: string | undefined, placeholders: readonly Placeholder[]): string {
  if (!name) return '';
  if (!hasPlaceholders(name)) return name;
  const nameById = new Map(placeholders.map((placeholder) => [placeholder.id, placeholder.name]));
  // A chipped name settles its own spacing: a chip no placeholder answers reads as nothing and would leave
  // the spaces around it doubled, and a placeholder name carries whatever spacing its author gave it. A
  // chip-free name never reaches here, so what an author types plainly is what code reads.
  return parsePlaceholderText(name)
    .map((segment) => (segment.type === 'text'
      ? segment.value
      : nameById.get(decodePlaceholderToken(segment.token)?.id ?? '') ?? ''))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A list of stats or traits with every name replaced by its code name. The same array, and the same
 *  entries, where no name carries a chip. */
export function statCodeNamed<T extends { name: string }>(
  stats: readonly T[],
  placeholders: readonly Placeholder[],
): T[] {
  return mapPreservingIdentity(stats, (stat) => {
    const name = statCodeName(stat.name, placeholders);
    return name === stat.name ? stat : { ...stat, name };
  });
}
