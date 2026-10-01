import { entityTexts } from './entityTexts';
import { carriedPlaceholders } from './placeholderHomes';
import { primeRolls, weightedPick, type PlaceholderPick } from './placeholders';
import type { Dictionary, Entity, Placeholder, PlaceholderRolls } from '@/types';

/** Library content a playthrough holds beside the world: the library persona, an added character, a picked
 *  library book. Each brings its own pool. */
export type LibraryCarrier = Entity | Dictionary;

const isBook = (item: LibraryCarrier): item is Dictionary => 'entries' in item;

/** Every text a book places chips in. */
export const bookTexts = (book: Dictionary): (string | undefined)[] =>
  book.entries.flatMap((en) => [en.name, ...(en.key ?? []), ...(en.secondaryKeys ?? []), en.value]);

/** Every text a library item places chips in. */
export const carrierTexts = (item: LibraryCarrier): string[] =>
  (isBook(item) ? bookTexts(item) : entityTexts(item)).filter((t): t is string => !!t);

/** The session's Placeholder Set: the world's list, then each library item's pool, the first copy of an id
 *  winning. The world list comes back as itself when the items add nothing. */
export function libraryPlaceholderSet(world: Placeholder[], items: readonly (LibraryCarrier | null | undefined)[]): Placeholder[] {
  const held = new Set(world.map((p) => p.id));
  const added: Placeholder[] = [];
  for (const item of items) {
    if (!item) continue;
    for (const p of carriedPlaceholders(item)) {
      if (held.has(p.id)) continue;
      held.add(p.id);
      added.push(p);
    }
  }
  return added.length ? [...world, ...added] : world;
}

/** The rolls with every Wildcard the items' text places drawn from `set`. Existing rolls are kept, so an item
 *  set a second time reads the values it read the first time. The same rolls come back when nothing is drawn. */
export function primeLibraryRolls(
  set: Placeholder[],
  items: readonly LibraryCarrier[],
  rolls: PlaceholderRolls,
  pick: PlaceholderPick = weightedPick,
): PlaceholderRolls {
  const next = primeRolls(set, items.flatMap(carrierTexts), rolls, pick);
  const added = Object.keys(next.world ?? {}).length + Object.keys(next.unique ?? {}).length
    - Object.keys(rolls.world ?? {}).length - Object.keys(rolls.unique ?? {}).length;
  return added > 0 ? next : rolls;
}
