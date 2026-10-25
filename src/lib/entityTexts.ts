import { openingTexts } from '@/lib/openings';
import type { Entity } from '@/types';

/** Every authored string on an entity that can hold a chip, blank ones included. Chip scans, placement
 *  letters, priming and the card's carried placeholders all read this one list. */
export function entityTexts(e: Entity): (string | undefined)[] {
  return [e.name, ...(e.aliases ?? []), e.playerDescription, e.aiDescription, e.aiSummary, e.imageTags, e.pronouns,
    ...(e.relationships ?? []).map((r) => r.label), ...openingTexts(e)];
}
