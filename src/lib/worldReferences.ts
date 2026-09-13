/**
 * The world-owned things a piece of linked content expects, and what this world answers with.
 *
 * A source names a shared placeholder or a location by its own id, which means nothing in the world
 * receiving the content. The author connects each one here; the connection is stored on the world's copy
 * and is what every later update reads, so the source renaming a reference keeps it connected.
 *
 * Pure: every function takes the world's lists and returns what to write, never writing anything itself.
 */
import { adoptBookPlaceholders, adoptEntityPlaceholders } from '@/lib/placeholderHomes';
import { randomUUID } from '@/lib/uuid';
import type { LinkableContent } from '@/lib/linkedContent';
import type { Dictionary, GameLocation, Placeholder } from '@/types';

/** Which kind of world-owned thing a reference expects. */
export type ReferenceKind = 'placeholder' | 'location';

/** The answer that makes the world gain the thing instead of reusing one it has. */
export const CREATE_NEW = 'new';

/** One thing in this world a row can connect to. */
export interface ReferenceCandidate {
  id: string;
  name: string;
  /** A placeholder's values, so a row can preview what this world would supply. Empty for a location. */
  values: string[];
}

/** One world-owned reference the content expects and this world has not settled. */
export interface ReferenceRow {
  kind: ReferenceKind;
  /** The source's own id for it — the key its connection is stored under. */
  key: string;
  /** What the source calls it. */
  name: string;
  /** The values the source's own world supplied, for the Content expects column. */
  expects: string[];
  /** This world's candidates, the ones carrying the reference's name first. */
  candidates: ReferenceCandidate[];
  /** The one candidate carrying the name, or null when none or several do. */
  suggested: string | null;
  /** Several candidates carry the name, so none of them is the obvious one. */
  ambiguous: boolean;
}

/** The world lists a row reads: the shared placeholders and the locations. */
export interface ReferenceWorld {
  placeholders: readonly Placeholder[];
  locations: readonly GameLocation[];
}

/** The author's answer per row key: a candidate's id, or {@link CREATE_NEW}. */
export type ReferenceChoices = Record<string, string>;

/** What a set of answers turns into: the connections a copy resolves its references through, and what the
 *  world gains because the author chose Create New. */
export interface ConnectionPlan {
  placeholders: Record<string, string>;
  locations: Record<string, string>;
  newLocations: GameLocation[];
  newPlaceholders: Placeholder[];
}

const key = (name: string) => name.trim().toLowerCase();

/** Read from the item's own shape, so this module needs nothing from the library layer. */
const isBook = (item: LinkableContent): item is Dictionary => 'entries' in item;

/**
 * One reference's candidates in the order the row offers them, with the single clear match where there is
 * one. A name is a suggestion and nothing more: one candidate carrying it is preselected, several carrying
 * it preselect nothing and lead the list so the author decides between them.
 */
export function rankCandidates(
  name: string, candidates: readonly ReferenceCandidate[],
): Pick<ReferenceRow, 'candidates' | 'suggested' | 'ambiguous'> {
  const wanted = key(name);
  const named = candidates.filter((c) => key(c.name) === wanted);
  return {
    candidates: [...named, ...candidates.filter((c) => key(c.name) !== wanted)],
    suggested: named.length === 1 ? named[0].id : null,
    ambiguous: named.length > 1,
  };
}

const valuesOf = (placeholder: Placeholder): string[] => (placeholder.values ?? []).map((v) => v.text);

const placeholderCandidates = (world: ReferenceWorld): ReferenceCandidate[] =>
  world.placeholders.map((p) => ({ id: p.id, name: p.name, values: valuesOf(p) }));

const locationCandidates = (world: ReferenceWorld): ReferenceCandidate[] =>
  world.locations.map((l) => ({ id: l.id, name: l.name, values: [] }));

/**
 * The shared placeholders a copy of `item` would not settle in `world`: what the adopt pass reports as
 * unmatched, so the rows and the insertion can never disagree about which references are open.
 *
 * A reference whose stored connection names a placeholder this world no longer has is open too, even where
 * the adopt pass would land it on some other one by name and values. The author answered that reference
 * once; a different placeholder taking its place silently is what the step exists to prevent.
 */
function unsettledPlaceholders(
  item: LinkableContent, world: ReferenceWorld, stored: Record<string, string>,
): Placeholder[] {
  const shared = item.sharedPlaceholders ?? [];
  if (!shared.length) return [];
  const dry = isBook(item)
    ? adoptBookPlaceholders(item, world.placeholders, stored)
    : adoptEntityPlaceholders(item, world.placeholders, stored);
  const known = new Set(world.placeholders.map((p) => p.id));
  const open = new Set(dry.unmatched);
  return shared.filter((p) => open.has(p.id) || (stored[p.id] && !known.has(stored[p.id])));
}

/** The location references a copy of `item` would not settle: every one whose stored connection, or whose
 *  own id, does not name a location this world holds. */
function unsettledLocations(
  item: LinkableContent, world: ReferenceWorld, stored: Record<string, string>,
): { id: string; name: string }[] {
  const refs = isBook(item) ? [] : (item.locationRefs ?? []);
  const known = new Set(world.locations.map((l) => l.id));
  return refs.filter((ref) => !known.has(stored[ref.id] ?? ref.id));
}

/**
 * Every reference a copy of `item` would leave open in `world`, Placeholders first and then locations.
 *
 * `stored` is what the copy already connected, so a repair asks only about what broke and a source update
 * asks only about what it introduced. An empty result means the content goes straight in.
 */
export function unresolvedReferences(
  item: LinkableContent, world: ReferenceWorld, stored: Record<string, string> = {},
): ReferenceRow[] {
  const places = placeholderCandidates(world);
  const locations = locationCandidates(world);
  return [
    ...unsettledPlaceholders(item, world, stored).map((p): ReferenceRow => ({
      kind: 'placeholder', key: p.id, name: p.name, expects: valuesOf(p), ...rankCandidates(p.name, places),
    })),
    ...unsettledLocations(item, world, stored).map((ref): ReferenceRow => ({
      kind: 'location', key: ref.id, name: ref.name, expects: [], ...rankCandidates(ref.name, locations),
    })),
  ];
}

/** Whether every row carries an answer — what Connect & Add waits for. A preselected row counts as
 *  answered only once the caller has folded that suggestion into `choices`. */
export function allReferencesAnswered(rows: readonly ReferenceRow[], choices: ReferenceChoices): boolean {
  return rows.every((row) => !!choices[row.key]);
}

/** The answers each row starts with: its suggestion where it has one, nothing where it does not. */
export function suggestedChoices(rows: readonly ReferenceRow[]): ReferenceChoices {
  return Object.fromEntries(rows.flatMap((row) => (row.suggested ? [[row.key, row.suggested]] : [])));
}

/**
 * The answers turned into what the caller writes.
 *
 * Adding content runs the adopt pass, which mints a placeholder for any reference the connection map does
 * not name, so a placeholder answered Create New is simply left out. Repairing a copy already in the world
 * runs no such pass, so `mintPlaceholders` makes this mint them instead, seeded with what the content
 * expects. A location has no adopt pass either way and is always minted here.
 */
export function planConnections(
  rows: readonly ReferenceRow[], choices: ReferenceChoices, mintPlaceholders = false,
): ConnectionPlan {
  const plan: ConnectionPlan = { placeholders: {}, locations: {}, newLocations: [], newPlaceholders: [] };
  for (const row of rows) {
    const choice = choices[row.key];
    if (!choice) continue;
    if (row.kind === 'placeholder') {
      if (choice !== CREATE_NEW) plan.placeholders[row.key] = choice;
      else if (mintPlaceholders) {
        const fresh: Placeholder = {
          id: randomUUID(),
          name: row.name,
          values: row.expects.map((text) => ({ id: randomUUID(), text })),
        };
        plan.newPlaceholders.push(fresh);
        plan.placeholders[row.key] = fresh.id;
      }
      continue;
    }
    if (choice === CREATE_NEW) {
      const fresh: GameLocation = { id: randomUUID(), name: row.name };
      plan.newLocations.push(fresh);
      plan.locations[row.key] = fresh.id;
    } else {
      plan.locations[row.key] = choice;
    }
  }
  return plan;
}
