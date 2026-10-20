import { emptyRosterRuns, entityRosterRuns, ownedKinds, passesOnlyWith, scopedChipRuns, type OwnedTraitsInForce, type RosterOpts } from './locationContext';
import { mark, runs, textOf, type MarkedRun } from './markedText';
import type { RelationshipLines } from './entityRelationships';
import type { ResolvedPersona } from './persona';
import { NONE_PLACEHOLDER } from './promptFallbacks';
import type { ValueLookup } from './promptValues';
import type { StatChipPart } from './statContext';
import type { Entity, PlayerStat } from '@/types';

/** The line under a world persona's block: the world's entities know this person, and its name means the player. */
export const knownPersonaLine = (name: string): string =>
  `Everyone in this world already knows ${name}. Wherever the world's text names ${name}, it means the player character.`;

/**
 * The `<PERSONA>` chip's value: the entity the player plays, as one entity block. Full and Summary are the
 * entity builder's own rendering, its owned traits in force and its stats included, so a persona reads exactly
 * like a cast member; a world persona adds the known-person line. Name is the name and pronouns only, for use inside a
 * sentence.
 */
export function buildPersonaContext(persona: ResolvedPersona | null, opts: RosterOpts = {}): string {
  return textOf(personaContextRuns(persona, opts));
}

/** {@link buildPersonaContext} as marked runs, its block marked as a roster block is. */
function personaContextRuns(persona: ResolvedPersona | null, opts: RosterOpts): MarkedRun[] {
  if (!persona) return runs(NONE_PLACEHOLDER);
  const { entity } = persona;
  // A persona the filter drops reads as no persona, with no known-person line.
  if (!passesOnlyWith(entity.id, opts)) return emptyRosterRuns(opts);
  const owns = ownedKinds(entity.id, opts);
  if (opts.nameOnly) {
    const pronouns = entity.pronouns?.trim();
    return mark(['content', ...owns], pronouns ? `${entity.name} (${pronouns})` : entity.name);
  }
  const block = entityRosterRuns([entity.id], [entity], opts);
  return persona.source === 'world' ? runs(block, mark(owns, `${knownPersonaLine(entity.name)}\n`)) : block;
}

/** Another entity the player plays as, as the persona's block reads it: its live stats, placed as it groups
 *  them, and the entity itself for its owned traits when the scene holds it. */
export interface PlayedPart extends StatChipPart {
  entity?: Entity;
}

/** A trait or stat, which sits in a group by id. */
type GroupMember = { id: string; groupId?: string | null };
/** A trait or stat group, which nests under a parent by id. */
type NestedGroup = { id: string; parentId: string | null };

/** The persona as one entity over every entity the player plays as: its own traits and stats, then each of
 *  `others`' under that entity's groups. The others' ids are scoped by owner so no two owners' items meet. */
function personaOver(
  persona: ResolvedPersona, ownedTraits: OwnedTraitsInForce | undefined, stats: readonly PlayerStat[], others: readonly PlayedPart[],
): { persona: ResolvedPersona; ownedTraits?: OwnedTraitsInForce; stats: readonly PlayerStat[] } {
  if (!others.length) return { persona, ownedTraits, stats };
  let { entity } = persona;
  const traitIds = [...(ownedTraits?.[entity.id] ?? [])];
  const allStats = [...stats];
  others.forEach(({ entity: other, stats: liveStats, placement }, i) => {
    const scoped = (id: string) => `${other?.id ?? `played-${i}`}/${id}`;
    const member = <T extends GroupMember>(x: T): T =>
      ({ ...x, id: scoped(x.id), ...(x.groupId != null && { groupId: scoped(x.groupId) }) });
    const group = <T extends NestedGroup>(g: T): T =>
      ({ ...g, id: scoped(g.id), parentId: g.parentId === null ? null : scoped(g.parentId) });
    entity = {
      ...entity,
      traits: [...(entity.traits ?? []), ...(other?.traits ?? []).map(member)],
      traitGroups: [...(entity.traitGroups ?? []), ...(other?.traitGroups ?? []).map(group)],
      stats: [...(entity.stats ?? []), ...(placement?.authored ?? []).map(member)],
      statGroups: [...(entity.statGroups ?? []), ...(placement?.groups ?? []).map(group)],
    };
    traitIds.push(...((other && ownedTraits?.[other.id]) ?? []).map(scoped));
    allStats.push(...liveStats.map(member));
  });
  return { persona: { ...persona, entity }, ownedTraits: { ...ownedTraits, [entity.id]: traitIds }, stats: allStats };
}

/** Every `<PERSONA>` token as a lookup, the persona's own `stats` and every one of `others` nested in its block
 *  unless the token switches them off. */
export function personaContextValues(
  persona: ResolvedPersona | null, ownedTraits?: OwnedTraitsInForce, stats: readonly PlayerStat[] = [],
  others: readonly PlayedPart[] = [], relationshipLines?: RelationshipLines,
): ValueLookup {
  const over = persona && personaOver(persona, ownedTraits, stats, others);
  const ownedStats = over && over.stats.length ? { [over.persona.entity.id]: over.stats } : undefined;
  return scopedChipRuns('<PERSONA>', {
    '': (opts) => personaContextRuns(over?.persona ?? null, {
      ...opts, ownedTraits: over?.ownedTraits ?? ownedTraits, ownedStats, relationshipLines,
    }),
  });
}
