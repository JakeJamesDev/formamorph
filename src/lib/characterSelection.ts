import type { EntityMetadata } from '@/types';

/**
 * Whether the enter-world character step is worth showing. Characters come from the player's local library,
 * so the step only appears when they have at least one saved character to choose from. Mirrors
 * `shouldShowDictionaryStep`.
 */
export function shouldShowCharacterStep(libraryMeta: EntityMetadata[]): boolean {
  return libraryMeta.length > 0;
}
