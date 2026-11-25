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
