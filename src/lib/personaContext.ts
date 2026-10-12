import { expandScopedTokens, renderEntityRoster, type OwnedTraitsInForce, type RosterOpts } from './locationContext';
import type { ResolvedPersona } from './persona';
import { NONE_PLACEHOLDER } from './promptFallbacks';
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
  if (!persona) return NONE_PLACEHOLDER;
  const { entity } = persona;
  if (opts.nameOnly) {
    const pronouns = entity.pronouns?.trim();
    return pronouns ? `${entity.name} (${pronouns})` : entity.name;
  }
  const block = renderEntityRoster([entity.id], [entity], opts);
  return persona.source === 'world' ? `${block}${knownPersonaLine(entity.name)}\n` : block;
}

/** Every `<PERSONA>` token (content × stats × format) mapped to its value, the persona's own `stats` nested
 *  in its block unless the token switches them off. */
export function personaContextValues(
  persona: ResolvedPersona | null, ownedTraits?: OwnedTraitsInForce, stats: readonly PlayerStat[] = [],
): Record<string, string> {
  const ownedStats = persona && stats.length ? { [persona.entity.id]: stats } : undefined;
  return expandScopedTokens('<PERSONA>', {
    '': (opts) => buildPersonaContext(persona, { ...opts, ownedTraits, ownedStats: opts.noStats ? undefined : ownedStats }),
  });
}
