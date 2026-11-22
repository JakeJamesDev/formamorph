// The Opening Condition's keys and text. Light on imports, since the gate module reads it.
import type { OpeningRequirement } from '@/types';
import type { OpeningKey } from './drawnOpening';
import type { OpeningPickGroup } from './testBench/openingPick';

/** A key as one string, unique across the world: owner and id, or location and id. */
export const openingKeyId = ({ ownerId, openingId, locationId }: OpeningKey): string =>
  JSON.stringify(locationId === undefined ? [ownerId, openingId] : ['location', locationId, openingId]);

/** Whether `key` names the Drawn Opening `drawn`; never with no Drawn Opening. */
export const isDrawnOpening = (key: OpeningKey, drawn: OpeningKey | null | undefined): boolean =>
  !!drawn && openingKeyId(key) === openingKeyId(drawn);

/** Each listed Opening's label, by key id. */
export const openingLabelMap = (groups: readonly OpeningPickGroup[]): ReadonlyMap<string, string> =>
  new Map(groups.flatMap((g) => g.options.map((o) => [openingKeyId(o.key), o.label] as const)));

const OR = new Intl.ListFormat('en', { type: 'disjunction' });

/** The listed Openings in words: "ambush or World · Opening 2", a key `labels` lacks reading as missing. */
export const openingNames = (req: OpeningRequirement, labels: ReadonlyMap<string, string>): string =>
  OR.format(req.openings.map((key) => labels.get(openingKeyId(key)) ?? 'a missing Opening'));

/** "Opening ambush or World · Opening 2", "not Opening …". With `labels`, a key it lacks reads as missing and
 *  leaves the Condition unresolved; without, the text names no Opening. An empty list is unresolved. */
export function openingText(req: OpeningRequirement, labels?: ReadonlyMap<string, string>): { text: string; unresolved: boolean } {
  const not = req.not ? 'not ' : '';
  if (!req.openings.length) return { text: `${not}no Opening`, unresolved: true };
  if (!labels) return { text: `${not}${openingCountText(req)}`, unresolved: false };
  return {
    text: `${not}Opening ${openingNames(req, labels)}`,
    unresolved: req.openings.some((key) => !labels.has(openingKeyId(key))),
  };
}

/** "Opening", or "Opening (2)" for more than one: the text with no world to name them. */
export const openingCountText = (req: OpeningRequirement): string =>
  (req.openings.length > 1 ? `Opening (${req.openings.length})` : 'Opening');
