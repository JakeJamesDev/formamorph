import { expandScopedTokens, renderEntityRoster, type ContextOpts } from './locationContext';
import type { ResolvedPersona } from './persona';
import { NONE_PLACEHOLDER } from './promptFallbacks';

/** The line under a world persona's block: the world's entities know this person, and its name means the player. */
export const knownPersonaLine = (name: string): string =>
  `Everyone in this world already knows ${name}. Wherever the world's text names ${name}, it means the player character.`;

/**
 * The `<PERSONA>` chip's value: the entity the player plays, as one entity block. Full and Summary are the
 * entity builder's own rendering, so a persona reads exactly like a cast member; a world persona adds the
 * known-person line. Name is the name and pronouns only, for use inside a sentence.
 */
export function buildPersonaContext(persona: ResolvedPersona | null, opts: ContextOpts = {}): string {
  if (!persona) return NONE_PLACEHOLDER;
  const { entity } = persona;
  if (opts.nameOnly) {
    const pronouns = entity.pronouns?.trim();
    return pronouns ? `${entity.name} (${pronouns})` : entity.name;
  }
  const block = renderEntityRoster([entity.id], [entity], opts);
  return persona.source === 'world' ? `${block}${knownPersonaLine(entity.name)}\n` : block;
}

/** Every `<PERSONA>` token (content × format) mapped to its value. */
export function personaContextValues(persona: ResolvedPersona | null): Record<string, string> {
  return expandScopedTokens('<PERSONA>', { '': (opts) => buildPersonaContext(persona, opts) });
}
