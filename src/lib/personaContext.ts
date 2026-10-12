import { emptyRosterRuns, entityRosterRuns, ownedKinds, passesOnlyWith, scopedChipRuns, type OwnedTraitsInForce, type RosterOpts } from './locationContext';
import { mark, runs, textOf, type MarkedRun } from './markedText';
import type { ResolvedPersona } from './persona';
import { NONE_PLACEHOLDER } from './promptFallbacks';
import type { ValueLookup } from './promptValues';
import type { PlayerStat } from '@/types';

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

/** Every `<PERSONA>` token as a lookup, the persona's own `stats` nested in its block unless the token
 *  switches them off. */
export function personaContextValues(
  persona: ResolvedPersona | null, ownedTraits?: OwnedTraitsInForce, stats: readonly PlayerStat[] = [],
): ValueLookup {
  const ownedStats = persona && stats.length ? { [persona.entity.id]: stats } : undefined;
  return scopedChipRuns('<PERSONA>', {
    '': (opts) => personaContextRuns(persona, { ...opts, ownedTraits, ownedStats }),
  });
}
